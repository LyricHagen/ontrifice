// NOTE: Granger causality is a statistical concept (predictive precedence), not real-world
// causation. A 'leads' relationship means past values of A help predict future values of B
// after controlling for B's own past, nothing more.

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
  grangerFStat1d: number | null;
  grangerFStat3d: number | null;
  grangerDirection: "source_leads" | "target_leads" | "bidirectional";
  grangerCoefficient: number | null;
  nObservations: number;
}

export interface TemporalEdge {
  sourceMarketId: string;
  targetMarketId: string;
  relationClass: "statistical";
  relationType: "correlation" | "lead_lag";
  score: number;
  confidence: number;
  direction: "bidirectional" | "source_leads" | "target_leads";
  mathematicalSemantics: string;
  modelVersion: string;
  sampleSize: number;
  algorithmParams: Record<string, unknown>;
  evidence: {
    pearsonR: number | null;
    pValue: number | null;
    fStatistic: number | null;
    windowDays: number;
    nObservations: number;
    rawPValue: number | null;
    adjustedPValue: number | null;
  };
}

const MIN_SNAPSHOTS = 30;
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

function pearsonPValue(r: number, n: number): number | null {
  if (n < 4 || Math.abs(r) >= 1) return null;
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  return tDistPValue(Math.abs(t), n - 2) * 2;
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
  fStat: number;
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
  const fStat = tStat * tStat;

  return { coefficient: slope, tStat, pValue, fStat };
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
    grangerFStat1d: granger1dAB?.fStat ?? null,
    grangerFStat3d: granger3dAB?.fStat ?? null,
    grangerDirection,
    grangerCoefficient: granger1dAB?.coefficient ?? null,
    nObservations: n,
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

interface RawTemporalResult {
  sourceId: string;
  targetId: string;
  result: TemporalResult;
  bestCorrelation: number;
  grangerSignificant: boolean;
  bestGrangerPValue: number | null;
}

function benjaminiHochberg(
  results: RawTemporalResult[],
): Map<RawTemporalResult, number> {
  const pValues: Array<{ result: RawTemporalResult; p: number }> = [];

  for (const r of results) {
    const candidates = [
      r.result.grangerPValue1d,
      r.result.grangerPValue3d,
    ].filter((p): p is number => p !== null);

    if (candidates.length > 0) {
      pValues.push({ result: r, p: Math.min(...candidates) });
    }
  }

  if (pValues.length === 0) return new Map();

  pValues.sort((a, b) => a.p - b.p);
  const m = pValues.length;
  const adjusted = new Map<RawTemporalResult, number>();

  let minSoFar = 1;
  for (let i = m - 1; i >= 0; i--) {
    const corrected = Math.min((pValues[i].p * m) / (i + 1), 1);
    minSoFar = Math.min(minSoFar, corrected);
    adjusted.set(pValues[i].result, minSoFar);
  }

  return adjusted;
}

export async function detectTemporalCoMovement(
  marketPairs: Array<{ sourceId: string; targetId: string }>,
): Promise<TemporalEdge[]> {
  logger.info("starting temporal co-movement detection", {
    pairCount: marketPairs.length,
  });

  const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const seriesCache = new Map<string, SnapshotSeries | null>();
  const rawResults: RawTemporalResult[] = [];

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
      logger.warn(
        "skipping market pair: insufficient snapshots (minimum 30 required)",
        undefined,
        { marketId: pair.sourceId },
      );
      continue;
    }
    if (!seriesB) {
      logger.warn(
        "skipping market pair: insufficient snapshots (minimum 30 required)",
        undefined,
        { marketId: pair.targetId },
      );
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

    const bestGrangerPValue = [result.grangerPValue1d, result.grangerPValue3d]
      .filter((p): p is number => p !== null)
      .reduce((min, p) => Math.min(min, p), 1);

    rawResults.push({
      sourceId: pair.sourceId,
      targetId: pair.targetId,
      result,
      bestCorrelation,
      grangerSignificant,
      bestGrangerPValue: bestGrangerPValue < 1 ? bestGrangerPValue : null,
    });
  }

  const adjustedPValues = benjaminiHochberg(rawResults);

  const edges: TemporalEdge[] = [];

  for (const raw of rawResults) {
    const adjustedP = adjustedPValues.get(raw) ?? null;
    const fdrSignificant = adjustedP !== null && adjustedP < GRANGER_P_THRESHOLD;
    const passesCorrelation = raw.bestCorrelation > CORRELATION_THRESHOLD;

    if (!passesCorrelation && !fdrSignificant) continue;

    if (passesCorrelation) {
      const bestR = raw.result.correlation30d ?? raw.result.correlation7d;
      const windowDays = raw.result.correlation30d !== null ? 30 : 7;
      const nObs = Math.min(raw.result.nObservations, windowDays);
      const corrPValue = bestR !== null ? pearsonPValue(bestR, nObs) : null;

      edges.push({
        sourceMarketId: raw.sourceId,
        targetMarketId: raw.targetId,
        relationClass: "statistical",
        relationType: "correlation",
        score: raw.bestCorrelation,
        confidence: Math.min(raw.bestCorrelation + (fdrSignificant ? 0.2 : 0), 1),
        direction: "bidirectional",
        mathematicalSemantics:
          `pearson_r=${(bestR ?? raw.bestCorrelation).toFixed(4)} over ${nObs} daily observations`,
        modelVersion: "temporal-v1",
        sampleSize: raw.result.nObservations,
        algorithmParams: {
          correlationThreshold: CORRELATION_THRESHOLD,
          windowDays: [7, 30],
          minSnapshots: MIN_SNAPSHOTS,
        },
        evidence: {
          pearsonR: bestR,
          pValue: corrPValue,
          fStatistic: null,
          windowDays,
          nObservations: raw.result.nObservations,
          rawPValue: corrPValue,
          adjustedPValue: null,
        },
      });
    }

    if (fdrSignificant) {
      const lagDays = raw.result.grangerPValue1d !== null &&
        raw.result.grangerPValue1d <= (raw.result.grangerPValue3d ?? 1)
        ? 1 : 3;
      const fStat = lagDays === 1
        ? raw.result.grangerFStat1d
        : raw.result.grangerFStat3d;

      edges.push({
        sourceMarketId: raw.sourceId,
        targetMarketId: raw.targetId,
        relationClass: "statistical",
        relationType: "lead_lag",
        score: Math.max(raw.bestCorrelation, 0.5),
        confidence: Math.min(raw.bestCorrelation + 0.2, 1),
        direction: raw.result.grangerDirection,
        mathematicalSemantics:
          `granger_f=${(fStat ?? 0).toFixed(4)} lag=${lagDays}d p_adj=${(adjustedP ?? 0).toFixed(6)} over ${raw.result.nObservations} observations`,
        modelVersion: "temporal-v1",
        sampleSize: raw.result.nObservations,
        algorithmParams: {
          grangerPThreshold: GRANGER_P_THRESHOLD,
          lagDays: [1, 3],
          fdrMethod: "benjamini-hochberg",
          minSnapshots: MIN_SNAPSHOTS,
        },
        evidence: {
          pearsonR: raw.result.correlation30d ?? raw.result.correlation7d,
          pValue: adjustedP,
          fStatistic: fStat,
          windowDays: lagDays,
          nObservations: raw.result.nObservations,
          rawPValue: raw.bestGrangerPValue,
          adjustedPValue: adjustedP,
        },
      });
    }
  }

  logger.info("temporal detection complete", { edgesFound: edges.length });
  return edges;
}
