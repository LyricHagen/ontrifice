import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

export interface StructuralEdge {
  sourceMarketId: string;
  targetMarketId: string;
  relationClass: "logical";
  relationType: "mutually_exclusive" | "implies" | "complement" | "temporal_precondition";
  score: number;
  confidence: number;
  mathematicalSemantics: string;
  modelVersion: string;
  evidence: {
    constraintType: "mutual_exclusion" | "implication" | "complement" | "temporal_ordering";
    collectivelyExhaustive?: boolean;
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
          relationClass: "logical",
          relationType: "mutually_exclusive",
          score: 1.0,
          confidence: 1.0,
          mathematicalSemantics: "P(A AND B) = 0; outcomes are mutually exclusive and collectively exhaustive within this group",
          modelVersion: "structural-v2",
          evidence: {
            constraintType: "mutual_exclusion",
            collectivelyExhaustive: true,
            groupId,
            reason: `both markets belong to NegRisk group ${groupId}, probabilities must sum to 1`,
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
          relationClass: "logical",
          relationType: "mutually_exclusive",
          score: 1.0,
          confidence: 1.0,
          mathematicalSemantics: "P(A AND B) = 0; outcomes are mutually exclusive within event group",
          modelVersion: "structural-v2",
          evidence: {
            constraintType: "mutual_exclusion",
            collectivelyExhaustive: false,
            groupId: eventId,
            reason: `both markets belong to event ${eventId}, at most one outcome can occur`,
          },
        });
      }
    }
  }

  return edges;
}

const SAME_RACE_PATTERN = /^will\s+(.+?)\s+win\s+(?:the\s+)?(.+?)(?:\?|$)/i;

function extractRaceInfo(title: string): { candidate: string; race: string } | null {
  const match = title.match(SAME_RACE_PATTERN);
  if (!match) return null;
  return {
    candidate: match[1].trim().toLowerCase(),
    race: match[2].trim().toLowerCase().replace(/\s+/g, " "),
  };
}

function detectSameRaceExclusion(markets: MarketRecord[]): StructuralEdge[] {
  const edges: StructuralEdge[] = [];
  const raceGroups = new Map<string, MarketRecord[]>();

  for (const market of markets) {
    const info = extractRaceInfo(market.title);
    if (!info) continue;
    const key = `${market.platform}::${info.race}`;
    if (!raceGroups.has(key)) raceGroups.set(key, []);
    raceGroups.get(key)!.push(market);
  }

  for (const [key, group] of raceGroups) {
    if (group.length < 2) continue;
    const race = key.split("::")[1];
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        edges.push({
          sourceMarketId: group[i].id,
          targetMarketId: group[j].id,
          relationClass: "logical",
          relationType: "mutually_exclusive",
          score: 1.0,
          confidence: 1.0,
          mathematicalSemantics: "P(A AND B) = 0; at most one candidate can win the same race",
          modelVersion: "structural-v2",
          evidence: {
            constraintType: "mutual_exclusion",
            collectivelyExhaustive: false,
            reason: `at most one candidate can win "${race}"`,
          },
        });
      }
    }
  }

  return edges;
}

const BUCKET_PATTERNS: Array<{
  base: RegExp;
  range: RegExp;
  description: string;
}> = [
  {
    base: /(?:seasonally\s+adjusted\s+)?(?:u\.?s\.?\s+)?(?:unemployment\s+rate|jobless\s+rate)\s+(?:on|for|in)\s+(.+?)(?:\s+be\s+|\s+between\s+|\s+(?:above|below|over|under|at\s+or\s+above|at\s+or\s+below)\s+)/i,
    range: /(\d+\.?\d*%?\s*(?:to|and|-)\s*\d+\.?\d*%?|(?:above|below|over|under|at\s+or\s+above|at\s+or\s+below)\s+\d+\.?\d*%?)/i,
    description: "unemployment rate buckets for the same release",
  },
  {
    base: /(?:u\.?s\.?\s+)?(?:cpi|consumer\s+price\s+index|inflation)\s+(?:on|for|in)\s+(.+?)(?:\s+be\s+|\s+between\s+|\s+(?:above|below|over|under)\s+)/i,
    range: /(\d+\.?\d*%?\s*(?:to|and|-)\s*\d+\.?\d*%?|(?:above|below|over|under|at\s+or\s+above|at\s+or\s+below)\s+\d+\.?\d*%?)/i,
    description: "CPI/inflation buckets for the same release",
  },
  {
    base: /(?:u\.?s\.?\s+)?(?:gdp|gross\s+domestic\s+product)\s+(?:growth\s+)?(?:on|for|in)\s+(.+?)(?:\s+be\s+|\s+between\s+|\s+(?:above|below|over|under)\s+)/i,
    range: /(\d+\.?\d*%?\s*(?:to|and|-)\s*\d+\.?\d*%?|(?:above|below|over|under|at\s+or\s+above|at\s+or\s+below)\s+\d+\.?\d*%?)/i,
    description: "GDP buckets for the same release",
  },
  {
    base: /(?:fed\s+funds?\s+rate|federal\s+funds?\s+rate|interest\s+rate)\s+(?:on|for|in|at|after)\s+(.+?)(?:\s+be\s+|\s+between\s+|\s+(?:above|below|over|under)\s+)/i,
    range: /(\d+\.?\d*%?\s*(?:to|and|-)\s*\d+\.?\d*%?|(?:above|below|over|under|at\s+or\s+above|at\s+or\s+below)\s+\d+\.?\d*%?)/i,
    description: "interest rate buckets for the same meeting/date",
  },
];

function extractBucketInfo(title: string): { metric: string; date: string; range: string } | null {
  for (const pattern of BUCKET_PATTERNS) {
    const baseMatch = title.match(pattern.base);
    const rangeMatch = title.match(pattern.range);
    if (baseMatch && rangeMatch) {
      return {
        metric: pattern.description,
        date: baseMatch[1].trim().toLowerCase(),
        range: rangeMatch[1].trim().toLowerCase(),
      };
    }
  }
  return null;
}

function detectBucketExclusion(markets: MarketRecord[]): StructuralEdge[] {
  const edges: StructuralEdge[] = [];
  const bucketGroups = new Map<string, Array<{ market: MarketRecord; range: string }>>();

  for (const market of markets) {
    const info = extractBucketInfo(market.title);
    if (!info) continue;
    const key = `${market.platform}::${info.metric}::${info.date}`;
    if (!bucketGroups.has(key)) bucketGroups.set(key, []);
    bucketGroups.get(key)!.push({ market, range: info.range });
  }

  for (const [, group] of bucketGroups) {
    if (group.length < 2) continue;

    const uniqueRanges = new Set(group.map((g) => g.range));
    if (uniqueRanges.size < 2) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (group[i].range === group[j].range) continue;
        edges.push({
          sourceMarketId: group[i].market.id,
          targetMarketId: group[j].market.id,
          relationClass: "logical",
          relationType: "mutually_exclusive",
          score: 1.0,
          confidence: 1.0,
          mathematicalSemantics: "P(A AND B) = 0; non-overlapping range buckets for the same data release are mutually exclusive",
          modelVersion: "structural-v2",
          evidence: {
            constraintType: "mutual_exclusion",
            collectivelyExhaustive: group.length >= 3,
            reason: `non-overlapping buckets (${group[i].range} vs ${group[j].range}) for the same metric/date`,
          },
        });
      }
    }
  }

  return edges;
}

function normalizeQuestion(title: string): string {
  return title
    .toLowerCase()
    .replace(/^will\s+/, "")
    .replace(/\?+$/, "")
    .replace(/\s+/g, " ")
    .replace(/\b(the|a|an)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectCrossPlatformComplement(markets: MarketRecord[]): StructuralEdge[] {
  const edges: StructuralEdge[] = [];
  const byPlatform = new Map<string, MarketRecord[]>();

  for (const market of markets) {
    if (!byPlatform.has(market.platform)) byPlatform.set(market.platform, []);
    byPlatform.get(market.platform)!.push(market);
  }

  const platforms = Array.from(byPlatform.keys());
  if (platforms.length < 2) return edges;

  for (let pi = 0; pi < platforms.length; pi++) {
    for (let pj = pi + 1; pj < platforms.length; pj++) {
      const marketsA = byPlatform.get(platforms[pi])!;
      const marketsB = byPlatform.get(platforms[pj])!;

      const normalizedB = new Map<string, MarketRecord>();
      for (const m of marketsB) {
        normalizedB.set(normalizeQuestion(m.title), m);
      }

      for (const mA of marketsA) {
        const normA = normalizeQuestion(mA.title);
        const match = normalizedB.get(normA);
        if (match) {
          edges.push({
            sourceMarketId: mA.id,
            targetMarketId: match.id,
            relationClass: "logical",
            relationType: "complement",
            score: 1.0,
            confidence: 1.0,
            mathematicalSemantics: "P(A XOR B) = 0; same binary question on different platforms, resolves to the same truth value",
            modelVersion: "structural-v2",
            evidence: {
              constraintType: "complement",
              collectivelyExhaustive: true,
              reason: `same binary question on ${platforms[pi]} and ${platforms[pj]}`,
            },
          });
        }
      }
    }
  }

  return edges;
}

function shareSubjectMatter(a: MarketRecord, b: MarketRecord): boolean {
  if (a.platform !== b.platform) return false;

  const textA = [a.title, a.description ?? ""].join(" ").toLowerCase();
  const textB = [b.title, b.description ?? ""].join(" ").toLowerCase();

  const significantWords = new Set<string>();
  const stopWords = new Set(["will", "the", "and", "that", "this", "with", "for", "from", "have", "been"]);
  const wordsA = textA.split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w));
  for (const word of wordsA) {
    if (textB.includes(word)) significantWords.add(word);
  }

  return significantWords.size >= 3;
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
            relationClass: "logical",
            relationType: "implies",
            score: 1.0,
            confidence: 1.0,
            mathematicalSemantics: "if source resolves YES, target must resolve YES",
            modelVersion: "structural-v2",
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

function deduplicateEdges(edges: StructuralEdge[]): StructuralEdge[] {
  const seen = new Set<string>();
  const result: StructuralEdge[] = [];

  for (const edge of edges) {
    const a = edge.sourceMarketId < edge.targetMarketId ? edge.sourceMarketId : edge.targetMarketId;
    const b = edge.sourceMarketId < edge.targetMarketId ? edge.targetMarketId : edge.sourceMarketId;
    const key = `${a}::${b}::${edge.relationType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(edge);
  }

  return result;
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
  logger.info("mutual exclusion edges (metadata)", { count: mutualExclusion.length });

  const sameRace = detectSameRaceExclusion(activeMarkets);
  logger.info("same-race exclusion edges", { count: sameRace.length });

  const buckets = detectBucketExclusion(activeMarkets);
  logger.info("bucket exclusion edges", { count: buckets.length });

  const crossPlatform = detectCrossPlatformComplement(activeMarkets);
  logger.info("cross-platform complement edges", { count: crossPlatform.length });

  const implications = detectImplications(activeMarkets);
  logger.info("implication edges", { count: implications.length });

  const allEdges = deduplicateEdges([
    ...mutualExclusion,
    ...sameRace,
    ...buckets,
    ...crossPlatform,
    ...implications,
  ]);
  logger.info("structural detection complete", { edgesFound: allEdges.length });

  return allEdges;
}
