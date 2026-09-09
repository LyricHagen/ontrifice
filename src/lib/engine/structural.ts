import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

export interface StructuralEdge {
  sourceMarketId: string;
  targetMarketId: string;
  weight: number;
  confidence: number;
  evidence: {
    constraintType: "mutual_exclusion" | "implication" | "temporal_ordering";
    groupId?: string;
    reason: string;
  };
}

interface MarketRecord {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  metadata: Record<string, unknown> | null;
  platform: string;
}

const IMPLICATION_PATTERNS: Array<{
  broader: RegExp;
  narrower: RegExp;
  description: string;
}> = [
  {
    broader: /win(?:s|ning)?\s+(?:the\s+)?(?:presidency|general\s+election|election)/i,
    narrower: /win(?:s|ning)?\s+(?:the\s+)?(?:nomination|primary)/i,
    description: "winning nomination is necessary for winning general election",
  },
  {
    broader: /\b(?:gdp|growth).*(?:full\s+)?year/i,
    narrower: /\b(?:gdp|growth).*(?:q[1-4]|quarter)/i,
    description: "quarterly metrics contribute to annual totals",
  },
  {
    broader: /\brecession\b/i,
    narrower: /\b(?:gdp|growth).*(?:negative|decline|contract)/i,
    description: "negative GDP growth is a component of recession",
  },
];

const TEMPORAL_ORDER_PATTERNS: Array<{
  earlier: RegExp;
  later: RegExp;
  description: string;
}> = [
  {
    earlier: /\b(?:primary|nomination|caucus)\b/i,
    later: /\b(?:general\s+election|inaugurat|president.*(?:win|elect))\b/i,
    description: "primary/nomination precedes general election",
  },
  {
    earlier: /\bq1\b/i,
    later: /\b(?:q2|q3|q4|full\s*year)\b/i,
    description: "Q1 resolves before later quarters",
  },
  {
    earlier: /\bq2\b/i,
    later: /\b(?:q3|q4|full\s*year)\b/i,
    description: "Q2 resolves before later quarters",
  },
  {
    earlier: /\bq3\b/i,
    later: /\b(?:q4|full\s*year)\b/i,
    description: "Q3 resolves before Q4 and full year",
  },
];

function extractNegRiskGroup(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const groupId = metadata.negRiskGroupId ?? metadata.neg_risk_group_id ?? metadata.groupId;
  return typeof groupId === "string" ? groupId : null;
}

function extractEventId(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const eventId = metadata.eventId ?? metadata.event_id ?? metadata.conditionId;
  return typeof eventId === "string" ? eventId : null;
}

function detectMutualExclusion(markets: MarketRecord[]): StructuralEdge[] {
  const edges: StructuralEdge[] = [];
  const negRiskGroups = new Map<string, MarketRecord[]>();
  const eventGroups = new Map<string, MarketRecord[]>();

  for (const market of markets) {
    const negRisk = extractNegRiskGroup(market.metadata);
    if (negRisk) {
      if (!negRiskGroups.has(negRisk)) negRiskGroups.set(negRisk, []);
      negRiskGroups.get(negRisk)!.push(market);
    }

    const eventId = extractEventId(market.metadata);
    if (eventId) {
      if (!eventGroups.has(eventId)) eventGroups.set(eventId, []);
      eventGroups.get(eventId)!.push(market);
    }
  }

  for (const [groupId, group] of negRiskGroups) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        edges.push({
          sourceMarketId: group[i].id,
          targetMarketId: group[j].id,
          weight: 0.95,
          confidence: 0.95,
          evidence: {
            constraintType: "mutual_exclusion",
            groupId,
            reason: `both markets belong to NegRisk group ${groupId}, probabilities should sum to ~1`,
          },
        });
      }
    }
  }

  for (const [eventId, group] of eventGroups) {
    if (group.length < 2) continue;
    if (negRiskGroups.has(eventId)) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        edges.push({
          sourceMarketId: group[i].id,
          targetMarketId: group[j].id,
          weight: 0.85,
          confidence: 0.8,
          evidence: {
            constraintType: "mutual_exclusion",
            groupId: eventId,
            reason: `both markets belong to event ${eventId}, likely mutually exclusive outcomes`,
          },
        });
      }
    }
  }

  return edges;
}

function shareSubjectMatter(a: MarketRecord, b: MarketRecord): boolean {
  const textA = [a.title, a.description ?? ""].join(" ").toLowerCase();
  const textB = [b.title, b.description ?? ""].join(" ").toLowerCase();

  const significantWords = new Set<string>();
  const wordsA = textA.split(/\s+/).filter((w) => w.length > 3);
  for (const word of wordsA) {
    if (textB.includes(word)) significantWords.add(word);
  }

  return significantWords.size >= 2 || a.category === b.category;
}

function detectImplications(markets: MarketRecord[]): StructuralEdge[] {
  const edges: StructuralEdge[] = [];

  for (let i = 0; i < markets.length; i++) {
    for (let j = 0; j < markets.length; j++) {
      if (i === j) continue;
      if (!shareSubjectMatter(markets[i], markets[j])) continue;

      const textI = [markets[i].title, markets[i].description ?? ""].join(" ");
      const textJ = [markets[j].title, markets[j].description ?? ""].join(" ");

      for (const pattern of IMPLICATION_PATTERNS) {
        if (pattern.narrower.test(textI) && pattern.broader.test(textJ)) {
          edges.push({
            sourceMarketId: markets[i].id,
            targetMarketId: markets[j].id,
            weight: 0.8,
            confidence: 0.7,
            evidence: {
              constraintType: "implication",
              reason: pattern.description,
            },
          });
        }
      }
    }
  }

  return edges;
}

function detectTemporalOrdering(markets: MarketRecord[]): StructuralEdge[] {
  const edges: StructuralEdge[] = [];

  for (let i = 0; i < markets.length; i++) {
    for (let j = 0; j < markets.length; j++) {
      if (i === j) continue;
      if (!shareSubjectMatter(markets[i], markets[j])) continue;

      const textI = [markets[i].title, markets[i].description ?? ""].join(" ");
      const textJ = [markets[j].title, markets[j].description ?? ""].join(" ");

      for (const pattern of TEMPORAL_ORDER_PATTERNS) {
        if (pattern.earlier.test(textI) && pattern.later.test(textJ)) {
          edges.push({
            sourceMarketId: markets[i].id,
            targetMarketId: markets[j].id,
            weight: 0.75,
            confidence: 0.65,
            evidence: {
              constraintType: "temporal_ordering",
              reason: pattern.description,
            },
          });
        }
      }
    }
  }

  return edges;
}

export async function detectStructuralConstraints(): Promise<StructuralEdge[]> {
  logger.info("starting structural constraint detection");

  const activeMarkets = await db
    .select({
      id: schema.markets.id,
      title: schema.markets.title,
      description: schema.markets.description,
      category: schema.markets.category,
      metadata: schema.markets.metadata,
      platform: schema.markets.platform,
    })
    .from(schema.markets)
    .where(eq(schema.markets.status, "active"));

  if (activeMarkets.length < 2) {
    logger.info("fewer than 2 active markets, skipping structural detection");
    return [];
  }

  const mutualExclusion = detectMutualExclusion(activeMarkets);
  logger.info("mutual exclusion edges", { count: mutualExclusion.length });

  const implications = detectImplications(activeMarkets);
  logger.info("implication edges", { count: implications.length });

  const temporalOrdering = detectTemporalOrdering(activeMarkets);
  logger.info("temporal ordering edges", { count: temporalOrdering.length });

  const allEdges = [...mutualExclusion, ...implications, ...temporalOrdering];
  logger.info("structural detection complete", { edgesFound: allEdges.length });

  return allEdges;
}
