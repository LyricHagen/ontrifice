import { loadGroundTruth, summarizeDataset } from "./ground-truth";
import { evaluateSemantic } from "./evaluate-semantic";
import { calibrateConditionals } from "./calibrate-conditionals";
import { backtestCascades } from "./backtest-cascades";

function pad(str: string, len: number): string {
  return str.padEnd(len);
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

function fmt(n: number, decimals: number = 4): string {
  return n.toFixed(decimals);
}

function printHeader(title: string): void {
  console.log("");
  console.log("=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

function printSection(title: string): void {
  console.log("");
  console.log(`--- ${title} ---`);
}

function printTable(
  headers: string[],
  rows: string[][],
  widths: number[],
): void {
  const headerLine = headers.map((h, i) => pad(h, widths[i])).join("  ");
  console.log(headerLine);
  console.log(headers.map((_, i) => "-".repeat(widths[i])).join("  "));
  for (const row of rows) {
    console.log(row.map((cell, i) => pad(cell, widths[i])).join("  "));
  }
}

function runEvaluation(): {
  semantic: ReturnType<typeof evaluateSemantic>;
  calibration: ReturnType<typeof calibrateConditionals>;
  cascade: ReturnType<typeof backtestCascades>;
  dataset: ReturnType<typeof summarizeDataset>;
} {
  console.log("loading ground truth dataset...");
  const pairs = loadGroundTruth();
  const dataset = summarizeDataset(pairs);

  printHeader("ONTRIFICE EVALUATION REPORT");
  console.log(`  date: ${new Date().toISOString()}`);
  console.log(`  ground truth pairs: ${dataset.total}`);
  console.log(
    `  by label: ${Object.entries(dataset.byLabel)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`,
  );
  console.log(
    `  by type: ${Object.entries(dataset.byType)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`,
  );

  printSection("Semantic Relation Detection (TF-IDF)");
  console.log("running semantic evaluator...");
  const semantic = evaluateSemantic(pairs);

  console.log(`  threshold: ${semantic.threshold}`);
  console.log(`  precision: ${pct(semantic.precision)}`);
  console.log(`  recall: ${pct(semantic.recall)}`);
  console.log(`  f1: ${fmt(semantic.f1)}`);
  console.log(`  accuracy: ${pct(semantic.accuracy)}`);
  console.log(`  false positive rate: ${pct(semantic.falsePositiveRate)}`);

  console.log("");
  console.log("  confusion matrix:");
  const cm = semantic.confusionMatrix;
  printTable(
    ["", "predicted related", "predicted unrelated"],
    [
      ["actual related", String(cm.truePositives), String(cm.falseNegatives)],
      ["actual unrelated", String(cm.falsePositives), String(cm.trueNegatives)],
    ],
    [20, 18, 20],
  );

  console.log("");
  console.log("  detection rate by relation type:");
  printTable(
    ["type", "total", "detected", "rate"],
    Object.entries(semantic.byRelationType).map(([type, stats]) => [
      type,
      String(stats.total),
      String(stats.detected),
      pct(stats.rate),
    ]),
    [20, 8, 10, 8],
  );

  if (semantic.falsePositiveExamples.length > 0) {
    console.log("");
    console.log("  worst false positives (flagged as related, actually unrelated):");
    for (const fp of semantic.falsePositiveExamples.slice(0, 5)) {
      console.log(`    score=${fmt(fp.score)} "${fp.marketA}" vs "${fp.marketB}"`);
    }
  }

  if (semantic.falseNegativeExamples.length > 0) {
    console.log("");
    console.log("  worst false negatives (missed, actually related):");
    for (const fn of semantic.falseNegativeExamples.slice(0, 5)) {
      console.log(`    score=${fmt(fn.score)} [${fn.trueRelationType}] "${fn.marketA}" vs "${fn.marketB}"`);
    }
  }

  printSection("Conditional Probability Calibration");
  console.log("running calibration simulation (500 trials x 2000 samples)...");
  const calibration = calibrateConditionals(500, 2000, 0.15);

  console.log(`  expected calibration error (ECE): ${fmt(calibration.ece)}`);
  console.log(`  brier score: ${fmt(calibration.brierScore)}`);
  console.log(`  mean absolute error: ${fmt(calibration.meanAbsoluteError)}`);
  console.log(`  frechet clamp rate: ${pct(calibration.clampRate)}`);
  console.log(`  noise sigma (simulated estimation error): ${calibration.noiseSigma}`);

  console.log("");
  console.log("  calibration table:");
  printTable(
    ["predicted bin", "n", "predicted mean", "empirical freq", "|error|"],
    calibration.bins.map((bin) => [
      bin.range,
      String(bin.nSamples),
      fmt(bin.predictedMean),
      fmt(bin.empiricalFrequency),
      fmt(bin.absoluteError),
    ]),
    [14, 6, 16, 16, 10],
  );

  printSection("Cascade Prediction Backtest");
  console.log("running cascade backtest (200 scenarios)...");
  const cascade = backtestCascades(200);

  console.log(`  total predictions: ${cascade.nPredictions}`);
  console.log(`  precision@1h: ${pct(cascade.precisionAt1h)} (${cascade.correctAt1h}/${cascade.nPredictions})`);
  console.log(`  precision@6h: ${pct(cascade.precisionAt6h)} (${cascade.correctAt6h}/${cascade.nPredictions})`);
  console.log(`  mean absolute error: ${fmt(cascade.mae)}`);
  console.log(`  false alarm rate: ${pct(cascade.falseAlarmRate)} (${cascade.nFalseAlarms}/${cascade.nPredictions})`);

  printHeader("END REPORT");

  return { semantic, calibration, cascade, dataset };
}

export type EvalReport = ReturnType<typeof runEvaluation>;

export { runEvaluation };

const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("eval/run.ts");

if (isDirectRun) {
  runEvaluation();
}
