import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";

interface ConditionalResult {
  conditionalProbability: number;
  confidence: number;
  derivationPath: string[];
  conditionMarket: { id: string; title: string; probability: number };
  targetMarket: { id: string; title: string; probability: number };
}

export async function computeConditional(
  conditionMarketId: string,
  targetMarketId: string,
): Promise<ConditionalResult> {
  logger.info("computing implied conditional", {
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
      "One or both markets lack probability data. Markets need at least one recorded probability to compute conditionals.",
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

  const path = await findStrongestPath(conditionMarketId, targetMarketId);

  if (!path) {
    throw new AppError(
      "ERR_NO_PATH",
      404,
      "No dependency path found between these markets. They may be genuinely independent.",
      { condition: conditionMarketId, target: targetMarketId },
    );
  }

  const correlation = estimateCorrelationFromPath(path.weights);
  const pAB = estimateJointProbability(pA, pB, correlation);
  const pBgivenA = pAB / pA;
  const clampedConditional = Math.max(0, Math.min(1, pBgivenA));

  const pathConfidence = path.minWeight;
  const confidence = pathConfidence * (1 / path.pathLength) * (pA > 0.1 ? 1 : pA * 10);

  await db.insert(schema.impliedConditionals).values({
    conditionMarketId,
    targetMarketId,
    conditionalProbability: clampedConditional.toFixed(8),
    confidence: Math.min(confidence, 1).toFixed(8),
    derivationPath: path.path,
  });

  logger.info("conditional computed", {
    conditional: clampedConditional,
    confidence,
    pathLength: path.pathLength,
  });

  return {
    conditionalProbability: clampedConditional,
    confidence: Math.min(confidence, 1),
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
    const w = parseFloat(edge.weight);
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

function estimateCorrelationFromPath(weights: number[]): number {
  let correlation = 1;
  for (const w of weights) {
    correlation *= w;
  }
  return correlation;
}

function estimateJointProbability(
  pA: number,
  pB: number,
  correlation: number,
): number {
  const independent = pA * pB;
  const maxJoint = Math.min(pA, pB);
  return independent + correlation * (maxJoint - independent);
}
