import { db, schema } from "@/db";
import { eq, inArray, sql, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

interface IncoherenceResult {
  involvedMarketIds: string[];
  violationType: "probability_sum" | "conditional_contradiction" | "mutual_exclusion" | "implication_violation";
  severity: number;
  description: string;
  impliedArbitrage: Record<string, unknown> | null;
}

const SUM_VIOLATION_THRESHOLD = 0.05;

async function detectProbabilitySumViolations(): Promise<IncoherenceResult[]> {
  logger.info("checking probability sum violations");

  const mutualExclusionEdges = await db
    .select()
    .from(schema.edges)
    .where(
      and(
        eq(schema.edges.relationClass, "logical"),
        eq(schema.edges.relationType, "mutually_exclusive"),
      ),
    );

  const mutualExclusionGroups = new Map<string, { marketIds: Set<string>; collectivelyExhaustive: boolean }>();

  for (const edge of mutualExclusionEdges) {
    const evidence = edge.evidence as Record<string, unknown> | null;
    if (!evidence) continue;

    const groupId = evidence.groupId;
    if (typeof groupId !== "string") continue;

    const collectivelyExhaustive = evidence.collectivelyExhaustive === true;

    if (!mutualExclusionGroups.has(groupId)) {
      mutualExclusionGroups.set(groupId, { marketIds: new Set(), collectivelyExhaustive });
    }
    const group = mutualExclusionGroups.get(groupId)!;
    group.marketIds.add(edge.sourceMarketId);
    group.marketIds.add(edge.targetMarketId);
    if (collectivelyExhaustive) {
      group.collectivelyExhaustive = true;
    }
  }

  const results: IncoherenceResult[] = [];

  for (const [groupId, group] of mutualExclusionGroups) {
    const ids = Array.from(group.marketIds);
    const markets = await db
      .select({
        id: schema.markets.id,
        title: schema.markets.title,
        currentProbability: schema.markets.currentProbability,
        volumeUsd: schema.markets.volumeUsd,
      })
      .from(schema.markets)
      .where(inArray(schema.markets.id, ids));

    const probabilities = markets
      .filter((m) => m.currentProbability !== null)
      .map((m) => ({
        id: m.id,
        title: m.title,
        probability: parseFloat(m.currentProbability!),
        volume: parseFloat(m.volumeUsd ?? "0"),
      }));

    if (probabilities.length < 2) continue;

    const sum = probabilities.reduce((s, m) => s + m.probability, 0);

    if (group.collectivelyExhaustive) {
      const deviation = Math.abs(sum - 1);
      if (deviation > SUM_VIOLATION_THRESHOLD) {
        const totalVolume = probabilities.reduce((s, m) => s + m.volume, 0);
        const severity = Math.min(deviation * 2, 1) * Math.min(totalVolume / 100000, 1);
        const direction = sum > 1 ? "exceed" : "fall short of";
        const marketNames = probabilities
          .map((m) => `"${m.title}" (${(m.probability * 100).toFixed(1)}%)`)
          .join(", ");

        results.push({
          involvedMarketIds: probabilities.map((m) => m.id),
          violationType: "probability_sum",
          severity: Math.min(severity, 1),
          description:
            `Mutually exclusive and collectively exhaustive markets in group ${groupId} ${direction} 100%: ` +
            `${marketNames}. Sum = ${(sum * 100).toFixed(1)}%, ` +
            `deviation of ${(deviation * 100).toFixed(1)} percentage points. ` +
            `This suggests mispricing across ${probabilities.length} outcomes.`,
          impliedArbitrage: {
            groupId,
            sum,
            deviation,
            collectivelyExhaustive: true,
            direction: sum > 1 ? "overpriced" : "underpriced",
            markets: probabilities,
          },
        });
      }
    } else {
      if (sum > 1 + SUM_VIOLATION_THRESHOLD) {
        const deviation = sum - 1;
        const totalVolume = probabilities.reduce((s, m) => s + m.volume, 0);
        const severity = Math.min(deviation * 2, 1) * Math.min(totalVolume / 100000, 1);
        const marketNames = probabilities
          .map((m) => `"${m.title}" (${(m.probability * 100).toFixed(1)}%)`)
          .join(", ");

        results.push({
          involvedMarketIds: probabilities.map((m) => m.id),
          violationType: "probability_sum",
          severity: Math.min(severity, 1),
          description:
            `Mutually exclusive (but not exhaustive) markets in group ${groupId} exceed 100%: ` +
            `${marketNames}. Sum = ${(sum * 100).toFixed(1)}%, ` +
            `exceeds maximum of 100% by ${(deviation * 100).toFixed(1)} percentage points. ` +
            `Constraint: sum <= 1 since outcomes are mutually exclusive.`,
          impliedArbitrage: {
            groupId,
            sum,
            deviation,
            collectivelyExhaustive: false,
            direction: "overpriced",
            markets: probabilities,
          },
        });
      }
    }
  }

  return results;
}

async function detectConditionalContradictions(): Promise<IncoherenceResult[]> {
  logger.info("checking conditional contradictions");

  const strongEdges = await db
    .select()
    .from(schema.edges)
    .where(sql`${schema.edges.score}::numeric >= 0.5`);

  const results: IncoherenceResult[] = [];
  const marketCache = new Map<string, { title: string; probability: number; volume: number }>();

  async function getMarket(id: string) {
    if (marketCache.has(id)) return marketCache.get(id)!;
    const [market] = await db
      .select({
        title: schema.markets.title,
        currentProbability: schema.markets.currentProbability,
        volumeUsd: schema.markets.volumeUsd,
      })
      .from(schema.markets)
      .where(eq(schema.markets.id, id));

    if (!market || !market.currentProbability) return null;
    const result = {
      title: market.title,
      probability: parseFloat(market.currentProbability),
      volume: parseFloat(market.volumeUsd ?? "0"),
    };
    marketCache.set(id, result);
    return result;
  }

  for (const edge of strongEdges) {
    const source = await getMarket(edge.sourceMarketId);
    const target = await getMarket(edge.targetMarketId);
    if (!source || !target) continue;

    const score = parseFloat(edge.score);
    const probDiff = Math.abs(source.probability - target.probability);

    const expectedMaxDiff = 1 - score;
    if (probDiff > expectedMaxDiff + 0.15) {
      const severity =
        Math.min((probDiff - expectedMaxDiff) * 2, 1) *
        Math.min(score, 1) *
        Math.min((source.volume + target.volume) / 200000, 1);

      results.push({
        involvedMarketIds: [edge.sourceMarketId, edge.targetMarketId],
        violationType: "conditional_contradiction",
        severity: Math.min(severity, 1),
        description:
          `Strong ${edge.relationClass}/${edge.relationType} relationship (score ${score.toFixed(2)}) between ` +
          `"${source.title}" (${(source.probability * 100).toFixed(1)}%) and ` +
          `"${target.title}" (${(target.probability * 100).toFixed(1)}%), ` +
          `but their probabilities diverge by ${(probDiff * 100).toFixed(1)} percentage points. ` +
          `Expected max divergence given relationship: ${(expectedMaxDiff * 100).toFixed(1)}pp.`,
        impliedArbitrage: {
          edgeScore: score,
          relationClass: edge.relationClass,
          relationType: edge.relationType,
          sourceProbability: source.probability,
          targetProbability: target.probability,
          divergence: probDiff,
          expectedMaxDivergence: expectedMaxDiff,
        },
      });
    }
  }

  return results;
}

async function detectTransitiveInconsistencies(): Promise<IncoherenceResult[]> {
  logger.info("checking transitive inconsistencies");

  const allEdges = await db
    .select()
    .from(schema.edges)
    .where(sql`${schema.edges.score}::numeric >= 0.4`);

  const adjacency = new Map<string, Map<string, { score: number; relationClass: string; relationType: string }>>();

  for (const edge of allEdges) {
    const s = parseFloat(edge.score);
    if (!adjacency.has(edge.sourceMarketId)) adjacency.set(edge.sourceMarketId, new Map());
    if (!adjacency.has(edge.targetMarketId)) adjacency.set(edge.targetMarketId, new Map());

    const existingFwd = adjacency.get(edge.sourceMarketId)!.get(edge.targetMarketId);
    if (!existingFwd || Math.abs(s) > Math.abs(existingFwd.score)) {
      adjacency.get(edge.sourceMarketId)!.set(edge.targetMarketId, {
        score: s,
        relationClass: edge.relationClass,
        relationType: edge.relationType,
      });
    }
    const existingRev = adjacency.get(edge.targetMarketId)!.get(edge.sourceMarketId);
    if (!existingRev || Math.abs(s) > Math.abs(existingRev.score)) {
      adjacency.get(edge.targetMarketId)!.set(edge.sourceMarketId, {
        score: s,
        relationClass: edge.relationClass,
        relationType: edge.relationType,
      });
    }
  }

  const results: IncoherenceResult[] = [];
  const checked = new Set<string>();

  for (const [nodeA, neighborsA] of adjacency) {
    for (const [nodeB, edgeAB] of neighborsA) {
      if (nodeB <= nodeA) continue;

      const neighborsB = adjacency.get(nodeB);
      if (!neighborsB) continue;

      for (const [nodeC, edgeBC] of neighborsB) {
        if (nodeC <= nodeA || nodeC === nodeA) continue;

        const key = [nodeA, nodeB, nodeC].sort().join(":");
        if (checked.has(key)) continue;
        checked.add(key);

        const edgeAC = neighborsA.get(nodeC);
        if (!edgeAC) continue;

        if (
          edgeAB.score > 0.5 &&
          edgeBC.score > 0.5 &&
          edgeAC.score < -0.3
        ) {
          const markets = await db
            .select({ id: schema.markets.id, title: schema.markets.title })
            .from(schema.markets)
            .where(inArray(schema.markets.id, [nodeA, nodeB, nodeC]));

          const titleMap = new Map(markets.map((m) => [m.id, m.title]));

          results.push({
            involvedMarketIds: [nodeA, nodeB, nodeC],
            violationType: "implication_violation",
            severity: Math.min(
              (edgeAB.score + edgeBC.score - edgeAC.score) / 3,
              1,
            ),
            description:
              `Transitive inconsistency: "${titleMap.get(nodeA)}" correlates positively with ` +
              `"${titleMap.get(nodeB)}" (${edgeAB.score.toFixed(2)}), which correlates positively with ` +
              `"${titleMap.get(nodeC)}" (${edgeBC.score.toFixed(2)}), but ` +
              `"${titleMap.get(nodeA)}" and "${titleMap.get(nodeC)}" have negative correlation ` +
              `(${edgeAC.score.toFixed(2)}). This violates transitivity of positive dependence.`,
            impliedArbitrage: {
              triangle: { ab: edgeAB.score, bc: edgeBC.score, ac: edgeAC.score },
              markets: [nodeA, nodeB, nodeC].map((id) => ({
                id,
                title: titleMap.get(id),
              })),
            },
          });
        }
      }
    }
  }

  return results;
}

export async function detectIncoherences(): Promise<{
  detected: number;
  stored: number;
}> {
  logger.info("starting incoherence detection");

  const [sumViolations, contradictions, transitiveIssues] = await Promise.all([
    detectProbabilitySumViolations(),
    detectConditionalContradictions(),
    detectTransitiveInconsistencies(),
  ]);

  const allIncoherences = [...sumViolations, ...contradictions, ...transitiveIssues];
  logger.info("incoherences detected", { total: allIncoherences.length });

  await db
    .update(schema.incoherences)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(eq(schema.incoherences.status, "active"));

  let stored = 0;
  for (const inc of allIncoherences) {
    await db.insert(schema.incoherences).values({
      involvedMarketIds: inc.involvedMarketIds,
      violationType: inc.violationType,
      severity: inc.severity.toFixed(8),
      description: inc.description,
      impliedArbitrage: inc.impliedArbitrage,
      status: "active",
    });
    stored++;
  }

  logger.info("incoherence detection complete", {
    detected: allIncoherences.length,
    stored,
  });

  return { detected: allIncoherences.length, stored };
}
