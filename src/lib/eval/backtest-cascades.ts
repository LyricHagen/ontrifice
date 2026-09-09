interface SyntheticMarket {
  id: string;
  title: string;
  probability: number;
}

interface SyntheticEdge {
  sourceId: string;
  targetId: string;
  weight: number;
}

interface CascadePrediction {
  triggerMarketId: string;
  triggerDelta: number;
  expectedMarketId: string;
  expectedDelta: number;
  lagWindowSeconds: number;
}

interface PredictionOutcome {
  prediction: CascadePrediction;
  actualDelta1h: number;
  actualDelta6h: number;
  correct1h: boolean;
  correct6h: boolean;
  deltaError: number;
}

export interface BacktestReport {
  precisionAt1h: number;
  precisionAt6h: number;
  mae: number;
  falseAlarmRate: number;
  nAlerts: number;
  nPredictions: number;
  correctAt1h: number;
  correctAt6h: number;
  nFalseAlarms: number;
  outcomes: PredictionOutcome[];
}

function gaussianNoise(sigma: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function createSyntheticGraph(): {
  markets: SyntheticMarket[];
  edges: SyntheticEdge[];
} {
  const markets: SyntheticMarket[] = [
    { id: "m-fed-rate", title: "Fed cuts rates in September 2026", probability: 0.65 },
    { id: "m-cpi", title: "CPI below 2.8% in August 2026", probability: 0.55 },
    { id: "m-mortgage", title: "30-year mortgage rate below 6%", probability: 0.40 },
    { id: "m-housing", title: "US housing prices rise 5% in 2026", probability: 0.45 },
    { id: "m-sp500", title: "S&P 500 above 6000 by end of 2026", probability: 0.60 },
    { id: "m-recession", title: "US recession in 2026", probability: 0.25 },
    { id: "m-unemployment", title: "Unemployment above 5%", probability: 0.30 },
    { id: "m-gdp", title: "GDP growth below 1%", probability: 0.20 },
    { id: "m-btc", title: "Bitcoin above $150k", probability: 0.35 },
    { id: "m-eth", title: "Ethereum above $8k", probability: 0.30 },
    { id: "m-crypto-reg", title: "Major crypto regulation passed", probability: 0.40 },
    { id: "m-oil", title: "Oil above $100/barrel", probability: 0.30 },
    { id: "m-gas", title: "Gas prices above $5/gallon", probability: 0.25 },
    { id: "m-ukraine", title: "Ukraine ceasefire reached", probability: 0.20 },
    { id: "m-eu-gas", title: "European gas prices below 25 EUR/MWh", probability: 0.30 },
    { id: "m-trump", title: "Trump wins 2028 election", probability: 0.45 },
    { id: "m-gop-senate", title: "Republicans win Senate", probability: 0.55 },
    { id: "m-defense", title: "NATO increases spending to 3%", probability: 0.50 },
    { id: "m-defense-stocks", title: "Defense stocks rise 30%", probability: 0.40 },
    { id: "m-treasury", title: "10-year Treasury yield below 3.5%", probability: 0.35 },
  ];

  const edges: SyntheticEdge[] = [
    { sourceId: "m-fed-rate", targetId: "m-mortgage", weight: 0.7 },
    { sourceId: "m-fed-rate", targetId: "m-sp500", weight: 0.5 },
    { sourceId: "m-fed-rate", targetId: "m-treasury", weight: 0.65 },
    { sourceId: "m-cpi", targetId: "m-fed-rate", weight: 0.6 },
    { sourceId: "m-mortgage", targetId: "m-housing", weight: 0.55 },
    { sourceId: "m-recession", targetId: "m-unemployment", weight: 0.8 },
    { sourceId: "m-recession", targetId: "m-gdp", weight: 0.75 },
    { sourceId: "m-recession", targetId: "m-sp500", weight: -0.6 },
    { sourceId: "m-btc", targetId: "m-eth", weight: 0.85 },
    { sourceId: "m-crypto-reg", targetId: "m-btc", weight: -0.4 },
    { sourceId: "m-oil", targetId: "m-gas", weight: 0.8 },
    { sourceId: "m-ukraine", targetId: "m-eu-gas", weight: 0.65 },
    { sourceId: "m-ukraine", targetId: "m-oil", weight: -0.3 },
    { sourceId: "m-trump", targetId: "m-gop-senate", weight: 0.4 },
    { sourceId: "m-defense", targetId: "m-defense-stocks", weight: 0.7 },
    { sourceId: "m-unemployment", targetId: "m-recession", weight: 0.6 },
    { sourceId: "m-gdp", targetId: "m-sp500", weight: 0.45 },
  ];

  return { markets, edges };
}

function simulateActualMovement(
  expectedDelta: number,
  edgeWeight: number,
  noiseSigma: number,
  propagationProbability: number,
): { delta1h: number; delta6h: number } {
  const propagates = Math.random() < propagationProbability;

  if (!propagates) {
    return {
      delta1h: gaussianNoise(noiseSigma * 0.5),
      delta6h: gaussianNoise(noiseSigma * 0.3),
    };
  }

  const partialAt1h = 0.3 + Math.random() * 0.4;
  const partialAt6h = 0.7 + Math.random() * 0.3;

  return {
    delta1h: expectedDelta * partialAt1h + gaussianNoise(noiseSigma),
    delta6h: expectedDelta * partialAt6h + gaussianNoise(noiseSigma * 0.6),
  };
}

const MOVEMENT_THRESHOLD = 0.05;
const PREDICTION_THRESHOLD = 0.02;
const CORRECTNESS_THRESHOLD = 0.5;

export function backtestCascades(nScenarios: number = 200): BacktestReport {
  const { markets, edges } = createSyntheticGraph();
  const adjacency = new Map<string, Array<{ neighborId: string; weight: number }>>();

  for (const edge of edges) {
    if (!adjacency.has(edge.sourceId)) adjacency.set(edge.sourceId, []);
    adjacency.get(edge.sourceId)!.push({
      neighborId: edge.targetId,
      weight: edge.weight,
    });
  }

  const outcomes: PredictionOutcome[] = [];

  for (let scenario = 0; scenario < nScenarios; scenario++) {
    const triggerMarket = markets[Math.floor(Math.random() * markets.length)];
    const triggerDelta = (Math.random() > 0.5 ? 1 : -1) *
      (MOVEMENT_THRESHOLD + Math.random() * 0.15);

    const neighbors = adjacency.get(triggerMarket.id) ?? [];

    for (const neighbor of neighbors) {
      const expectedDelta = triggerDelta * neighbor.weight;

      if (Math.abs(expectedDelta) < PREDICTION_THRESHOLD) continue;

      const propagationProb = Math.min(Math.abs(neighbor.weight), 0.9);
      const actual = simulateActualMovement(
        expectedDelta,
        neighbor.weight,
        0.03,
        propagationProb,
      );

      const prediction: CascadePrediction = {
        triggerMarketId: triggerMarket.id,
        triggerDelta,
        expectedMarketId: neighbor.neighborId,
        expectedDelta,
        lagWindowSeconds: 7200,
      };

      const correct1h =
        Math.sign(actual.delta1h) === Math.sign(expectedDelta) &&
        Math.abs(actual.delta1h) >= Math.abs(expectedDelta) * CORRECTNESS_THRESHOLD;

      const correct6h =
        Math.sign(actual.delta6h) === Math.sign(expectedDelta) &&
        Math.abs(actual.delta6h) >= Math.abs(expectedDelta) * CORRECTNESS_THRESHOLD;

      outcomes.push({
        prediction,
        actualDelta1h: actual.delta1h,
        actualDelta6h: actual.delta6h,
        correct1h,
        correct6h,
        deltaError: Math.abs(expectedDelta - actual.delta6h),
      });
    }
  }

  const nPredictions = outcomes.length;
  const correctAt1h = outcomes.filter((o) => o.correct1h).length;
  const correctAt6h = outcomes.filter((o) => o.correct6h).length;

  const nFalseAlarms = outcomes.filter(
    (o) => !o.correct6h && Math.abs(o.actualDelta6h) < PREDICTION_THRESHOLD,
  ).length;

  const mae =
    nPredictions > 0
      ? outcomes.reduce((sum, o) => sum + o.deltaError, 0) / nPredictions
      : 0;

  return {
    precisionAt1h: nPredictions > 0 ? correctAt1h / nPredictions : 0,
    precisionAt6h: nPredictions > 0 ? correctAt6h / nPredictions : 0,
    mae,
    falseAlarmRate: nPredictions > 0 ? nFalseAlarms / nPredictions : 0,
    nAlerts: nPredictions,
    nPredictions,
    correctAt1h,
    correctAt6h,
    nFalseAlarms,
    outcomes,
  };
}
