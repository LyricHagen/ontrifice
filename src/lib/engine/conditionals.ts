import { db, schema } from "@/db";
import { eq, and, or } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";

const MODEL_VERSION = "bernoulli-joint-v1";

type ConfidenceBasis = "direct_observation" | "path_inference";
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

interface ConditionalResult {
  probability: number;
  confidenceLevel: ConfidenceLevel;
  confidenceBasis: ConfidenceBasis;
  assumptions: string;
  derivationPath: string[];
  conditionMarket: { id: string; title: string; probability: number };
  targetMarket: { id: string; title: string; probability: number };
}

export async function computeConditional(
  conditionMarketId: string,
  targetMarketId: string,
): Promise<ConditionalResult> {
  logger.info("computing model-implied probability", {
    condition: conditionMarketId,
    target: targetMarketId,
  });

  const [conditionMarket] = await db
    .select({
      id: schema.markets.id,
      title: schema.markets.title,
      currentProbability: schema.markets.currentProbability,
    })
    .from(schema.markets)
    .where(eq(schema.markets.id, conditionMarketId));

  const [targetMarket] = await db
    .select({
      id: schema.markets.id,
      title: schema.markets.title,
      currentProbability: schema.markets.currentProbability,
    })
    .from(schema.markets)
    .where(eq(schema.markets.id, targetMarketId));

  if (!conditionMarket) {
    throw new AppError(
      "ERR_MARKET_NOT_FOUND",
      404,
      `Condition market ${conditionMarketId} not found. Verify the market ID is correct and the market hasn't been removed.`,
      { marketId: conditionMarketId },
    );
  }

  if (!targetMarket) {
    throw new AppError(
      "ERR_MARKET_NOT_FOUND",
      404,
      `Target market ${targetMarketId} not found. Verify the market ID is correct and the market hasn't been removed.`,
      { marketId: targetMarketId },
    );
  }

  if (!conditionMarket.currentProbability || !targetMarket.currentProbability) {
    throw new AppError(
      "ERR_INSUFFICIENT_DATA",
      422,
      "One or both markets lack probability data. Markets need at least one recorded probability to compute model-implied probabilities.",
      { condition: conditionMarketId, target: targetMarketId },
    );
  }

  const pA = parseFloat(conditionMarket.currentProbability);
  const pB = parseFloat(targetMarket.currentProbability);

  if (pA < 0.001) {
    throw new AppError(
      "ERR_DEGENERATE_CONDITION",
      422,
      `The condition market "${conditionMarket.title}" has near-zero probability (${(pA * 100).toFixed(2)}%). ` +
        "Conditioning on near-impossible events produces unreliable estimates.",
      { conditionProbability: pA },
    );
  }

  const directEdge = await findDirectEdge(conditionMarketId, targetMarketId);

  if (directEdge) {
    const result = computeFromDirectEdge(pA, pB, directEdge);
    const confidenceLevel = classifyConfidence(
      "direct_observation",
      directEdge.sampleSize,
    );

    const assumptions =
      `Joint probability computed via Bernoulli correlation formula: ` +
      `P(A,B) = P(A)*P(B) + r*sqrt(P(A)*(1-P(A))*P(B)*(1-P(B))). ` +
      `This is exact for binary random variables given the true Pearson correlation. ` +
      `The correlation r=${directEdge.score.toFixed(4)} is an estimate from ${directEdge.sampleSize ?? "unknown"} observations.`;

    await db.insert(schema.impliedConditionals).values({
      conditionMarketId,
      targetMarketId,
      conditionalProbability: result.conditional.toFixed(8),
      confidence: confidenceLevel === "HIGH" ? "0.90000000" : confidenceLevel === "MEDIUM" ? "0.60000000" : "0.30000000",
      derivationPath: [conditionMarketId, targetMarketId],
      confidenceBasis: "direct_observation",
      modelVersion: MODEL_VERSION,
      assumptions,
    });

    logger.info("model-implied probability computed (direct edge)", {
      conditional: result.conditional,
      confidenceLevel,
      joint: result.joint,
      clamped: result.clamped,
    });

    return {
      probability: result.conditional,
      confidenceLevel,
      confidenceBasis: "direct_observation",
      assumptions,
      derivationPath: [conditionMarketId, targetMarketId],
      conditionMarket: {
        id: conditionMarket.id,
        title: conditionMarket.title,
        probability: pA,
      },
      targetMarket: {
        id: targetMarket.id,
        title: targetMarket.title,
        probability: pB,
      },
    };
  }

  const path = await findStrongestPath(conditionMarketId, targetMarketId);

  if (!path) {
    throw new AppError(
      "ERR_NO_PATH",
      404,
      "No dependency path found between these markets. They may be genuinely independent.",
      { condition: conditionMarketId, target: targetMarketId },
    );
  }

  const pathCorrelation = estimatePathCorrelation(path.weights);
  const result = computeJointAndConditional(pA, pB, pathCorrelation);

  const assumptions =
    `Path-inferred estimate through ${path.pathLength} intermediate edge(s). ` +
    `Correlation along path estimated by multiplying edge correlations (product = ${pathCorrelation.toFixed(4)}). ` +
    `This assumes conditional independence along the path, which may not hold. ` +
    `Joint probability formula: P(A,B) = P(A)*P(B) + r*sqrt(P(A)*(1-P(A))*P(B)*(1-P(B))).`;

  await db.insert(schema.impliedConditionals).values({
    conditionMarketId,
    targetMarketId,
    conditionalProbability: result.conditional.toFixed(8),
    confidence: "0.30000000",
    derivationPath: path.path,
    confidenceBasis: "path_inference",
    modelVersion: MODEL_VERSION,
    assumptions,
  });

  logger.info("model-implied probability computed (path inference)", {
    conditional: result.conditional,
    pathLength: path.pathLength,
    pathCorrelation,
    clamped: result.clamped,
  });

  return {
    probability: result.conditional,
    confidenceLevel: "LOW",
    confidenceBasis: "path_inference",
    assumptions,
    derivationPath: path.path,
    conditionMarket: {
      id: conditionMarket.id,
      title: conditionMarket.title,
      probability: pA,
    },
    targetMarket: {
      id: targetMarket.id,
      title: targetMarket.title,
      probability: pB,
    },
  };
}

interface DirectEdge {
  score: number;
  sampleSize: number | null;
}

async function findDirectEdge(
  sourceId: string,
  targetId: string,
): Promise<DirectEdge | null> {
  const [edge] = await db
    .select({
      score: schema.edges.score,
      sampleSize: schema.edges.sampleSize,
    })
    .from(schema.edges)
    .where(
      and(
        eq(schema.edges.relationClass, "statistical"),
        or(
          and(
            eq(schema.edges.sourceMarketId, sourceId),
            eq(schema.edges.targetMarketId, targetId),
          ),
          and(
            eq(schema.edges.sourceMarketId, targetId),
            eq(schema.edges.targetMarketId, sourceId),
          ),
        ),
      ),
    );

  if (!edge) return null;

  return {
    score: parseFloat(edge.score),
    sampleSize: edge.sampleSize,
  };
}

function classifyConfidence(
  basis: ConfidenceBasis,
  sampleSize: number | null,
): ConfidenceLevel {
  if (basis === "path_inference") return "LOW";
  if (sampleSize !== null && sampleSize >= 30) return "HIGH";
  return "MEDIUM";
}

function computeFromDirectEdge(
  pA: number,
  pB: number,
  edge: DirectEdge,
): { joint: number; conditional: number; clamped: boolean } {
  return computeJointAndConditional(pA, pB, edge.score);
}

function computeJointAndConditional(
  pA: number,
  pB: number,
  r: number,
): { joint: number; conditional: number; clamped: boolean } {
  const frechetLower = Math.max(0, pA + pB - 1);
  const frechetUpper = Math.min(pA, pB);

  const sigma = Math.sqrt(pA * (1 - pA) * pB * (1 - pB));
  let joint = pA * pB + r * sigma;
  let clamped = false;

  if (joint < frechetLower) {
    logger.warn("joint probability below Frechet lower bound, clamping", undefined, {
      computed: joint,
      frechetLower,
      frechetUpper,
      r,
      pA,
      pB,
    });
    joint = frechetLower;
    clamped = true;
  } else if (joint > frechetUpper) {
    logger.warn("joint probability above Frechet upper bound, clamping", undefined, {
      computed: joint,
      frechetLower,
      frechetUpper,
      r,
      pA,
      pB,
    });
    joint = frechetUpper;
    clamped = true;
  }

  const conditional = joint / pA;

  return {
    joint,
    conditional: Math.max(0, Math.min(1, conditional)),
    clamped,
  };
}

interface PathResult {
  path: string[];
  weights: number[];
  minWeight: number;
  pathLength: number;
}

async function findStrongestPath(
  sourceId: string,
  targetId: string,
): Promise<PathResult | null> {
  const allEdges = await db.select().from(schema.edges);

  const adjacency = new Map<string, Array<{ neighbor: string; weight: number }>>();
  for (const edge of allEdges) {
    const w = parseFloat(edge.score);
    if (!adjacency.has(edge.sourceMarketId)) adjacency.set(edge.sourceMarketId, []);
    if (!adjacency.has(edge.targetMarketId)) adjacency.set(edge.targetMarketId, []);
    adjacency.get(edge.sourceMarketId)!.push({ neighbor: edge.targetMarketId, weight: w });
    adjacency.get(edge.targetMarketId)!.push({ neighbor: edge.sourceMarketId, weight: w });
  }

  if (!adjacency.has(sourceId) || !adjacency.has(targetId)) return null;

  const maxMinWeight = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();

  maxMinWeight.set(sourceId, 1);

  while (true) {
    let bestNode: string | null = null;
    let bestWeight = -1;

    for (const [node, w] of maxMinWeight) {
      if (!visited.has(node) && w > bestWeight) {
        bestWeight = w;
        bestNode = node;
      }
    }

    if (bestNode === null) break;
    if (bestNode === targetId) break;

    visited.add(bestNode);

    const neighbors = adjacency.get(bestNode) ?? [];
    for (const { neighbor, weight } of neighbors) {
      if (visited.has(neighbor)) continue;
      const pathWeight = Math.min(bestWeight, weight);
      if (pathWeight > (maxMinWeight.get(neighbor) ?? 0)) {
        maxMinWeight.set(neighbor, pathWeight);
        prev.set(neighbor, bestNode);
      }
    }
  }

  if (!prev.has(targetId) && sourceId !== targetId) return null;

  const path: string[] = [];
  let current: string | undefined = targetId;
  while (current !== undefined) {
    path.unshift(current);
    current = prev.get(current);
  }

  if (path[0] !== sourceId) return null;

  const weights: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const neighbors = adjacency.get(path[i]) ?? [];
    const edge = neighbors.find((n) => n.neighbor === path[i + 1]);
    if (edge) weights.push(edge.weight);
  }

  return {
    path,
    weights,
    minWeight: Math.min(...weights),
    pathLength: path.length - 1,
  };
}

function estimatePathCorrelation(weights: number[]): number {
  let correlation = 1;
  for (const w of weights) {
    correlation *= w;
  }
  return correlation;
}
