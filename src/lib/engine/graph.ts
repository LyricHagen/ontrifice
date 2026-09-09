import { db, schema } from "@/db";
import { eq, or, and, inArray, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";
import type { SemanticEdge } from "./semantic";
import type { TemporalEdge } from "./temporal";
import type { StructuralEdge } from "./structural";

type AnyEdge = SemanticEdge | TemporalEdge | StructuralEdge;

interface EdgeRecord {
  id: string;
  sourceMarketId: string;
  targetMarketId: string;
  relationClass: "logical" | "statistical" | "semantic";
  relationType: string;
  score: string;
  confidence: string;
  direction: "bidirectional" | "source_leads" | "target_leads";
  mathematicalSemantics: string | null;
  evidence: Record<string, unknown> | null;
  modelVersion: string | null;
  algorithmParams: Record<string, unknown> | null;
  observedAt: Date;
  validUntil: Date | null;
  sampleSize: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SubgraphResult {
  markets: Array<{
    id: string;
    title: string;
    currentProbability: string | null;
    category: string | null;
  }>;
  edges: EdgeRecord[];
}

function getDirection(edge: AnyEdge): "bidirectional" | "source_leads" | "target_leads" {
  if ("direction" in edge) return edge.direction;
  return "bidirectional";
}

export async function buildGraph(
  semanticEdges: SemanticEdge[],
  temporalEdges: TemporalEdge[],
  structuralEdges: StructuralEdge[],
): Promise<{ created: number; updated: number }> {
  logger.info("building unified graph (separate edges per relation)", {
    semantic: semanticEdges.length,
    temporal: temporalEdges.length,
    structural: structuralEdges.length,
  });

  const allEdges: AnyEdge[] = [
    ...semanticEdges,
    ...temporalEdges,
    ...structuralEdges,
  ];

  logger.info("total edges to persist", { total: allEdges.length });

  await db
    .update(schema.edges)
    .set({ validUntil: new Date() })
    .where(sql`${schema.edges.validUntil} IS NULL`);

  let created = 0;
  let updated = 0;

  for (const edge of allEdges) {
    const source = edge.sourceMarketId < edge.targetMarketId
      ? edge.sourceMarketId
      : edge.targetMarketId;
    const target = edge.sourceMarketId < edge.targetMarketId
      ? edge.targetMarketId
      : edge.sourceMarketId;

    const existing = await db
      .select({ id: schema.edges.id })
      .from(schema.edges)
      .where(
        and(
          eq(schema.edges.sourceMarketId, source),
          eq(schema.edges.targetMarketId, target),
          eq(schema.edges.relationClass, edge.relationClass),
          eq(schema.edges.relationType, edge.relationType),
        ),
      )
      .limit(1);

    const resolutionMatchStatus = "resolutionMatchStatus" in edge
      ? (edge.resolutionMatchStatus as "verified_equivalent" | "likely_equivalent" | "unverified" | "divergent" | undefined)
      : undefined;

    const values = {
      sourceMarketId: source,
      targetMarketId: target,
      relationClass: edge.relationClass,
      relationType: edge.relationType,
      score: edge.score.toFixed(8),
      confidence: edge.confidence.toFixed(8),
      direction: getDirection(edge),
      mathematicalSemantics: edge.mathematicalSemantics,
      evidence: edge.evidence as Record<string, unknown>,
      modelVersion: edge.modelVersion,
      algorithmParams: "algorithmParams" in edge
        ? (edge.algorithmParams as Record<string, unknown>)
        : null,
      sampleSize: "sampleSize" in edge ? (edge.sampleSize as number) : null,
      resolutionMatchStatus: resolutionMatchStatus ?? null,
      observedAt: new Date(),
      validUntil: null,
    };

    if (existing.length > 0) {
      await db
        .update(schema.edges)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(schema.edges.id, existing[0].id));
      updated++;
    } else {
      await db.insert(schema.edges).values(values);
      created++;
    }
  }

  logger.info("graph build complete", { created, updated });
  return { created, updated };
}

export async function getNeighbors(
  marketId: string,
  depth: number = 1,
  relationClass?: "logical" | "statistical" | "semantic",
): Promise<SubgraphResult> {
  const visitedMarkets = new Set<string>([marketId]);
  const allEdges: EdgeRecord[] = [];
  let frontier = [marketId];

  for (let d = 0; d < depth; d++) {
    if (frontier.length === 0) break;

    const conditions = [
      or(
        inArray(schema.edges.sourceMarketId, frontier),
        inArray(schema.edges.targetMarketId, frontier),
      )!,
    ];

    if (relationClass) {
      conditions.push(eq(schema.edges.relationClass, relationClass));
    }

    const edgesForFrontier = await db
      .select()
      .from(schema.edges)
      .where(and(...conditions));

    const nextFrontier: string[] = [];

    for (const edge of edgesForFrontier) {
      allEdges.push(edge as unknown as EdgeRecord);
      const neighbor =
        edge.sourceMarketId === marketId || visitedMarkets.has(edge.sourceMarketId)
          ? edge.targetMarketId
          : edge.sourceMarketId;

      if (!visitedMarkets.has(neighbor)) {
        visitedMarkets.add(neighbor);
        nextFrontier.push(neighbor);
      }
    }

    frontier = nextFrontier;
  }

  const marketIds = Array.from(visitedMarkets);
  const markets = marketIds.length > 0
    ? await db
        .select({
          id: schema.markets.id,
          title: schema.markets.title,
          currentProbability: schema.markets.currentProbability,
          category: schema.markets.category,
        })
        .from(schema.markets)
        .where(inArray(schema.markets.id, marketIds))
    : [];

  return { markets, edges: allEdges };
}

export async function getPath(
  sourceId: string,
  targetId: string,
  relationClass?: "logical" | "statistical" | "semantic",
): Promise<{ path: string[]; totalScore: number } | null> {
  const conditions = [];
  if (relationClass) {
    conditions.push(eq(schema.edges.relationClass, relationClass));
  }

  const allEdges = conditions.length > 0
    ? await db.select().from(schema.edges).where(and(...conditions))
    : await db.select().from(schema.edges);

  const adjacency = new Map<string, Array<{ neighbor: string; score: number }>>();
  for (const edge of allEdges) {
    if (!adjacency.has(edge.sourceMarketId)) adjacency.set(edge.sourceMarketId, []);
    if (!adjacency.has(edge.targetMarketId)) adjacency.set(edge.targetMarketId, []);
    const s = parseFloat(edge.score);
    adjacency.get(edge.sourceMarketId)!.push({ neighbor: edge.targetMarketId, score: s });
    adjacency.get(edge.targetMarketId)!.push({ neighbor: edge.sourceMarketId, score: s });
  }

  if (!adjacency.has(sourceId) || !adjacency.has(targetId)) return null;

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();

  dist.set(sourceId, 0);

  while (true) {
    let minNode: string | null = null;
    let minDist = Infinity;

    for (const [node, d] of dist) {
      if (!visited.has(node) && d < minDist) {
        minDist = d;
        minNode = node;
      }
    }

    if (minNode === null) break;
    if (minNode === targetId) break;

    visited.add(minNode);

    const neighbors = adjacency.get(minNode) ?? [];
    for (const { neighbor, score } of neighbors) {
      if (visited.has(neighbor)) continue;
      const inverseDist = 1 / score;
      const newDist = minDist + inverseDist;
      if (newDist < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, newDist);
        prev.set(neighbor, minNode);
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

  let totalScore = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const neighbors = adjacency.get(path[i]) ?? [];
    const edge = neighbors.find((n) => n.neighbor === path[i + 1]);
    if (edge) totalScore += edge.score;
  }

  return { path, totalScore };
}

export async function getCluster(
  marketId: string,
  relationClass?: "logical" | "statistical" | "semantic",
): Promise<string[]> {
  const conditions = [];
  if (relationClass) {
    conditions.push(eq(schema.edges.relationClass, relationClass));
  }

  const allEdges = conditions.length > 0
    ? await db.select().from(schema.edges).where(and(...conditions))
    : await db.select().from(schema.edges);

  const adjacency = new Map<string, Set<string>>();
  for (const edge of allEdges) {
    if (!adjacency.has(edge.sourceMarketId)) adjacency.set(edge.sourceMarketId, new Set());
    if (!adjacency.has(edge.targetMarketId)) adjacency.set(edge.targetMarketId, new Set());
    adjacency.get(edge.sourceMarketId)!.add(edge.targetMarketId);
    adjacency.get(edge.targetMarketId)!.add(edge.sourceMarketId);
  }

  if (!adjacency.has(marketId)) return [marketId];

  const visited = new Set<string>();
  const queue = [marketId];
  visited.add(marketId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current) ?? new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return Array.from(visited);
}

export async function getEdges(filters: {
  relationClass?: "logical" | "statistical" | "semantic";
  relationType?: string;
  minScore?: number;
  marketId?: string;
  limit?: number;
}): Promise<EdgeRecord[]> {
  const conditions = [];

  if (filters.relationClass) {
    conditions.push(eq(schema.edges.relationClass, filters.relationClass));
  }
  if (filters.relationType) {
    conditions.push(eq(schema.edges.relationType, filters.relationType));
  }
  if (filters.minScore !== undefined) {
    conditions.push(sql`${schema.edges.score}::numeric >= ${filters.minScore}`);
  }
  if (filters.marketId) {
    conditions.push(
      or(
        eq(schema.edges.sourceMarketId, filters.marketId),
        eq(schema.edges.targetMarketId, filters.marketId),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select()
    .from(schema.edges)
    .where(where)
    .limit(filters.limit ?? 100);

  return result as unknown as EdgeRecord[];
}
