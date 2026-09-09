import { eq, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";
import { createPolymarketClient } from "./clients/polymarket";
import { createKalshiClient } from "./clients/kalshi";
import { createLimitlessClient } from "./clients/limitless";
import { normalizeMarkets } from "./normalizer";
import type { PlatformClient, NormalizedMarket, IngestionSummary, Platform } from "./types";

const PROBABILITY_CHANGE_THRESHOLD = 0.005;

function createClients(): PlatformClient[] {
  return [
    createPolymarketClient(),
    createKalshiClient(),
    createLimitlessClient(),
  ];
}

async function upsertMarket(
  market: NormalizedMarket,
): Promise<{ created: boolean; previousProbability: string | null }> {
  const existing = await db
    .select({
      id: schema.markets.id,
      currentProbability: schema.markets.currentProbability,
    })
    .from(schema.markets)
    .where(
      and(
        eq(schema.markets.platform, market.platform),
        eq(schema.markets.platformMarketId, market.platformMarketId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(schema.markets)
      .set({
        title: market.title,
        description: market.description,
        resolutionRules: market.resolutionRules,
        category: market.category,
        currentProbability: market.currentProbability,
        volumeUsd: market.volumeUsd,
        status: market.status,
        resolution: market.resolution,
        metadata: market.metadata,
        lastFetchedAt: market.lastFetchedAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.markets.id, existing[0].id));

    return { created: false, previousProbability: existing[0].currentProbability };
  }

  await db.insert(schema.markets).values({
    platform: market.platform,
    platformMarketId: market.platformMarketId,
    title: market.title,
    description: market.description,
    resolutionRules: market.resolutionRules,
    category: market.category,
    currentProbability: market.currentProbability,
    volumeUsd: market.volumeUsd,
    status: market.status,
    resolution: market.resolution,
    metadata: market.metadata,
    lastFetchedAt: market.lastFetchedAt,
  });

  return { created: true, previousProbability: null };
}

function shouldSnapshot(
  currentProbability: string | null,
  previousProbability: string | null,
): boolean {
  if (!currentProbability) return false;
  if (!previousProbability) return true;
  const diff = Math.abs(parseFloat(currentProbability) - parseFloat(previousProbability));
  return diff > PROBABILITY_CHANGE_THRESHOLD;
}

async function recordSnapshot(market: NormalizedMarket): Promise<void> {
  const row = await db
    .select({ id: schema.markets.id })
    .from(schema.markets)
    .where(
      and(
        eq(schema.markets.platform, market.platform),
        eq(schema.markets.platformMarketId, market.platformMarketId),
      ),
    )
    .limit(1);

  if (row.length === 0 || !market.currentProbability) return;

  await db.insert(schema.marketSnapshots).values({
    marketId: row[0].id,
    probability: market.currentProbability,
    volumeUsd: market.volumeUsd ?? "0",
  });
}

async function ingestPlatform(
  client: PlatformClient,
): Promise<{
  processed: number;
  created: number;
  updated: number;
  snapshots: number;
}> {
  const rawMarkets = await client.fetchMarkets();
  const normalized = normalizeMarkets(rawMarkets);

  let created = 0;
  let updated = 0;
  let snapshots = 0;

  for (const market of normalized) {
    const result = await upsertMarket(market);

    if (result.created) {
      created++;
      if (market.currentProbability) {
        await recordSnapshot(market);
        snapshots++;
      }
    } else {
      updated++;
      if (shouldSnapshot(market.currentProbability, result.previousProbability)) {
        await recordSnapshot(market);
        snapshots++;
      }
    }
  }

  return { processed: normalized.length, created, updated, snapshots };
}

export async function runIngestion(): Promise<IngestionSummary> {
  const clients = createClients();
  const results = await Promise.allSettled(
    clients.map((client) => ingestPlatform(client)),
  );

  const summary: IngestionSummary = {
    marketsProcessed: 0,
    marketsCreated: 0,
    marketsUpdated: 0,
    snapshotsRecorded: 0,
    errors: [],
  };

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const platform = clients[i].platform;

    if (result.status === "fulfilled") {
      summary.marketsProcessed += result.value.processed;
      summary.marketsCreated += result.value.created;
      summary.marketsUpdated += result.value.updated;
      summary.snapshotsRecorded += result.value.snapshots;
    } else {
      const error = result.reason;
      const entry = {
        platform: platform as Platform,
        code: error instanceof AppError ? error.code : "ERR_INGESTION_UNKNOWN",
        message: error instanceof Error ? error.message : String(error),
      };
      summary.errors.push(entry);
      logger.error(
        `Ingestion failed for ${platform}: ${entry.message}`,
        entry.code,
        { platform },
      );
    }
  }

  logger.info("Ingestion complete", {
    marketsProcessed: summary.marketsProcessed,
    marketsCreated: summary.marketsCreated,
    marketsUpdated: summary.marketsUpdated,
    snapshotsRecorded: summary.snapshotsRecorded,
    errorCount: summary.errors.length,
  });

  return summary;
}
