import { db, schema } from "@/db";
import { eq, inArray, sql, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

interface IncoherenceResult {
  involvedMarketIds: string[];
  violationType: "probability_sum" | "probability_divergence" | "mutual_exclusion" | "implication_violation";
  detectionClass: "contradiction" | "divergence";
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

  const allMarketIds = new Set<string>();
  for (const group of mutualExclusionGroups.values()) {
    for (const id of group.marketIds) allMarketIds.add(id);
  }

  const marketMap = new Map<string, { id: string; title: string; probability: number; volume: number }>();
  if (allMarketIds.size > 0) {
    const ids = Array.from(allMarketIds);
    for (let i = 0; i < ids.length; i += 500) {
      const batch = ids.slice(i, i + 500);
      const markets = await db
        .select({
          id: schema.markets.id,
          title: schema.markets.title,
          currentProbability: schema.markets.currentProbability,
          volumeUsd: schema.markets.volumeUsd,
        })
        .from(schema.markets)
        .where(inArray(schema.markets.id, batch));

      for (const m of markets) {
        if (m.currentProbability) {
          marketMap.set(m.id, {
            id: m.id,
            title: m.title,
            probability: parseFloat(m.currentProbability),
            volume: parseFloat(m.volumeUsd ?? "0"),
          });
        }
      }
    }
  }

  const results: IncoherenceResult[] = [];

  for (const [groupId, group] of mutualExclusionGroups) {
    const probabilities = Array.from(group.marketIds)
      .map((id) => marketMap.get(id))
      .filter((m): m is NonNullable<typeof m> => m !== undefined);

    if (probabilities.length < 2) continue;

    const sum = probabilities.reduce((s, m) => s + m.probability, 0);
    const totalVolume = probabilities.reduce((s, m) => s + m.volume, 0);
    const volumeFactor = Math.min(totalVolume / 100000, 1);

    if (group.collectivelyExhaustive) {
      const deviation = Math.abs(sum - 1);
      if (deviation > SUM_VIOLATION_THRESHOLD) {
        const rawSeverity = Math.min(deviation * 2, 1) * volumeFactor;
        const severity = 0.7 + 0.3 * rawSeverity;
        const direction = sum > 1 ? "exceed" : "fall short of";
        const marketNames = probabilities
          .map((m) => `"${m.title}" (${(m.probability * 100).toFixed(1)}%)`)
          .join(", ");

        results.push({
          involvedMarketIds: probabilities.map((m) => m.id),
          violationType: "probability_sum",
          detectionClass: "contradiction",
          severity: Math.min(severity, 1),
          description:
            `Mutually exclusive and collectively exhaustive markets in group ${groupId} ${direction} 100%: ` +
            `${marketNames}. Sum = ${(sum * 100).toFixed(1)}%, ` +
            `deviation of ${(deviation * 100).toFixed(1)} percentage points.`,
          impliedArbitrage: {
            type: "logical_arbitrage",
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
        const rawSeverity = Math.min(deviation * 2, 1) * volumeFactor;
        const severity = 0.7 + 0.3 * rawSeverity;
        const marketNames = probabilities
          .map((m) => `"${m.title}" (${(m.probability * 100).toFixed(1)}%)`)
          .join(", ");

        results.push({
          involvedMarketIds: probabilities.map((m) => m.id),
          violationType: "probability_sum",
          detectionClass: "contradiction",
          severity: Math.min(severity, 1),
          description:
            `Mutually exclusive (but not exhaustive) markets in group ${groupId} exceed 100%: ` +
            `${marketNames}. Sum = ${(sum * 100).toFixed(1)}%, ` +
            `exceeds maximum of 100% by ${(deviation * 100).toFixed(1)} percentage points.`,
          impliedArbitrage: {
            type: "logical_arbitrage",
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

async function detectProbabilityDivergences(): Promise<IncoherenceResult[]> {
  logger.info("checking probability divergences");

  const allMarkets = await db
    .select({
      id: schema.markets.id,
      title: schema.markets.title,
      platform: schema.markets.platform,
      currentProbability: schema.markets.currentProbability,
      volumeUsd: schema.markets.volumeUsd,
    })
    .from(schema.markets);

  const marketMap = new Map<string, { title: string; platform: string; probability: number; volume: number }>();
  for (const m of allMarkets) {
    if (!m.currentProbability) continue;
    marketMap.set(m.id, {
      title: m.title,
      platform: m.platform,
      probability: parseFloat(m.currentProbability),
      volume: parseFloat(m.volumeUsd ?? "0"),
    });
  }

  const strongEdges = await db
    .select()
    .from(schema.edges)
    .where(
      and(
        eq(schema.edges.relationClass, "logical"),
        sql`${schema.edges.score}::numeric >= 0.5`,
      ),
    );

  logger.info("divergence check", { strongEdges: strongEdges.length, markets: marketMap.size });

  const results: IncoherenceResult[] = [];

  for (const edge of strongEdges) {
    const source = marketMap.get(edge.sourceMarketId);
    const target = marketMap.get(edge.targetMarketId);
    if (!source || !target) continue;

    const score = parseFloat(edge.score);
    const probDiff = Math.abs(source.probability - target.probability);

    const expectedMaxDiff = 1 - score;
    if (probDiff > expectedMaxDiff + 0.15) {
      const isCrossPlatform = source.platform !== target.platform;

      const resolutionStatus = (edge as Record<string, unknown>).resolutionMatchStatus as string | null;

      if (isCrossPlatform && resolutionStatus !== "verified_equivalent") {
        const resolutionNote = resolutionStatus === "divergent"
          ? " Resolution criteria differ between these platforms, so this price difference may be justified."
          : " Resolution equivalence has not been verified between these platforms.";

        const significance = Math.min((probDiff - expectedMaxDiff) * 2, 1) * Math.min(score, 1);
        const volumeFactor = Math.min((source.volume + target.volume) / 200000, 1);
        const severity = 0.3 + 0.4 * significance * volumeFactor;

        results.push({
          involvedMarketIds: [edge.sourceMarketId, edge.targetMarketId],
          violationType: "probability_divergence",
          detectionClass: "divergence",
          severity: Math.min(severity, 0.5),
          description:
            `Cross-platform ${edge.relationClass}/${edge.relationType} relationship (score ${score.toFixed(2)}) between ` +
            `"${source.title}" (${(source.probability * 100).toFixed(1)}%) and ` +
            `"${target.title}" (${(target.probability * 100).toFixed(1)}%). ` +
            `Divergence: ${(probDiff * 100).toFixed(1)}pp, expected max: ${(expectedMaxDiff * 100).toFixed(1)}pp.` +
            resolutionNote,
          impliedArbitrage: {
            type: "suggested_position",
            warning: "This position is profitable only if the historical relationship holds going forward and both markets resolve under equivalent criteria. It is a statistical bet, not a guaranteed arbitrage.",
            edgeScore: score,
            relationClass: edge.relationClass,
            relationType: edge.relationType,
            resolutionMatchStatus: resolutionStatus ?? "unverified",
            sourceProbability: source.probability,
            targetProbability: target.probability,
            divergence: probDiff,
            expectedMaxDivergence: expectedMaxDiff,
          },
        });
        continue;
      }

      const significance = Math.min((probDiff - expectedMaxDiff) * 2, 1) * Math.min(score, 1);
      const volumeFactor = Math.min((source.volume + target.volume) / 200000, 1);
      const severity = 0.3 + 0.4 * significance * volumeFactor;

      results.push({
        involvedMarketIds: [edge.sourceMarketId, edge.targetMarketId],
        violationType: "probability_divergence",
        detectionClass: isCrossPlatform ? "contradiction" : "divergence",
        severity: Math.min(severity, 0.7),
        description:
          `Strong ${edge.relationClass}/${edge.relationType} relationship (score ${score.toFixed(2)}) between ` +
          `"${source.title}" (${(source.probability * 100).toFixed(1)}%) and ` +
          `"${target.title}" (${(target.probability * 100).toFixed(1)}%). ` +
          `These markets show an unusual pricing pattern given their historical relationship ` +
          `(divergence: ${(probDiff * 100).toFixed(1)}pp, expected max: ${(expectedMaxDiff * 100).toFixed(1)}pp). ` +
          `This may indicate mispricing, a regime change, or a limitation of the correlation model.`,
        impliedArbitrage: {
          type: "suggested_position",
          warning: "This position is profitable only if the historical relationship holds going forward. It is a statistical bet, not a guaranteed arbitrage.",
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

export async function detectIncoherences(): Promise<{
  detected: number;
  stored: number;
}> {
  logger.info("starting incoherence detection");

  const [sumViolations, divergences] = await Promise.all([
    detectProbabilitySumViolations(),
    detectProbabilityDivergences(),
  ]);

  const allIncoherences = [...sumViolations, ...divergences];
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
      detectionClass: inc.detectionClass,
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
