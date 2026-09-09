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
  edgeType: "semantic" | "temporal" | "structural" | "composite";
  weight: string;
  confidence: string;
  direction: "bidirectional" | "source_leads" | "target_leads";
  evidence: Record<string, unknown> | null;
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

function edgeKey(sourceId: string, targetId: string): string {
  return sourceId < targetId
    ? `${sourceId}:${targetId}`
    : `${targetId}:${sourceId}`;
}

function getEdgeType(
  edge: AnyEdge,
): "semantic" | "temporal" | "structural" {
  if ("evidence" in edge && edge.evidence !== null && typeof edge.evidence === "object") {
    if ("cosineSimilarity" in edge.evidence) return "semantic";
    if ("constraintType" in edge.evidence) return "structural";
    if ("correlation7d" in edge.evidence) return "temporal";
  }
  return "semantic";
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
  logger.info("building unified graph", {
    semantic: semanticEdges.length,
    temporal: temporalEdges.length,
    structural: structuralEdges.length,
  });

  const merged = new Map<string, {
    sourceMarketId: string;
    targetMarketId: string;
    edgeType: "semantic" | "temporal" | "structural" | "composite";
    weight: number;
    confidence: number;
    direction: "bidirectional" | "source_leads" | "target_leads";
    evidence: Record<string, unknown>;
  }>();

  function addEdge(edge: AnyEdge) {
    const key = edgeKey(edge.sourceMarketId, edge.targetMarketId);
    const type = getEdgeType(edge);
    const direction = getDirection(edge);

    if (merged.has(key)) {
      const existing = merged.get(key)!;
      existing.edgeType = "composite";
      existing.weight = Math.max(existing.weight, edge.weight);
      existing.confidence = Math.max(existing.confidence, edge.confidence);
      (existing.evidence as Record<string, unknown>)[type] = edge.evidence;
      if (direction !== "bidirectional" && existing.direction === "bidirectional") {
        existing.direction = direction;
      }
    } else {
      const source = edge.sourceMarketId < edge.targetMarketId
        ? edge.sourceMarketId
        : edge.targetMarketId;
      const target = edge.sourceMarketId < edge.targetMarketId
        ? edge.targetMarketId
        : edge.sourceMarketId;

      merged.set(key, {
        sourceMarketId: source,
        targetMarketId: target,
        edgeType: type,
        weight: edge.weight,
        confidence: edge.confidence,
        direction,
        evidence: { [type]: edge.evidence },
      });
    }
  }

  for (const e of semanticEdges) addEdge(e);
  for (const e of temporalEdges) addEdge(e);
  for (const e of structuralEdges) addEdge(e);

  logger.info("merged edges", { total: merged.size });

  let created = 0;
  let updated = 0;

  for (const edge of merged.values()) {
    const result = await db
      .insert(schema.edges)
      .values({
        sourceMarketId: edge.sourceMarketId,
        targetMarketId: edge.targetMarketId,
        edgeType: edge.edgeType,
        weight: edge.weight.toFixed(8),
        confidence: edge.confidence.toFixed(8),
        direction: edge.direction,
        evidence: edge.evidence,
      })
      .onConflictDoUpdate({
        target: [schema.edges.sourceMarketId, schema.edges.targetMarketId],
        set: {
          edgeType: edge.edgeType,
          weight: edge.weight.toFixed(8),
          confidence: edge.confidence.toFixed(8),
          direction: edge.direction,
          evidence: edge.evidence,
          updatedAt: new Date(),
        },
      })
      .returning({ id: schema.edges.id, createdAt: schema.edges.createdAt, updatedAt: schema.edges.updatedAt });

    if (result.length > 0) {
      const r = result[0];
      if (r.createdAt.getTime() === r.updatedAt.getTime()) {
        created++;
      } else {
        updated++;
      }
    }
  }

  logger.info("graph build complete", { created, updated });
  return { created, updated };
}

export async function getNeighbors(
  marketId: string,
  depth: number = 1,
): Promise<SubgraphResult> {
  const visitedMarkets = new Set<string>([marketId]);
  const allEdges: EdgeRecord[] = [];
  let frontier = [marketId];

  for (let d = 0; d < depth; d++) {
    if (frontier.length === 0) break;

    const edgesForFrontier = await db
      .select()
      .from(schema.edges)
      .where(
        or(
          inArray(schema.edges.sourceMarketId, frontier),
          inArray(schema.edges.targetMarketId, frontier),
        ),
      );

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
): Promise<{ path: string[]; totalWeight: number } | null> {
  const allEdges = await db.select().from(schema.edges);

  const adjacency = new Map<string, Array<{ neighbor: string; weight: number }>>();
  for (const edge of allEdges) {
    if (!adjacency.has(edge.sourceMarketId)) adjacency.set(edge.sourceMarketId, []);
    if (!adjacency.has(edge.targetMarketId)) adjacency.set(edge.targetMarketId, []);
    const w = parseFloat(edge.weight);
    adjacency.get(edge.sourceMarketId)!.push({ neighbor: edge.targetMarketId, weight: w });
    adjacency.get(edge.targetMarketId)!.push({ neighbor: edge.sourceMarketId, weight: w });
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
    for (const { neighbor, weight } of neighbors) {
      if (visited.has(neighbor)) continue;
      const inverseDist = 1 / weight;
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

  let totalWeight = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const neighbors = adjacency.get(path[i]) ?? [];
    const edge = neighbors.find((n) => n.neighbor === path[i + 1]);
    if (edge) totalWeight += edge.weight;
  }

  return { path, totalWeight };
}

export async function getCluster(marketId: string): Promise<string[]> {
  const allEdges = await db.select().from(schema.edges);

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
  edgeType?: "semantic" | "temporal" | "structural" | "composite";
  minWeight?: number;
  marketId?: string;
  limit?: number;
}): Promise<EdgeRecord[]> {
  const conditions = [];

  if (filters.edgeType) {
    conditions.push(eq(schema.edges.edgeType, filters.edgeType));
  }
  if (filters.minWeight !== undefined) {
    conditions.push(sql`${schema.edges.weight}::numeric >= ${filters.minWeight}`);
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
