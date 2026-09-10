import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError } from "@/lib/errors";
import { normalizeMarket } from "@/lib/ingestion/normalizer";
import { createPolymarketClient } from "@/lib/ingestion/clients/polymarket";
import { createKalshiClient } from "@/lib/ingestion/clients/kalshi";
import { runFullPipeline } from "@/lib/engine/orchestrator";
import type { Platform, NormalizedMarket } from "@/lib/ingestion/types";

const MAX_DURATION_MS = 8000;
const BATCH_SIZE = 50;

interface CronState {
  platform: Platform;
  offset: number;
}

async function getState(): Promise<CronState> {
  const row = await db
    .select({ value: schema.ingestionState.value })
    .from(schema.ingestionState)
    .where(eq(schema.ingestionState.key, "ingestion_cursor"))
    .limit(1);

  if (row.length > 0 && row[0].value) {
    try {
      return JSON.parse(row[0].value) as CronState;
    } catch {
      // fall through
    }
  }

  return { platform: "polymarket", offset: 0 };
}

async function saveState(state: CronState): Promise<void> {
  const value = JSON.stringify(state);
  const existing = await db
    .select({ key: schema.ingestionState.key })
    .from(schema.ingestionState)
    .where(eq(schema.ingestionState.key, "ingestion_cursor"))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(schema.ingestionState)
      .set({ value, updatedAt: new Date() })
      .where(eq(schema.ingestionState.key, "ingestion_cursor"));
  } else {
    await db.insert(schema.ingestionState).values({
      key: "ingestion_cursor",
      value,
    });
  }
}

async function upsertMarket(market: NormalizedMarket): Promise<{ created: boolean }> {
  const existing = await db
    .select({ id: schema.markets.id })
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
        currentProbability: market.currentProbability,
        volumeUsd: market.volumeUsd,
        status: market.status,
        metadata: market.metadata,
        lastFetchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.markets.id, existing[0].id));
    return { created: false };
  }

  await db.insert(schema.markets).values(market);
  return { created: true };
}

export async function GET() {
  const startTime = Date.now();

  try {
    const state = await getState();
    let marketsProcessed = 0;
    let marketsCreated = 0;
    let marketsUpdated = 0;
    const errors: string[] = [];

    if (state.platform === "polymarket") {
      try {
        const client = createPolymarketClient();
        const rawMarkets = await client.fetchMarkets();
        const batch = rawMarkets.slice(state.offset, state.offset + BATCH_SIZE);

        for (const raw of batch) {
          if (Date.now() - startTime > MAX_DURATION_MS) break;
          const normalized = normalizeMarket(raw);
          if (!normalized) continue;
          const result = await upsertMarket(normalized);
          marketsProcessed++;
          if (result.created) marketsCreated++;
          else marketsUpdated++;
        }

        if (state.offset + BATCH_SIZE >= rawMarkets.length || state.offset + BATCH_SIZE >= 200) {
          state.platform = "kalshi";
          state.offset = 0;
        } else {
          state.offset += BATCH_SIZE;
        }
      } catch (error) {
        errors.push(`polymarket: ${error instanceof Error ? error.message : String(error)}`);
        state.platform = "kalshi";
        state.offset = 0;
      }
    } else {
      try {
        const client = createKalshiClient();
        const rawMarkets = await client.fetchMarkets();
        const batch = rawMarkets.slice(state.offset, state.offset + BATCH_SIZE);

        for (const raw of batch) {
          if (Date.now() - startTime > MAX_DURATION_MS) break;
          const normalized = normalizeMarket(raw);
          if (!normalized) continue;
          const result = await upsertMarket(normalized);
          marketsProcessed++;
          if (result.created) marketsCreated++;
          else marketsUpdated++;
        }

        if (state.offset + BATCH_SIZE >= rawMarkets.length || state.offset + BATCH_SIZE >= 200) {
          state.platform = "polymarket";
          state.offset = 0;
        } else {
          state.offset += BATCH_SIZE;
        }
      } catch (error) {
        errors.push(`kalshi: ${error instanceof Error ? error.message : String(error)}`);
        state.platform = "polymarket";
        state.offset = 0;
      }
    }

    await saveState(state);

    let graphSummary = null;
    try {
      graphSummary = await runFullPipeline();
    } catch (error) {
      errors.push(`graph: ${error instanceof Error ? error.message : String(error)}`);
    }

    return NextResponse.json({
      marketsProcessed,
      marketsCreated,
      marketsUpdated,
      graphSummary,
      errors,
      nextPlatform: state.platform,
      nextOffset: state.offset,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
