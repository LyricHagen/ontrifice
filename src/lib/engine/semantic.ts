import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

interface MarketDoc {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  metadata: Record<string, unknown> | null;
}

type TfIdfVector = Map<string, number>;

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

function buildInvertedIndex(
  docs: MarketDoc[],
): { index: Map<string, Set<number>>; docTokens: string[][] } {
  const index = new Map<string, Set<number>>();
  const docTokens: string[][] = [];

  for (let i = 0; i < docs.length; i++) {
    const text = [docs[i].title, docs[i].description ?? ""].join(" ");
    const tokens = tokenize(text);
    docTokens.push(tokens);

    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      if (!index.has(token)) {
        index.set(token, new Set());
      }
      index.get(token)!.add(i);
    }
  }

  return { index, docTokens };
}

function computeTfIdf(
  docTokens: string[][],
  totalDocs: number,
  documentFrequencies: Map<string, number>,
): TfIdfVector[] {
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

  return vectors;
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

const SEMANTIC_THRESHOLD = 0.3;
const CATEGORY_ENTITY_BONUS = 0.1;

export interface SemanticEdge {
  sourceMarketId: string;
  targetMarketId: string;
  weight: number;
  confidence: number;
  evidence: {
    cosineSimilarity: number;
    sharedEntities: string[];
    categoryMatch: boolean;
  };
}

export async function detectSemanticDependencies(): Promise<SemanticEdge[]> {
  logger.info("starting semantic dependency detection");

  const activeMarkets = await db
    .select({
      id: schema.markets.id,
      title: schema.markets.title,
      description: schema.markets.description,
      category: schema.markets.category,
      metadata: schema.markets.metadata,
    })
    .from(schema.markets)
    .where(eq(schema.markets.status, "active"));

  if (activeMarkets.length < 2) {
    logger.info("fewer than 2 active markets, skipping semantic detection");
    return [];
  }

  logger.info("building inverted index", { marketCount: activeMarkets.length });

  const { index, docTokens } = buildInvertedIndex(activeMarkets);

  const documentFrequencies = new Map<string, number>();
  for (const [token, docSet] of index) {
    documentFrequencies.set(token, docSet.size);
  }

  const vectors = computeTfIdf(docTokens, activeMarkets.length, documentFrequencies);

  const marketEntities: string[][] = activeMarkets.map((m) =>
    extractNamedEntities([m.title, m.description ?? ""].join(" ")),
  );

  const candidatePairs = new Set<string>();
  for (const [, docSet] of index) {
    if (docSet.size > activeMarkets.length * 0.5) continue;
    const docArray = Array.from(docSet);
    for (let i = 0; i < docArray.length; i++) {
      for (let j = i + 1; j < docArray.length; j++) {
        const key = docArray[i] < docArray[j]
          ? `${docArray[i]}:${docArray[j]}`
          : `${docArray[j]}:${docArray[i]}`;
        candidatePairs.add(key);
      }
    }
  }

  logger.info("computing similarities", { candidatePairs: candidatePairs.size });

  const edges: SemanticEdge[] = [];

  for (const pair of candidatePairs) {
    const [iStr, jStr] = pair.split(":");
    const i = parseInt(iStr, 10);
    const j = parseInt(jStr, 10);

    let similarity = cosineSimilarity(vectors[i], vectors[j]);

    const entitiesB = new Set(marketEntities[j]);
    const shared = marketEntities[i].filter((e) => entitiesB.has(e));

    const categoryMatch =
      activeMarkets[i].category !== null &&
      activeMarkets[i].category === activeMarkets[j].category;

    if (shared.length > 0 && categoryMatch) {
      similarity += CATEGORY_ENTITY_BONUS;
    } else if (shared.length > 0 || categoryMatch) {
      similarity += CATEGORY_ENTITY_BONUS * 0.5;
    }

    similarity = Math.min(similarity, 1);

    if (similarity >= SEMANTIC_THRESHOLD) {
      edges.push({
        sourceMarketId: activeMarkets[i].id,
        targetMarketId: activeMarkets[j].id,
        weight: similarity,
        confidence: Math.min(similarity * 1.2, 1),
        evidence: {
          cosineSimilarity: similarity,
          sharedEntities: shared,
          categoryMatch,
        },
      });
    }
  }

  logger.info("semantic detection complete", { edgesFound: edges.length });
  return edges;
}
