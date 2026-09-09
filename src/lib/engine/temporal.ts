import { db, schema } from "@/db";
import { eq, and, gte, asc } from "drizzle-orm";
import { logger } from "@/lib/logger";

interface SnapshotSeries {
  marketId: string;
  timestamps: number[];
  probabilities: number[];
}

interface TemporalResult {
  correlation7d: number | null;
  correlation30d: number | null;
  grangerPValue1d: number | null;
  grangerPValue3d: number | null;
  grangerDirection: "source_leads" | "target_leads" | "bidirectional";
  grangerCoefficient: number | null;
}

export interface TemporalEdge {
  sourceMarketId: string;
  targetMarketId: string;
  weight: number;
  confidence: number;
  direction: "bidirectional" | "source_leads" | "target_leads";
  evidence: {
    correlation7d: number | null;
    correlation30d: number | null;
    grangerPValue1d: number | null;
    grangerPValue3d: number | null;
    grangerDirection: string;
    windowSizes: number[];
  };
}

const MIN_SNAPSHOTS = 14;
const CORRELATION_THRESHOLD = 0.4;
const GRANGER_P_THRESHOLD = 0.05;

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr: number[]): number {
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function pearsonCorrelation(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 3) return null;

  const mx = mean(x);
  const my = mean(y);
  const sx = std(x);
  const sy = std(y);

  if (sx === 0 || sy === 0) return null;

  let sum = 0;
  for (let i = 0; i < x.length; i++) {
    sum += (x[i] - mx) * (y[i] - my);
  }

  return sum / (x.length * sx * sy);
}

function computeDeltas(values: number[]): number[] {
  const deltas: number[] = [];
  for (let i = 1; i < values.length; i++) {
    deltas.push(values[i] - values[i - 1]);
  }
  return deltas;
}

interface RegressionResult {
  coefficient: number;
  tStat: number;
  pValue: number;
}

function linearRegression(y: number[], x: number[]): RegressionResult | null {
  const n = y.length;
  if (n < 4) return null;

  const mx = mean(x);
  const my = mean(y);

  let ssxy = 0;
  let ssxx = 0;
  for (let i = 0; i < n; i++) {
    ssxy += (x[i] - mx) * (y[i] - my);
    ssxx += (x[i] - mx) ** 2;
  }

  if (ssxx === 0) return null;

  const slope = ssxy / ssxx;
  const intercept = my - slope * mx;

  let sse = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * x[i];
    sse += (y[i] - predicted) ** 2;
  }

  const mse = sse / (n - 2);
  const seSlope = Math.sqrt(mse / ssxx);

  if (seSlope === 0) return null;

  const tStat = slope / seSlope;
  const df = n - 2;
  const pValue = tDistPValue(Math.abs(tStat), df) * 2;

  return { coefficient: slope, tStat, pValue };
}

function tDistPValue(t: number, df: number): number {
  const x = df / (df + t * t);
  return 0.5 * incompleteBeta(df / 2, 0.5, x);
}

function incompleteBeta(a: number, b: number, x: number): number {
  if (x === 0 || x === 1) return x;

  const maxIter = 200;
  const epsilon = 1e-10;

  const lnBeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(
    Math.log(x) * a + Math.log(1 - x) * b - lnBeta,
  ) / a;

  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let result = d;

  for (let m = 1; m <= maxIter; m++) {
    let numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    result *= d * c;

    numerator =
      -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    result *= delta;

    if (Math.abs(delta - 1) < epsilon) break;
  }

  return front * result;
}

function lgamma(x: number): number {
  const coefficients = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];

  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const c of coefficients) {
    ser += c / ++y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function grangerCausality(
  deltaSource: number[],
  deltaTarget: number[],
  lag: number,
): RegressionResult | null {
  if (deltaSource.length <= lag || deltaTarget.length <= lag) return null;

  const y = deltaTarget.slice(lag);
  const x = deltaSource.slice(0, deltaSource.length - lag);

  const minLen = Math.min(y.length, x.length);
  return linearRegression(y.slice(0, minLen), x.slice(0, minLen));
}

function alignTimeSeries(
  a: SnapshotSeries,
  b: SnapshotSeries,
): { alignedA: number[]; alignedB: number[] } | null {
  const aMap = new Map<string, number>();
  for (let i = 0; i < a.timestamps.length; i++) {
    const day = new Date(a.timestamps[i]).toISOString().slice(0, 10);
    aMap.set(day, a.probabilities[i]);
  }

  const alignedA: number[] = [];
  const alignedB: number[] = [];

  for (let i = 0; i < b.timestamps.length; i++) {
    const day = new Date(b.timestamps[i]).toISOString().slice(0, 10);
    const valA = aMap.get(day);
    if (valA !== undefined) {
      alignedA.push(valA);
      alignedB.push(b.probabilities[i]);
    }
  }

  if (alignedA.length < MIN_SNAPSHOTS) return null;
  return { alignedA, alignedB };
}

function analyzeCoMovement(
  seriesA: SnapshotSeries,
  seriesB: SnapshotSeries,
): TemporalResult | null {
  const aligned = alignTimeSeries(seriesA, seriesB);
  if (!aligned) return null;

  const { alignedA, alignedB } = aligned;
  const n = alignedA.length;

  const correlation7d = n >= 7
    ? pearsonCorrelation(alignedA.slice(-7), alignedB.slice(-7))
    : null;
  const correlation30d = n >= 30
    ? pearsonCorrelation(alignedA.slice(-30), alignedB.slice(-30))
    : null;

  const deltasA = computeDeltas(alignedA);
  const deltasB = computeDeltas(alignedB);

  const granger1dAB = grangerCausality(deltasA, deltasB, 1);
  const granger1dBA = grangerCausality(deltasB, deltasA, 1);
  const granger3dAB = grangerCausality(deltasA, deltasB, 3);
  const granger3dBA = grangerCausality(deltasB, deltasA, 3);

  const aLeadsB =
    (granger1dAB && granger1dAB.pValue < GRANGER_P_THRESHOLD) ||
    (granger3dAB && granger3dAB.pValue < GRANGER_P_THRESHOLD);
  const bLeadsA =
    (granger1dBA && granger1dBA.pValue < GRANGER_P_THRESHOLD) ||
    (granger3dBA && granger3dBA.pValue < GRANGER_P_THRESHOLD);

  let grangerDirection: "source_leads" | "target_leads" | "bidirectional";
  if (aLeadsB && bLeadsA) grangerDirection = "bidirectional";
  else if (aLeadsB) grangerDirection = "source_leads";
  else if (bLeadsA) grangerDirection = "target_leads";
  else grangerDirection = "bidirectional";

  return {
    correlation7d,
    correlation30d,
    grangerPValue1d: granger1dAB?.pValue ?? null,
    grangerPValue3d: granger3dAB?.pValue ?? null,
    grangerDirection,
    grangerCoefficient: granger1dAB?.coefficient ?? null,
  };
}

async function fetchSnapshotSeries(
  marketId: string,
  since: Date,
): Promise<SnapshotSeries | null> {
  const snapshots = await db
    .select({
      probability: schema.marketSnapshots.probability,
      recordedAt: schema.marketSnapshots.recordedAt,
    })
    .from(schema.marketSnapshots)
    .where(
      and(
        eq(schema.marketSnapshots.marketId, marketId),
        gte(schema.marketSnapshots.recordedAt, since),
      ),
    )
    .orderBy(asc(schema.marketSnapshots.recordedAt));

  if (snapshots.length < MIN_SNAPSHOTS) return null;

  return {
    marketId,
    timestamps: snapshots.map((s) => s.recordedAt.getTime()),
    probabilities: snapshots.map((s) => parseFloat(s.probability)),
  };
}

export async function detectTemporalCoMovement(
  marketPairs: Array<{ sourceId: string; targetId: string }>,
): Promise<TemporalEdge[]> {
  logger.info("starting temporal co-movement detection", {
    pairCount: marketPairs.length,
  });

  const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const seriesCache = new Map<string, SnapshotSeries | null>();
  const edges: TemporalEdge[] = [];

  for (const pair of marketPairs) {
    if (!seriesCache.has(pair.sourceId)) {
      seriesCache.set(pair.sourceId, await fetchSnapshotSeries(pair.sourceId, since));
    }
    if (!seriesCache.has(pair.targetId)) {
      seriesCache.set(pair.targetId, await fetchSnapshotSeries(pair.targetId, since));
    }

    const seriesA = seriesCache.get(pair.sourceId);
    const seriesB = seriesCache.get(pair.targetId);

    if (!seriesA) {
      logger.debug("skipping market with insufficient snapshots", {
        marketId: pair.sourceId,
      });
      continue;
    }
    if (!seriesB) {
      logger.debug("skipping market with insufficient snapshots", {
        marketId: pair.targetId,
      });
      continue;
    }

    const result = analyzeCoMovement(seriesA, seriesB);
    if (!result) continue;

    const bestCorrelation = Math.max(
      Math.abs(result.correlation7d ?? 0),
      Math.abs(result.correlation30d ?? 0),
    );

    const grangerSignificant =
      (result.grangerPValue1d !== null && result.grangerPValue1d < GRANGER_P_THRESHOLD) ||
      (result.grangerPValue3d !== null && result.grangerPValue3d < GRANGER_P_THRESHOLD);

    if (bestCorrelation > CORRELATION_THRESHOLD || grangerSignificant) {
      const weight = grangerSignificant
        ? Math.max(bestCorrelation, 0.5)
        : bestCorrelation;

      edges.push({
        sourceMarketId: pair.sourceId,
        targetMarketId: pair.targetId,
        weight,
        confidence: Math.min(bestCorrelation + (grangerSignificant ? 0.2 : 0), 1),
        direction: result.grangerDirection,
        evidence: {
          correlation7d: result.correlation7d,
          correlation30d: result.correlation30d,
          grangerPValue1d: result.grangerPValue1d,
          grangerPValue3d: result.grangerPValue3d,
          grangerDirection: result.grangerDirection,
          windowSizes: [7, 30],
        },
      });
    }
  }

  logger.info("temporal detection complete", { edgesFound: edges.length });
  return edges;
}
