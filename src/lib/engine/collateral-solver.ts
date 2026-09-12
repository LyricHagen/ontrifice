import { db, schema } from "@/db";
import { inArray, or, and, eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

export interface PositionInput {
  marketId: string;
  side: "YES" | "NO";
  size: number;
  avgPrice: number;
}

export interface Constraint {
  type: "mutual_exclusion" | "implication" | "mutual_exclusion_exhaustive" | "complement";
  marketIndexA: number;
  marketIndexB: number;
  marketIdA: string;
  marketIdB: string;
  confidence: number;
  edgeId: string;
  isStructural: boolean;
}

export interface BindingConstraintResult {
  marketIdA: string;
  marketIdB: string;
  marketTitleA: string;
  marketTitleB: string;
  relationshipType: string;
  riskReduced: number;
  edgeId: string;
  confidence: number;
}

export interface PositionPnl {
  marketId: string;
  marketTitle: string;
  side: "YES" | "NO";
  size: number;
  avgPrice: number;
  resolution: boolean;
  pnl: number;
}

export interface CollateralAnalysis {
  independentMaxLoss: number;
  trueMaxLoss: number;
  riskReduction: number;
  reductionPct: number;
  constraintCount: number;
  bindingConstraints: BindingConstraintResult[];
  worstCase: {
    resolutions: Record<string, boolean>;
    positionPnls: PositionPnl[];
    totalLoss: number;
  };
  warnings: string[];
}

function positionPayoff(
  side: "YES" | "NO",
  size: number,
  avgPrice: number,
  resolvesYes: boolean,
): number {
  if (side === "YES") {
    return resolvesYes ? size * (1 - avgPrice) : -size * avgPrice;
  }
  return resolvesYes ? -size * (1 - avgPrice) : size * avgPrice;
}

function positionMaxLoss(side: "YES" | "NO", size: number, avgPrice: number): number {
  const lossIfYes = positionPayoff(side, size, avgPrice, true);
  const lossIfNo = positionPayoff(side, size, avgPrice, false);
  return Math.max(0, -Math.min(lossIfYes, lossIfNo));
}

function portfolioValue(
  positions: PositionInput[],
  resolutions: boolean[],
): number {
  let total = 0;
  for (let i = 0; i < positions.length; i++) {
    total += positionPayoff(
      positions[i].side,
      positions[i].size,
      positions[i].avgPrice,
      resolutions[i],
    );
  }
  return total;
}

function isFeasible(resolutions: boolean[], constraints: Constraint[]): boolean {
  for (const c of constraints) {
    const a = resolutions[c.marketIndexA];
    const b = resolutions[c.marketIndexB];
    switch (c.type) {
      case "mutual_exclusion":
        if (a && b) return false;
        break;
      case "mutual_exclusion_exhaustive":
        if (a && b) return false;
        if (!a && !b) return false;
        break;
      case "complement":
        if (a !== b) return false;
        break;
      case "implication":
        if (a && !b) return false;
        break;
    }
  }
  return true;
}

function canPrunePrefix(
  prefix: boolean[],
  prefixLen: number,
  constraints: Constraint[],
): boolean {
  for (const c of constraints) {
    const aSet = c.marketIndexA < prefixLen;
    const bSet = c.marketIndexB < prefixLen;

    if (!aSet && !bSet) continue;

    const a = aSet ? prefix[c.marketIndexA] : false;
    const b = bSet ? prefix[c.marketIndexB] : false;

    switch (c.type) {
      case "mutual_exclusion":
        if (aSet && bSet && a && b) return true;
        break;
      case "mutual_exclusion_exhaustive":
        if (aSet && bSet && a && b) return true;
        if (aSet && bSet && !a && !b) return true;
        break;
      case "complement":
        if (aSet && bSet && a !== b) return true;
        break;
      case "implication":
        if (aSet && bSet && a && !b) return true;
        break;
    }
  }
  return false;
}

async function fetchConstraints(
  marketIds: string[],
  marketIndexMap: Map<string, number>,
): Promise<Constraint[]> {
  if (marketIds.length < 2) return [];

  const edges = await db
    .select({
      id: schema.edges.id,
      sourceMarketId: schema.edges.sourceMarketId,
      targetMarketId: schema.edges.targetMarketId,
      relationClass: schema.edges.relationClass,
      relationType: schema.edges.relationType,
      confidence: schema.edges.confidence,
      evidence: schema.edges.evidence,
    })
    .from(schema.edges)
    .where(
      and(
        inArray(schema.edges.sourceMarketId, marketIds),
        inArray(schema.edges.targetMarketId, marketIds),
      ),
    );

  const constraints: Constraint[] = [];

  for (const edge of edges) {
    const idxA = marketIndexMap.get(edge.sourceMarketId);
    const idxB = marketIndexMap.get(edge.targetMarketId);
    if (idxA === undefined || idxB === undefined) continue;

    const confidence = parseFloat(edge.confidence);
    const isStructural = edge.relationClass === "logical";
    const evidence = edge.evidence as Record<string, unknown> | null;
    const isExhaustive = evidence?.collectivelyExhaustive === true;

    if (edge.relationType === "mutually_exclusive") {
      constraints.push({
        type: isExhaustive ? "mutual_exclusion_exhaustive" : "mutual_exclusion",
        marketIndexA: idxA,
        marketIndexB: idxB,
        marketIdA: edge.sourceMarketId,
        marketIdB: edge.targetMarketId,
        confidence,
        edgeId: edge.id,
        isStructural,
      });
    } else if (edge.relationType === "complement") {
      constraints.push({
        type: "complement",
        marketIndexA: idxA,
        marketIndexB: idxB,
        marketIdA: edge.sourceMarketId,
        marketIdB: edge.targetMarketId,
        confidence,
        edgeId: edge.id,
        isStructural,
      });
    } else if (edge.relationType === "implies") {
      constraints.push({
        type: "implication",
        marketIndexA: idxA,
        marketIndexB: idxB,
        marketIdA: edge.sourceMarketId,
        marketIdB: edge.targetMarketId,
        confidence,
        edgeId: edge.id,
        isStructural,
      });
    }
  }

  return constraints;
}

function solveMaxLoss(
  positions: PositionInput[],
  constraints: Constraint[],
): { maxLoss: number; worstCaseResolutions: boolean[] } {
  const n = positions.length;

  if (n > 25) {
    return solveMaxLossGreedy(positions, constraints);
  }

  const resolutions = new Array<boolean>(n).fill(false);
  let maxLoss = -Infinity;
  let worstCase = new Array<boolean>(n).fill(false);

  function enumerate(idx: number) {
    if (idx === n) {
      if (!isFeasible(resolutions, constraints)) return;
      const loss = -portfolioValue(positions, resolutions);
      if (loss > maxLoss) {
        maxLoss = loss;
        worstCase = [...resolutions];
      }
      return;
    }

    for (const val of [false, true]) {
      resolutions[idx] = val;
      if (!canPrunePrefix(resolutions, idx + 1, constraints)) {
        enumerate(idx + 1);
      }
    }
  }

  enumerate(0);

  return { maxLoss: Math.max(0, maxLoss), worstCaseResolutions: worstCase };
}

function solveMaxLossGreedy(
  positions: PositionInput[],
  constraints: Constraint[],
): { maxLoss: number; worstCaseResolutions: boolean[] } {
  const n = positions.length;
  const resolutions = new Array<boolean>(n).fill(false);

  for (let i = 0; i < n; i++) {
    const lossIfYes = -positionPayoff(positions[i].side, positions[i].size, positions[i].avgPrice, true);
    const lossIfNo = -positionPayoff(positions[i].side, positions[i].size, positions[i].avgPrice, false);
    resolutions[i] = lossIfYes > lossIfNo;
  }

  for (let iter = 0; iter < n * 2; iter++) {
    let improved = false;
    for (let i = 0; i < n; i++) {
      resolutions[i] = !resolutions[i];
      if (isFeasible(resolutions, constraints)) {
        const newLoss = -portfolioValue(positions, resolutions);
        resolutions[i] = !resolutions[i];
        const oldLoss = -portfolioValue(positions, resolutions);
        if (newLoss > oldLoss) {
          resolutions[i] = !resolutions[i];
          improved = true;
        }
      } else {
        resolutions[i] = !resolutions[i];
      }
    }
    if (!improved) break;
  }

  const maxLoss = Math.max(0, -portfolioValue(positions, resolutions));
  return { maxLoss, worstCaseResolutions: resolutions };
}

export async function analyzePortfolio(
  inputPositions: PositionInput[],
): Promise<CollateralAnalysis> {
  const warnings: string[] = [];

  if (inputPositions.length === 0) {
    return {
      independentMaxLoss: 0,
      trueMaxLoss: 0,
      riskReduction: 0,
      reductionPct: 0,
      constraintCount: 0,
      bindingConstraints: [],
      worstCase: { resolutions: {}, positionPnls: [], totalLoss: 0 },
      warnings: ["No positions provided."],
    };
  }

  const uniqueMarketIds = [...new Set(inputPositions.map((p) => p.marketId))];
  const marketIndexMap = new Map<string, number>();

  const consolidatedPositions: PositionInput[] = [];
  const marketIdToPositionIndices = new Map<string, number[]>();

  for (const pos of inputPositions) {
    let idx = marketIndexMap.get(pos.marketId);
    if (idx === undefined) {
      idx = consolidatedPositions.length;
      marketIndexMap.set(pos.marketId, idx);
      consolidatedPositions.push({ ...pos });
      marketIdToPositionIndices.set(pos.marketId, [inputPositions.indexOf(pos)]);
    } else {
      marketIdToPositionIndices.get(pos.marketId)!.push(inputPositions.indexOf(pos));
    }
  }

  const marketTitles = new Map<string, string>();
  if (uniqueMarketIds.length > 0) {
    const marketsData = await db
      .select({ id: schema.markets.id, title: schema.markets.title })
      .from(schema.markets)
      .where(inArray(schema.markets.id, uniqueMarketIds));
    for (const m of marketsData) {
      marketTitles.set(m.id, m.title);
    }
  }

  let independentMaxLoss = 0;
  for (const pos of inputPositions) {
    independentMaxLoss += positionMaxLoss(pos.side, pos.size, pos.avgPrice);
  }

  const constraints = await fetchConstraints(uniqueMarketIds, marketIndexMap);

  if (constraints.length === 0) {
    warnings.push(
      "No structural constraints found between these positions. " +
      "Each position's max loss is independent.",
    );
  }

  const semanticOnly = constraints.length > 0 && constraints.every((c) => !c.isStructural);
  if (semanticOnly) {
    warnings.push(
      "All relationships in this portfolio are semantic similarity, not structural proof. " +
      "Risk reduction estimates should be treated as approximate.",
    );
  }

  if (inputPositions.length > 25) {
    warnings.push(
      "Portfolio has more than 25 markets. Using greedy approximation instead of exact enumeration. " +
      "Results may slightly underestimate true max loss.",
    );
  }

  logger.info("solving max loss", {
    positions: consolidatedPositions.length,
    constraints: constraints.length,
  });

  const { maxLoss, worstCaseResolutions } = solveMaxLoss(
    consolidatedPositions,
    constraints,
  );

  const trueMaxLoss = maxLoss;
  const riskReduction = Math.max(0, independentMaxLoss - trueMaxLoss);
  const reductionPct = independentMaxLoss > 0 ? (riskReduction / independentMaxLoss) * 100 : 0;

  const bindingConstraints = computeBindingConstraints(
    consolidatedPositions,
    constraints,
    marketTitles,
  );

  const resolutionMap: Record<string, boolean> = {};
  const positionPnls: PositionPnl[] = [];

  for (const pos of inputPositions) {
    const idx = marketIndexMap.get(pos.marketId)!;
    const resolved = worstCaseResolutions[idx];
    resolutionMap[pos.marketId] = resolved;
    positionPnls.push({
      marketId: pos.marketId,
      marketTitle: marketTitles.get(pos.marketId) ?? "Unknown",
      side: pos.side,
      size: pos.size,
      avgPrice: pos.avgPrice,
      resolution: resolved,
      pnl: positionPayoff(pos.side, pos.size, pos.avgPrice, resolved),
    });
  }

  return {
    independentMaxLoss,
    trueMaxLoss,
    riskReduction,
    reductionPct,
    constraintCount: constraints.length,
    bindingConstraints,
    worstCase: {
      resolutions: resolutionMap,
      positionPnls,
      totalLoss: maxLoss,
    },
    warnings,
  };
}

function computeBindingConstraints(
  positions: PositionInput[],
  constraints: Constraint[],
  marketTitles: Map<string, string>,
): BindingConstraintResult[] {
  if (constraints.length === 0) return [];

  const fullResult = solveMaxLoss(positions, constraints);
  const results: BindingConstraintResult[] = [];

  for (let i = 0; i < constraints.length; i++) {
    const reduced = constraints.filter((_, j) => j !== i);
    const withoutResult = solveMaxLoss(positions, reduced);
    const saved = withoutResult.maxLoss - fullResult.maxLoss;

    if (saved > 0.001) {
      const c = constraints[i];
      results.push({
        marketIdA: c.marketIdA,
        marketIdB: c.marketIdB,
        marketTitleA: marketTitles.get(c.marketIdA) ?? "Unknown",
        marketTitleB: marketTitles.get(c.marketIdB) ?? "Unknown",
        relationshipType: c.type,
        riskReduced: saved,
        edgeId: c.edgeId,
        confidence: c.confidence,
      });
    }
  }

  results.sort((a, b) => b.riskReduced - a.riskReduced);
  return results;
}

export async function suggestPositions(
  currentPositions: PositionInput[],
): Promise<Array<{ marketId: string; marketTitle: string; relationshipCount: number; potentialReduction: string }>> {
  const currentMarketIds = [...new Set(currentPositions.map((p) => p.marketId))];
  if (currentMarketIds.length === 0) return [];

  const relatedEdges = await db
    .select({
      sourceMarketId: schema.edges.sourceMarketId,
      targetMarketId: schema.edges.targetMarketId,
      relationClass: schema.edges.relationClass,
      relationType: schema.edges.relationType,
    })
    .from(schema.edges)
    .where(
      or(
        inArray(schema.edges.sourceMarketId, currentMarketIds),
        inArray(schema.edges.targetMarketId, currentMarketIds),
      ),
    );

  const candidateCounts = new Map<string, number>();
  for (const edge of relatedEdges) {
    if (edge.relationClass !== "logical") continue;
    const otherId = currentMarketIds.includes(edge.sourceMarketId)
      ? edge.targetMarketId
      : edge.sourceMarketId;
    if (currentMarketIds.includes(otherId)) continue;
    candidateCounts.set(otherId, (candidateCounts.get(otherId) ?? 0) + 1);
  }

  const topCandidates = [...candidateCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (topCandidates.length === 0) return [];

  const candidateIds = topCandidates.map(([id]) => id);
  const marketsData = await db
    .select({ id: schema.markets.id, title: schema.markets.title })
    .from(schema.markets)
    .where(inArray(schema.markets.id, candidateIds));

  const titleMap = new Map<string, string>();
  for (const m of marketsData) {
    titleMap.set(m.id, m.title);
  }

  return topCandidates.map(([id, count]) => ({
    marketId: id,
    marketTitle: titleMap.get(id) ?? "Unknown",
    relationshipCount: count,
    potentialReduction: "Depends on position size and direction",
  }));
}
