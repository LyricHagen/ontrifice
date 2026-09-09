import { db, schema } from "@/db";
import { eq, and, gte, lte, or, desc, asc, inArray, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";
import type { EmpiricalDelta } from "@/db/schema/cascade-alerts";

interface MarketMovement {
  marketId: string;
  title: string;
  currentProbability: number;
  previousProbability: number;
  delta: number;
  volume: number;
}

interface EmpiricalResponse {
  beta: number;
  observations: number;
  standardError: number;
  medianLagSeconds: number;
  lagBasis: "empirical" | "estimated";
}

const MOVEMENT_THRESHOLD = 0.05;
const DEFAULT_LAG_WINDOW_SECONDS = 7200;
const MIN_OBSERVATIONS = 5;

function tCritical90(df: number): number {
  const table: Record<number, number> = {
    1: 6.314, 2: 2.920, 3: 2.353, 4: 2.132,
    5: 2.015, 6: 1.943, 7: 1.895, 8: 1.860,
    9: 1.833, 10: 1.812, 15: 1.753, 20: 1.725,
    25: 1.708, 30: 1.697, 40: 1.684, 60: 1.671,
    120: 1.658,
  };
  if (df in table) return table[df];
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (df < keys[0]) return table[keys[0]];
  if (df > keys[keys.length - 1]) return 1.645;
  for (let i = 0; i < keys.length - 1; i++) {
    if (df >= keys[i] && df <= keys[i + 1]) {
      const frac = (df - keys[i]) / (keys[i + 1] - keys[i]);
      return table[keys[i]] * (1 - frac) + table[keys[i + 1]] * frac;
    }
  }
  return 1.645;
}

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

async function computeEmpiricalResponse(
  sourceMarketId: string,
  targetMarketId: string,
): Promise<EmpiricalResponse | null> {
  const snapshots = await db
    .select({
      probability: schema.marketSnapshots.probability,
      recordedAt: schema.marketSnapshots.recordedAt,
    })
    .from(schema.marketSnapshots)
    .where(eq(schema.marketSnapshots.marketId, sourceMarketId))
    .orderBy(asc(schema.marketSnapshots.recordedAt));

  if (snapshots.length < 2) return null;

  const dailyEvents: Array<{ delta: number; eventTime: Date }> = [];
  let dayStart = snapshots[0];
  let dayDate = snapshots[0].recordedAt.toISOString().slice(0, 10);

  for (let i = 1; i < snapshots.length; i++) {
    const snap = snapshots[i];
    const snapDate = snap.recordedAt.toISOString().slice(0, 10);

    if (snapDate !== dayDate) {
      const dayDelta = parseFloat(snapshots[i - 1].probability) - parseFloat(dayStart.probability);
      if (Math.abs(dayDelta) > MOVEMENT_THRESHOLD) {
        dailyEvents.push({ delta: dayDelta, eventTime: snapshots[i - 1].recordedAt });
      }
      dayStart = snap;
      dayDate = snapDate;
    }
  }

  const lastDelta = parseFloat(snapshots[snapshots.length - 1].probability) - parseFloat(dayStart.probability);
  if (Math.abs(lastDelta) > MOVEMENT_THRESHOLD) {
    dailyEvents.push({ delta: lastDelta, eventTime: snapshots[snapshots.length - 1].recordedAt });
  }

  if (dailyEvents.length === 0) return null;

  const observations: Array<{ deltaA: number; deltaB: number; lagSeconds: number }> = [];

  for (const event of dailyEvents) {
    const windowEnd = new Date(event.eventTime.getTime() + 24 * 60 * 60 * 1000);

    const beforeSnap = await db
      .select({ probability: schema.marketSnapshots.probability })
      .from(schema.marketSnapshots)
      .where(
        and(
          eq(schema.marketSnapshots.marketId, targetMarketId),
          lte(schema.marketSnapshots.recordedAt, event.eventTime),
        ),
      )
      .orderBy(desc(schema.marketSnapshots.recordedAt))
      .limit(1);

    if (beforeSnap.length === 0) continue;

    const afterSnaps = await db
      .select({
        probability: schema.marketSnapshots.probability,
        recordedAt: schema.marketSnapshots.recordedAt,
      })
      .from(schema.marketSnapshots)
      .where(
        and(
          eq(schema.marketSnapshots.marketId, targetMarketId),
          gte(schema.marketSnapshots.recordedAt, event.eventTime),
          lte(schema.marketSnapshots.recordedAt, windowEnd),
        ),
      )
      .orderBy(asc(schema.marketSnapshots.recordedAt));

    if (afterSnaps.length === 0) continue;

    const beforeProb = parseFloat(beforeSnap[0].probability);
    let maxAbsDelta = 0;
    let bestDeltaB = 0;
    let bestLag = 0;

    for (const snap of afterSnaps) {
      const d = parseFloat(snap.probability) - beforeProb;
      if (Math.abs(d) > maxAbsDelta) {
        maxAbsDelta = Math.abs(d);
        bestDeltaB = d;
        bestLag = (snap.recordedAt.getTime() - event.eventTime.getTime()) / 1000;
      }
    }

    observations.push({ deltaA: event.delta, deltaB: bestDeltaB, lagSeconds: bestLag });
  }

  if (observations.length === 0) return null;

  const meanDeltaA = observations.reduce((s, o) => s + o.deltaA, 0) / observations.length;
  const meanDeltaB = observations.reduce((s, o) => s + o.deltaB, 0) / observations.length;

  if (Math.abs(meanDeltaA) < 1e-10) return null;

  const beta = meanDeltaB / meanDeltaA;
  const n = observations.length;

  let sumSquaredResiduals = 0;
  let sumSquaredDeltaA = 0;
  for (const o of observations) {
    const predicted = beta * o.deltaA;
    sumSquaredResiduals += (o.deltaB - predicted) ** 2;
    sumSquaredDeltaA += o.deltaA ** 2;
  }

  const standardError = n > 1 && sumSquaredDeltaA > 0
    ? Math.sqrt(sumSquaredResiduals / ((n - 1) * sumSquaredDeltaA))
    : 0;

  const lags = observations.map((o) => o.lagSeconds).sort((a, b) => a - b);
  const medianLag = lags.length % 2 === 0
    ? (lags[lags.length / 2 - 1] + lags[lags.length / 2]) / 2
    : lags[Math.floor(lags.length / 2)];

  return {
    beta,
    observations: n,
    standardError,
    medianLagSeconds: Math.round(medianLag),
    lagBasis: "empirical",
  };
}

async function findStatisticalNeighbors(
  marketId: string,
): Promise<Array<{
  neighborId: string;
  neighborTitle: string;
  currentProb: number;
  recentDelta: number | null;
  edgeId: string;
}>> {
  const edges = await db
    .select()
    .from(schema.edges)
    .where(
      and(
        eq(schema.edges.relationClass, "statistical"),
        or(
          eq(schema.edges.sourceMarketId, marketId),
          eq(schema.edges.targetMarketId, marketId),
        ),
      ),
    );

  if (edges.length === 0) return [];

  const neighborIds = edges.map((e) =>
    e.sourceMarketId === marketId ? e.targetMarketId : e.sourceMarketId,
  );

  const neighbors = await db
    .select({
      id: schema.markets.id,
      title: schema.markets.title,
      currentProbability: schema.markets.currentProbability,
    })
    .from(schema.markets)
    .where(inArray(schema.markets.id, neighborIds));

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const results: Array<{
    neighborId: string;
    neighborTitle: string;
    currentProb: number;
    recentDelta: number | null;
    edgeId: string;
  }> = [];

  for (const neighbor of neighbors) {
    if (!neighbor.currentProbability) continue;

    const edge = edges.find(
      (e) =>
        (e.sourceMarketId === marketId && e.targetMarketId === neighbor.id) ||
        (e.targetMarketId === marketId && e.sourceMarketId === neighbor.id),
    );
    if (!edge) continue;

    const snaps = await db
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
    if (snaps.length >= 2) {
      recentDelta = parseFloat(snaps[0].probability) - parseFloat(snaps[snaps.length - 1].probability);
    }

    results.push({
      neighborId: neighbor.id,
      neighborTitle: neighbor.title,
      currentProb: parseFloat(neighbor.currentProbability),
      recentDelta,
      edgeId: edge.id,
    });
  }

  return results;
}

export async function detectCascades(): Promise<{
  alertsCreated: number;
  alertsResolved: number;
}> {
  logger.info("starting cascade detection (empirical model)");

  const movements = await detectRecentMovements();
  logger.info("significant movers detected", { count: movements.length });

  let created = 0;

  for (const movement of movements) {
    const neighbors = await findStatisticalNeighbors(movement.marketId);

    const expectedDeltas: Record<string, EmpiricalDelta> = {};
    const expectedMarketIds: string[] = [];
    let maxLag = 0;

    for (const neighbor of neighbors) {
      const response = await computeEmpiricalResponse(movement.marketId, neighbor.neighborId);

      if (!response) {
        logger.info("no historical response data for edge", {
          source: movement.marketId,
          target: neighbor.neighborId,
        });
        continue;
      }

      if (response.observations < MIN_OBSERVATIONS) {
        logger.info(
          `Insufficient historical response data for edge ${movement.marketId}->${neighbor.neighborId} (n=${response.observations}). Need at least ${MIN_OBSERVATIONS} observations to estimate response.`,
        );
        continue;
      }

      await db
        .update(schema.edges)
        .set({
          evidence: sql`COALESCE(${schema.edges.evidence}, '{}'::jsonb) || ${JSON.stringify({
            empiricalResponse: {
              beta: response.beta,
              observations: response.observations,
              standardError: response.standardError,
              medianLagSeconds: response.medianLagSeconds,
            },
          })}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(schema.edges.id, neighbor.edgeId));

      const expectedDelta = response.beta * movement.delta;
      if (Math.abs(expectedDelta) < 0.02) continue;

      const t = tCritical90(response.observations - 1);
      const margin = t * response.standardError * Math.abs(movement.delta);
      const lower = expectedDelta - margin;
      const upper = expectedDelta + margin;

      const neighborMoved =
        neighbor.recentDelta !== null &&
        Math.abs(neighbor.recentDelta) >= Math.abs(expectedDelta) * 0.5;

      if (!neighborMoved) {
        expectedMarketIds.push(neighbor.neighborId);
        expectedDeltas[neighbor.neighborId] = {
          expected: expectedDelta,
          lower,
          upper,
          beta: response.beta,
          observations: response.observations,
          lagWindowSeconds: response.medianLagSeconds,
          lagBasis: response.lagBasis,
        };
        if (response.medianLagSeconds > maxLag) {
          maxLag = response.medianLagSeconds;
        }
      }
    }

    if (expectedMarketIds.length > 0) {
      const lagWindow = maxLag > 0 ? maxLag : DEFAULT_LAG_WINDOW_SECONDS;

      await db.insert(schema.cascadeAlerts).values({
        triggerMarketId: movement.marketId,
        expectedMarketIds,
        triggerDelta: movement.delta.toFixed(8),
        expectedDeltas,
        lagWindowSeconds: lagWindow,
        status: "active",
      });
      created++;
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

  logger.info("cascade detection complete", {
    alertsCreated: created,
    alertsExpired: resolveResult.length,
  });

  return { alertsCreated: created, alertsResolved: resolveResult.length };
}
