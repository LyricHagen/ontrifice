import { logger } from "@/lib/logger";
import type { RawMarket, NormalizedMarket } from "./types";

const CATEGORY_MAP: Record<string, string> = {
  politics: "politics",
  political: "politics",
  elections: "politics",
  sports: "sports",
  crypto: "crypto",
  cryptocurrency: "crypto",
  finance: "finance",
  economics: "finance",
  economy: "finance",
  science: "science",
  technology: "technology",
  tech: "technology",
  entertainment: "entertainment",
  culture: "entertainment",
  weather: "weather",
  climate: "weather",
};

function normalizeCategory(raw: string | undefined): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  return CATEGORY_MAP[lower] ?? lower;
}

function normalizeProbability(probability: number | undefined): string | null {
  if (probability == null || isNaN(probability)) return null;
  const clamped = Math.max(0, Math.min(1, probability));
  return clamped.toFixed(8);
}

function normalizeVolume(volumeUsd: number | undefined): string | null {
  if (volumeUsd == null || isNaN(volumeUsd)) return null;
  return Math.max(0, volumeUsd).toFixed(2);
}

export function normalizeMarket(raw: RawMarket): NormalizedMarket | null {
  if (!raw.platformMarketId || !raw.title) {
    logger.warn(
      `Skipping market from ${raw.platform}: missing required fields`,
      "WARN_NORMALIZE_SKIP",
      { platform: raw.platform, raw },
    );
    return null;
  }

  return {
    platform: raw.platform,
    platformMarketId: raw.platformMarketId,
    title: raw.title.trim(),
    description: raw.description?.trim() ?? null,
    resolutionRules: raw.resolutionRules?.trim() ?? null,
    category: normalizeCategory(raw.category),
    currentProbability: normalizeProbability(raw.probability),
    volumeUsd: normalizeVolume(raw.volumeUsd),
    status: raw.status,
    resolution: raw.resolution ?? null,
    metadata: raw.metadata ?? null,
    lastFetchedAt: new Date(),
  };
}

export function normalizeMarkets(rawMarkets: RawMarket[]): NormalizedMarket[] {
  const results: NormalizedMarket[] = [];
  for (const raw of rawMarkets) {
    const normalized = normalizeMarket(raw);
    if (normalized) results.push(normalized);
  }
  return results;
}
