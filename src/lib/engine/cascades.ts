import { db, schema } from "@/db";
import { eq, and, gte, or, desc, inArray, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

interface MarketMovement {
  marketId: string;
  title: string;
  currentProbability: number;
  previousProbability: number;
  delta: number;
  volume: number;
}

interface CascadeAlert {
  triggerMarketId: string;
  expectedMarketIds: string[];
  triggerDelta: number;
  expectedDeltas: Record<string, number>;
  lagWindowSeconds: number;
}

const MOVEMENT_THRESHOLD = 0.05;
const DEFAULT_LAG_WINDOW_SECONDS = 7200;

async function detectRecentMovements(): Promise<MarketMovement[]> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const activeMarkets = await db
    .select({
      id: schema.markets.id,
      title: schema.markets.title,
      currentProbability: schema.markets.currentProbability,
      volumeUsd: schema.markets.volumeUsd,
    })
    .from(schema.markets)
    .where(eq(schema.markets.status, "active"));

  const movements: MarketMovement[] = [];

  for (const market of activeMarkets) {
    if (!market.currentProbability) continue;

    const recentSnapshots = await db
      .select({ probability: schema.marketSnapshots.probability })
      .from(schema.marketSnapshots)
      .where(
        and(
          eq(schema.marketSnapshots.marketId, market.id),
          gte(schema.marketSnapshots.recordedAt, twoHoursAgo),
        ),
      )
      .orderBy(desc(schema.marketSnapshots.recordedAt))
      .limit(10);

    if (recentSnapshots.length < 2) continue;

    const current = parseFloat(market.currentProbability);
    const previous = parseFloat(recentSnapshots[recentSnapshots.length - 1].probability);
    const delta = current - previous;

    if (Math.abs(delta) >= MOVEMENT_THRESHOLD) {
      movements.push({
        marketId: market.id,
        title: market.title,
        currentProbability: current,
        previousProbability: previous,
        delta,
        volume: parseFloat(market.volumeUsd ?? "0"),
      });
    }
  }

  return movements;
}

async function findNeighborMovements(
  marketId: string,
): Promise<Map<string, { weight: number; neighborTitle: string; currentProb: number; recentDelta: number | null }>> {
  const edges = await db
    .select()
    .from(schema.edges)
    .where(
      or(
        eq(schema.edges.sourceMarketId, marketId),
        eq(schema.edges.targetMarketId, marketId),
      ),
    );

  const neighborIds = edges.map((e) =>
    e.sourceMarketId === marketId ? e.targetMarketId : e.sourceMarketId,
  );

  if (neighborIds.length === 0) return new Map();

  const neighbors = await db
    .select({
      id: schema.markets.id,
      title: schema.markets.title,
      currentProbability: schema.markets.currentProbability,
    })
    .from(schema.markets)
    .where(inArray(schema.markets.id, neighborIds));

  const result = new Map<string, { weight: number; neighborTitle: string; currentProb: number; recentDelta: number | null }>();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  for (const neighbor of neighbors) {
    if (!neighbor.currentProbability) continue;

    const edge = edges.find(
      (e) =>
        (e.sourceMarketId === marketId && e.targetMarketId === neighbor.id) ||
        (e.targetMarketId === marketId && e.sourceMarketId === neighbor.id),
    );

    const weight = edge ? parseFloat(edge.weight) : 0;

    const snapshots = await db
      .select({ probability: schema.marketSnapshots.probability })
      .from(schema.marketSnapshots)
      .where(
        and(
          eq(schema.marketSnapshots.marketId, neighbor.id),
          gte(schema.marketSnapshots.recordedAt, oneHourAgo),
        ),
      )
      .orderBy(desc(schema.marketSnapshots.recordedAt))
      .limit(5);

    let recentDelta: number | null = null;
    if (snapshots.length >= 2) {
      const latest = parseFloat(snapshots[0].probability);
      const oldest = parseFloat(snapshots[snapshots.length - 1].probability);
      recentDelta = latest - oldest;
    }

    result.set(neighbor.id, {
      weight,
      neighborTitle: neighbor.title,
      currentProb: parseFloat(neighbor.currentProbability),
      recentDelta,
    });
  }

  return result;
}

function estimateLagWindow(
  evidence: Record<string, unknown> | null,
): number {
  if (!evidence) return DEFAULT_LAG_WINDOW_SECONDS;

  const temporal = evidence.temporal as Record<string, unknown> | undefined;
  if (!temporal) return DEFAULT_LAG_WINDOW_SECONDS;

  const grangerPValue1d = temporal.grangerPValue1d as number | undefined;
  const grangerPValue3d = temporal.grangerPValue3d as number | undefined;

  if (grangerPValue1d !== undefined && grangerPValue1d < 0.05) {
    return 24 * 60 * 60;
  }
  if (grangerPValue3d !== undefined && grangerPValue3d < 0.05) {
    return 3 * 24 * 60 * 60;
  }

  return DEFAULT_LAG_WINDOW_SECONDS;
}

export async function detectCascades(): Promise<{
  alertsCreated: number;
  alertsResolved: number;
}> {
  logger.info("starting cascade detection");

  const movements = await detectRecentMovements();
  logger.info("significant movers detected", { count: movements.length });

  const alerts: CascadeAlert[] = [];

  for (const movement of movements) {
    const neighborInfo = await findNeighborMovements(movement.marketId);

    const expectedDeltas: Record<string, number> = {};
    const expectedMarketIds: string[] = [];

    for (const [neighborId, info] of neighborInfo) {
      const expectedDelta = movement.delta * info.weight;

      if (Math.abs(expectedDelta) < 0.02) continue;

      const neighborMoved =
        info.recentDelta !== null &&
        Math.abs(info.recentDelta) >= Math.abs(expectedDelta) * 0.5;

      if (!neighborMoved) {
        expectedMarketIds.push(neighborId);
        expectedDeltas[neighborId] = expectedDelta;
      }
    }

    if (expectedMarketIds.length > 0) {
      const edge = await db
        .select({ evidence: schema.edges.evidence })
        .from(schema.edges)
        .where(
          or(
            and(
              eq(schema.edges.sourceMarketId, movement.marketId),
              inArray(schema.edges.targetMarketId, expectedMarketIds),
            ),
            and(
              eq(schema.edges.targetMarketId, movement.marketId),
              inArray(schema.edges.sourceMarketId, expectedMarketIds),
            ),
          ),
        )
        .limit(1);

      const lagWindow = edge.length > 0
        ? estimateLagWindow(edge[0].evidence as Record<string, unknown> | null)
        : DEFAULT_LAG_WINDOW_SECONDS;

      alerts.push({
        triggerMarketId: movement.marketId,
        expectedMarketIds,
        triggerDelta: movement.delta,
        expectedDeltas,
        lagWindowSeconds: lagWindow,
      });
    }
  }

  const expiredCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const resolveResult = await db
    .update(schema.cascadeAlerts)
    .set({ status: "expired", resolvedAt: new Date() })
    .where(
      and(
        eq(schema.cascadeAlerts.status, "active"),
        sql`${schema.cascadeAlerts.detectedAt} < ${expiredCutoff}`,
      ),
    )
    .returning({ id: schema.cascadeAlerts.id });

  let created = 0;
  for (const alert of alerts) {
    await db.insert(schema.cascadeAlerts).values({
      triggerMarketId: alert.triggerMarketId,
      expectedMarketIds: alert.expectedMarketIds,
      triggerDelta: alert.triggerDelta.toFixed(8),
      expectedDeltas: alert.expectedDeltas,
      lagWindowSeconds: alert.lagWindowSeconds,
      status: "active",
    });
    created++;
  }

  logger.info("cascade detection complete", {
    alertsCreated: created,
    alertsExpired: resolveResult.length,
  });

  return { alertsCreated: created, alertsResolved: resolveResult.length };
}
