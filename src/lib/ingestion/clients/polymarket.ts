import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";
import type { PlatformClient, RawMarket } from "../types";

const BASE_URL = "https://gamma-api.polymarket.com";
const MAX_PAGES = 20;
const PAGE_SIZE = 100;
const MAX_RETRIES = 3;

interface PolymarketMarket {
  id: string;
  question: string;
  description?: string;
  category?: string;
  active: boolean;
  closed: boolean;
  volume: string;
  outcomePrices: string;
  outcomes: string;
  acceptingOrders: boolean;
  clobTokenIds?: string;
}

interface PolymarketResponse {
  data: PolymarketMarket[];
  next_cursor?: string;
}

function polymarketError(
  code: string,
  statusCode: number,
  message: string,
  details?: Record<string, unknown>,
): AppError {
  return new AppError(code, statusCode, message, { platform: "polymarket", ...details });
}

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        const backoff = Math.pow(2, attempt + 1);
        logger.warn(
          `Polymarket API rate limit hit. Backing off for ${backoff} seconds. This is normal during high-volume periods.`,
          "ERR_POLYMARKET_RATE_LIMIT",
          { attempt, backoff },
        );
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, backoff * 1000));
          continue;
        }
        throw polymarketError(
          "ERR_POLYMARKET_RATE_LIMIT",
          429,
          `Polymarket API rate limit hit. Backing off for ${backoff} seconds. This is normal during high-volume periods. (ERR_POLYMARKET_RATE_LIMIT)`,
        );
      }

      if (response.status >= 500) {
        const backoff = Math.pow(2, attempt + 1);
        logger.warn(
          `Polymarket API returned a server error (${response.status}). Their service may be experiencing issues. Will retry in ${backoff} seconds.`,
          "ERR_POLYMARKET_SERVER",
          { statusCode: response.status, attempt },
        );
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, backoff * 1000));
          continue;
        }
        throw polymarketError(
          "ERR_POLYMARKET_SERVER",
          502,
          `Polymarket API returned a server error (${response.status}). Their service may be experiencing issues. Will retry in ${backoff} seconds. (ERR_POLYMARKET_SERVER)`,
          { statusCode: response.status },
        );
      }

      if (!response.ok) {
        throw polymarketError(
          "ERR_POLYMARKET_SERVER",
          502,
          `Polymarket API returned HTTP ${response.status}. (ERR_POLYMARKET_SERVER)`,
          { statusCode: response.status },
        );
      }

      return response;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (attempt < retries) {
        const backoff = Math.pow(2, attempt + 1);
        await new Promise((r) => setTimeout(r, backoff * 1000));
        continue;
      }
      throw polymarketError(
        "ERR_POLYMARKET_UNREACHABLE",
        502,
        `Could not reach Polymarket API. Check network connectivity. (ERR_POLYMARKET_UNREACHABLE)`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }
  throw polymarketError("ERR_POLYMARKET_UNREACHABLE", 502, "Could not reach Polymarket API. (ERR_POLYMARKET_UNREACHABLE)");
}

function parseProbability(market: PolymarketMarket): number | undefined {
  try {
    const prices = JSON.parse(market.outcomePrices) as string[];
    const yesPrice = parseFloat(prices[0]);
    if (!isNaN(yesPrice) && yesPrice >= 0 && yesPrice <= 1) return yesPrice;
  } catch {
    // fall through
  }
  return undefined;
}

function parseStatus(market: PolymarketMarket): "active" | "resolved" | "voided" {
  if (market.closed && !market.active) return "resolved";
  if (!market.active && !market.closed) return "voided";
  return "active";
}

function toRawMarket(market: PolymarketMarket): RawMarket | null {
  try {
    return {
      platform: "polymarket",
      platformMarketId: market.id,
      title: market.question,
      description: market.description,
      resolutionRules: market.description ?? undefined,
      category: market.category,
      probability: parseProbability(market),
      volumeUsd: market.volume ? parseFloat(market.volume) : undefined,
      status: parseStatus(market),
      metadata: {
        outcomes: market.outcomes,
        clobTokenIds: market.clobTokenIds,
        acceptingOrders: market.acceptingOrders,
      },
    };
  } catch (error) {
    logger.warn(
      `Polymarket returned unexpected data format for market ${market.id}. This may indicate an API change.`,
      "ERR_POLYMARKET_PARSE",
      { marketId: market.id, error: error instanceof Error ? error.message : String(error) },
    );
    return null;
  }
}

export function createPolymarketClient(): PlatformClient {
  return {
    platform: "polymarket",
    async fetchMarkets(): Promise<RawMarket[]> {
      const allMarkets: RawMarket[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < MAX_PAGES; page++) {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          active: "true",
        });
        if (cursor) params.set("next_cursor", cursor);

        const url = `${BASE_URL}/markets?${params}`;
        logger.debug(`Fetching Polymarket page ${page + 1}`, { url });

        const response = await fetchWithRetry(url);
        let data: PolymarketResponse;

        try {
          const raw = await response.json();
          if (Array.isArray(raw)) {
            data = { data: raw };
          } else {
            data = raw as PolymarketResponse;
          }
        } catch (error) {
          throw polymarketError(
            "ERR_POLYMARKET_PARSE",
            502,
            `Polymarket returned unexpected data format. This may indicate an API change. (ERR_POLYMARKET_PARSE)`,
            { error: error instanceof Error ? error.message : String(error) },
          );
        }

        const markets = data.data ?? [];
        for (const m of markets) {
          const raw = toRawMarket(m);
          if (raw) allMarkets.push(raw);
        }

        if (!data.next_cursor || markets.length < PAGE_SIZE) break;
        cursor = data.next_cursor;
      }

      logger.info(`Polymarket: fetched ${allMarkets.length} markets`);
      return allMarkets;
    },
  };
}
