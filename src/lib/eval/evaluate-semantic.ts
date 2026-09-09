import type { GroundTruthPair } from "./ground-truth";

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "of", "in", "to",
  "for", "with", "on", "at", "from", "by", "about", "as", "into",
  "through", "during", "before", "after", "above", "below", "between",
  "out", "off", "over", "under", "again", "further", "then", "once",
  "here", "there", "when", "where", "why", "how", "all", "both", "each",
  "few", "more", "most", "other", "some", "such", "no", "nor", "not",
  "only", "own", "same", "so", "than", "too", "very", "and", "but",
  "or", "if", "while", "that", "this", "it", "its", "what", "which",
  "who", "whom", "these", "those", "i", "me", "my", "we", "our",
  "you", "your", "he", "him", "his", "she", "her", "they", "them",
  "their", "market", "prediction", "will", "yes", "no",
]);

const NAMED_ENTITY_PATTERNS = [
  /\b(?:fed|fomc|federal reserve)\b/gi,
  /\b(?:gdp|cpi|ppi|pce)\b/gi,
  /\b(?:s&p|nasdaq|dow|russell)\b/gi,
  /\b(?:bitcoin|btc|ethereum|eth|crypto)\b/gi,
  /\b(?:trump|biden|harris|desantis|obama)\b/gi,
  /\b(?:republican|democrat|gop)\b/gi,
  /\b(?:nato|un|eu|who|imf)\b/gi,
  /\b(?:china|russia|ukraine|iran|israel)\b/gi,
  /\b(?:interest rate|inflation|unemployment|recession)\b/gi,
  /\b(?:supreme court|congress|senate|house)\b/gi,
  /\b(?:election|primary|nomination|inauguration)\b/gi,
  /\b(?:q[1-4]\s*\d{4}|\d{4}\s*q[1-4])\b/gi,
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/gi,
];

const SEMANTIC_THRESHOLD = 0.3;
const CATEGORY_ENTITY_BONUS = 0.1;

type TfIdfVector = Map<string, number>;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s&'-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function extractNamedEntities(text: string): string[] {
  const entities: string[] = [];
  for (const pattern of NAMED_ENTITY_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) {
        entities.push(m.toLowerCase().trim());
      }
    }
  }
  return entities;
}

function cosineSimilarity(a: TfIdfVector, b: TfIdfVector): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, valA] of a) {
    normA += valA * valA;
    const valB = b.get(term);
    if (valB !== undefined) {
      dotProduct += valA * valB;
    }
  }

  for (const [, valB] of b) {
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

interface PairResult {
  pairIndex: number;
  marketA: string;
  marketB: string;
  trueLabel: "related" | "unrelated";
  trueRelationType: string;
  predictedRelated: boolean;
  score: number;
  sharedEntities: string[];
}

export interface SemanticReport {
  precision: number;
  recall: number;
  f1: number;
  falsePositiveRate: number;
  accuracy: number;
  threshold: number;
  confusionMatrix: {
    truePositives: number;
    falsePositives: number;
    trueNegatives: number;
    falseNegatives: number;
  };
  byRelationType: Record<
    string,
    { total: number; detected: number; rate: number }
  >;
  results: PairResult[];
  falsePositiveExamples: PairResult[];
  falseNegativeExamples: PairResult[];
}

export function evaluateSemantic(pairs: GroundTruthPair[]): SemanticReport {
  const allTitles: string[] = [];
  const titleIndex = new Map<string, number>();

  for (const pair of pairs) {
    if (!titleIndex.has(pair.market_a_title)) {
      titleIndex.set(pair.market_a_title, allTitles.length);
      allTitles.push(pair.market_a_title);
    }
    if (!titleIndex.has(pair.market_b_title)) {
      titleIndex.set(pair.market_b_title, allTitles.length);
      allTitles.push(pair.market_b_title);
    }
  }

  const docTokens: string[][] = allTitles.map((t) => tokenize(t));

  const documentFrequencies = new Map<string, number>();
  for (const tokens of docTokens) {
    const unique = new Set(tokens);
    for (const token of unique) {
      documentFrequencies.set(
        token,
        (documentFrequencies.get(token) ?? 0) + 1,
      );
    }
  }

  const totalDocs = allTitles.length;
  const vectors: TfIdfVector[] = [];

  for (const tokens of docTokens) {
    const vec: TfIdfVector = new Map();
    const termCounts = new Map<string, number>();
    for (const token of tokens) {
      termCounts.set(token, (termCounts.get(token) ?? 0) + 1);
    }
    for (const [term, count] of termCounts) {
      const tf = count / tokens.length;
      const df = documentFrequencies.get(term) ?? 1;
      const idf = Math.log(totalDocs / df);
      vec.set(term, tf * idf);
    }
    vectors.push(vec);
  }

  const entityCache: string[][] = allTitles.map((t) =>
    extractNamedEntities(t),
  );

  const results: PairResult[] = [];

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const idxA = titleIndex.get(pair.market_a_title)!;
    const idxB = titleIndex.get(pair.market_b_title)!;

    let similarity = cosineSimilarity(vectors[idxA], vectors[idxB]);

    const entitiesB = new Set(entityCache[idxB]);
    const shared = entityCache[idxA].filter((e) => entitiesB.has(e));

    if (shared.length > 0) {
      similarity += CATEGORY_ENTITY_BONUS * 0.5;
    }
    similarity = Math.min(similarity, 1);

    results.push({
      pairIndex: i,
      marketA: pair.market_a_title,
      marketB: pair.market_b_title,
      trueLabel: pair.true_label,
      trueRelationType: pair.true_relation_type,
      predictedRelated: similarity >= SEMANTIC_THRESHOLD,
      score: similarity,
      sharedEntities: shared,
    });
  }

  let tp = 0,
    fp = 0,
    tn = 0,
    fn = 0;
  for (const r of results) {
    if (r.predictedRelated && r.trueLabel === "related") tp++;
    else if (r.predictedRelated && r.trueLabel === "unrelated") fp++;
    else if (!r.predictedRelated && r.trueLabel === "unrelated") tn++;
    else fn++;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const falsePositiveRate = fp + tn > 0 ? fp / (fp + tn) : 0;
  const accuracy = results.length > 0 ? (tp + tn) / results.length : 0;

  const byRelationType: Record<
    string,
    { total: number; detected: number; rate: number }
  > = {};
  for (const r of results) {
    if (!byRelationType[r.trueRelationType]) {
      byRelationType[r.trueRelationType] = { total: 0, detected: 0, rate: 0 };
    }
    byRelationType[r.trueRelationType].total++;
    if (r.predictedRelated) {
      byRelationType[r.trueRelationType].detected++;
    }
  }
  for (const key of Object.keys(byRelationType)) {
    const entry = byRelationType[key];
    entry.rate = entry.total > 0 ? entry.detected / entry.total : 0;
  }

  const falsePositiveExamples = results
    .filter((r) => r.predictedRelated && r.trueLabel === "unrelated")
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const falseNegativeExamples = results
    .filter((r) => !r.predictedRelated && r.trueLabel === "related")
    .sort((a, b) => a.score - b.score)
    .slice(0, 10);

  return {
    precision,
    recall,
    f1,
    falsePositiveRate,
    accuracy,
    threshold: SEMANTIC_THRESHOLD,
    confusionMatrix: {
      truePositives: tp,
      falsePositives: fp,
      trueNegatives: tn,
      falseNegatives: fn,
    },
    byRelationType,
    results,
    falsePositiveExamples,
    falseNegativeExamples,
  };
}
