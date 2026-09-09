# Evaluation Framework

Measures whether Ontrifice's three core systems work: semantic relation detection, conditional probability estimation, and cascade prediction.

## Running

```sh
npm run eval
```

Or via the API (requires API key):

```sh
curl -X POST http://localhost:3000/api/eval \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## What it measures

### Semantic relation detection

Evaluates the TF-IDF cosine similarity detector against a hand-labeled dataset of 200 market pairs. The dataset spans six relation types: equivalent (same event, different wording), implies, mutually exclusive, correlated, lead/lag, and unrelated.

Metrics: precision, recall, F1, false positive rate, per-type detection rates, and a confusion matrix. Also surfaces the worst false positives and false negatives for manual inspection.

### Conditional probability calibration

Tests whether the Bernoulli joint probability estimator (P(A,B) = P(A)*P(B) + r*sigma) produces calibrated conditional probabilities. Since we lack sufficient resolved market data, this runs a simulation:

1. Generate 500 synthetic market pairs with known joint distributions
2. Add noise to the observed correlation (sigma=0.15) to simulate estimation error
3. Compare the system's predicted P(B|A) against empirical frequency from 2000 Monte Carlo samples per pair
4. Bin predictions into deciles and compute Expected Calibration Error (ECE) and Brier score

### Cascade prediction backtest

Tests whether cascade alerts (market A moved, so market B should move) are predictive. Uses a synthetic 20-market graph with known edge weights:

1. Simulate 200 trigger events (random market, random delta)
2. Generate cascade predictions via edge-weight propagation
3. Simulate actual price movements with realistic noise and partial propagation
4. Measure precision at 1-hour and 6-hour windows, mean absolute error, and false alarm rate

## Known limitations

- **TF-IDF is fundamentally weak.** It detects textual overlap, not logical or economic relationships. A pair like "FOMC holds rates" and "mortgage rates fall" shares few words despite strong causal linkage. The evaluation confirms this weakness quantitatively.
- **Sample sizes are small.** 200 ground truth pairs is enough to identify gross failures but not enough for statistically tight confidence intervals on per-type metrics.
- **Synthetic data is not real backtesting.** The calibration and cascade evaluators use simulated data with known ground truth. Real performance will differ because real markets have fat tails, regime changes, and correlated noise.
- **No out-of-sample split.** The ground truth is a single fixed set. The system was not trained on it (TF-IDF has no learning), but future ML-based detectors would need train/test separation.
- **Cascade backtest uses idealized propagation.** Real cascade behavior depends on liquidity, market hours, information asymmetry, and other factors not modeled here.

## What a production evaluation would look like

- **Larger labeled dataset.** 2000+ pairs, labeled by multiple annotators, with inter-annotator agreement measured (Cohen's kappa).
- **Out-of-sample testing.** Temporal split: train on pairs from before date X, test on pairs from after date X.
- **Real backtesting.** Use historical market snapshots to backtest cascade predictions against actual price movements. Rolling windows (e.g., evaluate each month using the prior 3 months as training).
- **Per-platform analysis.** Evaluate detection quality per platform (Polymarket vs Kalshi vs Limitless) since title conventions differ.
- **Embedding-based baseline.** Compare TF-IDF against a sentence transformer baseline to quantify the gap.
- **Calibration on resolved markets.** Once enough markets have resolved, replace simulation with empirical calibration on real outcomes.
- **Statistical significance.** Bootstrap confidence intervals on all metrics. Permutation tests for per-type detection rates.
