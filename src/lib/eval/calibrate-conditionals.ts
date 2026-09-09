interface CalibrationBin {
  range: string;
  lower: number;
  upper: number;
  nSamples: number;
  predictedMean: number;
  empiricalFrequency: number;
  absoluteError: number;
}

export interface CalibrationReport {
  ece: number;
  brierScore: number;
  nTrials: number;
  noiseSigma: number;
  bins: CalibrationBin[];
  clampRate: number;
  meanAbsoluteError: number;
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
    joint = frechetLower;
    clamped = true;
  } else if (joint > frechetUpper) {
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

function sampleBernoulli(p: number): number {
  return Math.random() < p ? 1 : 0;
}

function sampleCorrelatedBernoulli(
  pA: number,
  pB: number,
  r: number,
): { a: number; b: number } {
  const sigma = Math.sqrt(pA * (1 - pA) * pB * (1 - pB));
  let pJoint = pA * pB + r * sigma;
  pJoint = Math.max(Math.max(0, pA + pB - 1), Math.min(Math.min(pA, pB), pJoint));

  const u = Math.random();

  if (u < pJoint) {
    return { a: 1, b: 1 };
  } else if (u < pA) {
    return { a: 1, b: 0 };
  } else if (u < pA + pB - pJoint) {
    return { a: 0, b: 1 };
  } else {
    return { a: 0, b: 0 };
  }
}

function gaussianNoise(sigma: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function maxCorrelation(pA: number, pB: number): number {
  const sigma = Math.sqrt(pA * (1 - pA) * pB * (1 - pB));
  if (sigma === 0) return 0;
  const upper = Math.min(pA, pB);
  return (upper - pA * pB) / sigma;
}

function minCorrelation(pA: number, pB: number): number {
  const sigma = Math.sqrt(pA * (1 - pA) * pB * (1 - pB));
  if (sigma === 0) return 0;
  const lower = Math.max(0, pA + pB - 1);
  return (lower - pA * pB) / sigma;
}

export function calibrateConditionals(
  nTrials: number = 500,
  nSimulations: number = 2000,
  noiseSigma: number = 0.15,
): CalibrationReport {
  const predictions: Array<{
    predicted: number;
    empirical: number;
    clamped: boolean;
  }> = [];

  for (let trial = 0; trial < nTrials; trial++) {
    const pA = 0.1 + Math.random() * 0.8;
    const pB = 0.1 + Math.random() * 0.8;

    const rMin = minCorrelation(pA, pB);
    const rMax = maxCorrelation(pA, pB);
    const trueR = rMin + Math.random() * (rMax - rMin);

    const trueResult = computeJointAndConditional(pA, pB, trueR);

    let observedR = trueR + gaussianNoise(noiseSigma);
    observedR = Math.max(rMin, Math.min(rMax, observedR));

    const predicted = computeJointAndConditional(pA, pB, observedR);

    let bGivenACount = 0;
    let aCount = 0;
    for (let s = 0; s < nSimulations; s++) {
      const sample = sampleCorrelatedBernoulli(pA, pB, trueR);
      if (sample.a === 1) {
        aCount++;
        if (sample.b === 1) bGivenACount++;
      }
    }

    const empirical = aCount > 0 ? bGivenACount / aCount : pB;

    predictions.push({
      predicted: predicted.conditional,
      empirical,
      clamped: predicted.clamped,
    });
  }

  const bins: CalibrationBin[] = [];
  for (let i = 0; i < 10; i++) {
    const lower = i * 0.1;
    const upper = (i + 1) * 0.1;
    const inBin = predictions.filter(
      (p) => p.predicted >= lower && p.predicted < (i === 9 ? 1.01 : upper),
    );

    const predictedMean =
      inBin.length > 0
        ? inBin.reduce((s, p) => s + p.predicted, 0) / inBin.length
        : (lower + upper) / 2;
    const empiricalFreq =
      inBin.length > 0
        ? inBin.reduce((s, p) => s + p.empirical, 0) / inBin.length
        : 0;

    bins.push({
      range: `${(lower * 100).toFixed(0)}-${(upper * 100).toFixed(0)}%`,
      lower,
      upper,
      nSamples: inBin.length,
      predictedMean,
      empiricalFrequency: empiricalFreq,
      absoluteError: Math.abs(predictedMean - empiricalFreq),
    });
  }

  const totalSamples = predictions.length;
  const ece =
    bins.reduce((sum, bin) => sum + (bin.nSamples / totalSamples) * bin.absoluteError, 0);

  const brierScore =
    predictions.reduce(
      (sum, p) => sum + (p.predicted - p.empirical) ** 2,
      0,
    ) / predictions.length;

  const clampRate =
    predictions.filter((p) => p.clamped).length / predictions.length;

  const meanAbsoluteError =
    predictions.reduce(
      (sum, p) => sum + Math.abs(p.predicted - p.empirical),
      0,
    ) / predictions.length;

  return {
    ece,
    brierScore,
    nTrials,
    noiseSigma,
    bins,
    clampRate,
    meanAbsoluteError,
  };
}
