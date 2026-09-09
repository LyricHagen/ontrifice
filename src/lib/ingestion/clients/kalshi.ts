import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";
import type { PlatformClient, RawMarket } from "../types";

const BASE_URL = "https://api.elections.kalshi.com/trade-api/v2";
const MAX_PAGES = 20;
const PAGE_SIZE = 100;
const MAX_RETRIES = 3;

interface KalshiMarket {
  ticker: string;
  title: string;
  subtitle?: string;
  category?: string;
  status: string;
  yes_bid: number;
  yes_ask: number;
  volume: number;
  open_interest?: number;
  result?: string;
}

interface KalshiResponse {
  markets: KalshiMarket[];
  cursor?: string;
}

function kalshiError(
  code: string,
  statusCode: number,
  message: string,
  details?: Record<string, unknown>,
): AppError {
  return new AppError(code, statusCode, message, { platform: "kalshi", ...details });
}

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        const backoff = Math.pow(2, attempt + 1);
        logger.warn(
          `Kalshi API rate limit hit. Backing off for ${backoff} seconds.`,
          "ERR_KALSHI_RATE_LIMIT",
          { attempt, backoff },
        );
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, backoff * 1000));
          continue;
        }
        throw kalshiError(
          "ERR_KALSHI_RATE_LIMIT",
          429,
          `Kalshi API rate limit hit. Backing off for ${backoff} seconds. This is normal during high-volume periods. (ERR_KALSHI_RATE_LIMIT)`,
        );
      }

      if (response.status >= 500) {
        const backoff = Math.pow(2, attempt + 1);
        logger.warn(
          `Kalshi API returned a server error (${response.status}).`,
          "ERR_KALSHI_SERVER",
          { statusCode: response.status, attempt },
        );
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, backoff * 1000));
          continue;
        }
        throw kalshiError(
          "ERR_KALSHI_SERVER",
          502,
          `Kalshi API returned a server error (${response.status}). Their service may be experiencing issues. Will retry in ${backoff} seconds. (ERR_KALSHI_SERVER)`,
          { statusCode: response.status },
        );
      }

      if (!response.ok) {
        throw kalshiError(
          "ERR_KALSHI_SERVER",
          502,
          `Kalshi API returned HTTP ${response.status}. (ERR_KALSHI_SERVER)`,
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
      throw kalshiError(
        "ERR_KALSHI_UNREACHABLE",
        502,
        `Could not reach Kalshi API. Check network connectivity. (ERR_KALSHI_UNREACHABLE)`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }
  throw kalshiError("ERR_KALSHI_UNREACHABLE", 502, "Could not reach Kalshi API. (ERR_KALSHI_UNREACHABLE)");
}

function parseStatus(market: KalshiMarket): "active" | "resolved" | "voided" {
  const s = market.status.toLowerCase();
  if (s === "finalized" || s === "settled") return "resolved";
  if (s === "voided" || s === "cancelled") return "voided";
  return "active";
}

function parseResolution(market: KalshiMarket): "yes" | "no" | "unresolved" | undefined {
  if (!market.result) return undefined;
  const r = market.result.toLowerCase();
  if (r === "yes") return "yes";
  if (r === "no") return "no";
  return "unresolved";
}

function toRawMarket(market: KalshiMarket): RawMarket | null {
  try {
    const yesBid = market.yes_bid / 100;
    const yesAsk = market.yes_ask / 100;
    const probability = (yesBid + yesAsk) / 2;

    return {
      platform: "kalshi",
      platformMarketId: market.ticker,
      title: market.title,
      description: market.subtitle,
      category: market.category,
      probability: probability >= 0 && probability <= 1 ? probability : undefined,
      volumeUsd: market.volume ? market.volume / 100 : undefined,
      status: parseStatus(market),
      resolution: parseResolution(market),
      metadata: {
        openInterest: market.open_interest,
        yesBid: market.yes_bid,
        yesAsk: market.yes_ask,
      },
    };
  } catch (error) {
    logger.warn(
      `Kalshi returned unexpected data format for market ${market.ticker}. This may indicate an API change.`,
      "ERR_KALSHI_PARSE",
      { ticker: market.ticker, error: error instanceof Error ? error.message : String(error) },
    );
    return null;
  }
}

export function createKalshiClient(): PlatformClient {
  return {
    platform: "kalshi",
    async fetchMarkets(): Promise<RawMarket[]> {
      const allMarkets: RawMarket[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < MAX_PAGES; page++) {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          status: "open",
        });
        if (cursor) params.set("cursor", cursor);

        const url = `${BASE_URL}/markets?${params}`;
        logger.debug(`Fetching Kalshi page ${page + 1}`, { url });

        const response = await fetchWithRetry(url);
        let data: KalshiResponse;

        try {
          data = (await response.json()) as KalshiResponse;
        } catch (error) {
          throw kalshiError(
            "ERR_KALSHI_PARSE",
            502,
            `Kalshi returned unexpected data format. This may indicate an API change. (ERR_KALSHI_PARSE)`,
            { error: error instanceof Error ? error.message : String(error) },
          );
        }

        const markets = data.markets ?? [];
        for (const m of markets) {
          const raw = toRawMarket(m);
          if (raw) allMarkets.push(raw);
        }

        if (!data.cursor || markets.length < PAGE_SIZE) break;
        cursor = data.cursor;
      }

      logger.info(`Kalshi: fetched ${allMarkets.length} markets`);
      return allMarkets;
    },
  };
}
