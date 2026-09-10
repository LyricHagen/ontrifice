import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";
import type { PlatformClient, RawMarket } from "../types";

const BASE_URL = "https://api.elections.kalshi.com/trade-api/v2";
const MAX_EVENTS = 50;
const MAX_MARKETS = 200;
const MAX_RETRIES = 3;

interface KalshiMarket {
  ticker: string;
  title: string;
  yes_sub_title?: string;
  event_ticker?: string;
  status: string;
  yes_bid_dollars: string;
  yes_ask_dollars: string;
  volume_fp: string;
  open_interest_fp?: string;
  last_price_dollars?: string;
  result?: string;
  rules_primary?: string;
  rules_secondary?: string;
  market_type?: string;
}

interface KalshiEvent {
  event_ticker: string;
  title: string;
  sub_title?: string;
  category?: string;
  mutually_exclusive?: boolean;
  markets?: KalshiMarket[];
}

interface KalshiEventsResponse {
  events: KalshiEvent[];
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

      if (response.status === 401 || response.status === 403) {
        logger.warn(
          "Kalshi: auth required, skipping",
          "ERR_KALSHI_AUTH_REQUIRED",
          { statusCode: response.status },
        );
        throw kalshiError(
          "ERR_KALSHI_AUTH_REQUIRED",
          response.status,
          "Kalshi API requires authentication for reading markets. Skipping Kalshi ingestion. (ERR_KALSHI_AUTH_REQUIRED)",
        );
      }

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
          `Kalshi API returned a server error (${response.status}). Their service may be experiencing issues. (ERR_KALSHI_SERVER)`,
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

function toRawMarket(market: KalshiMarket, eventCategory?: string): RawMarket | null {
  try {
    const yesBid = parseFloat(market.yes_bid_dollars);
    const yesAsk = parseFloat(market.yes_ask_dollars);
    const probability = (yesBid + yesAsk) / 2;
    const volume = parseFloat(market.volume_fp);

    return {
      platform: "kalshi",
      platformMarketId: market.ticker,
      title: market.title,
      description: market.yes_sub_title,
      resolutionRules: market.rules_primary || market.rules_secondary || undefined,
      category: eventCategory,
      probability: probability >= 0 && probability <= 1 ? probability : undefined,
      volumeUsd: !isNaN(volume) ? volume : undefined,
      status: parseStatus(market),
      resolution: parseResolution(market),
      metadata: {
        openInterest: market.open_interest_fp,
        yesBidDollars: market.yes_bid_dollars,
        yesAskDollars: market.yes_ask_dollars,
        eventTicker: market.event_ticker,
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

      for (let page = 0; page < MAX_EVENTS && allMarkets.length < MAX_MARKETS; page++) {
        const params = new URLSearchParams({
          limit: String(Math.min(MAX_EVENTS, 20)),
          status: "open",
          with_nested_markets: "true",
        });
        if (cursor) params.set("cursor", cursor);

        const url = `${BASE_URL}/events?${params}`;
        logger.debug(`Fetching Kalshi events page ${page + 1}`, { url });

        const response = await fetchWithRetry(url);
        let data: KalshiEventsResponse;

        try {
          data = (await response.json()) as KalshiEventsResponse;
        } catch (error) {
          throw kalshiError(
            "ERR_KALSHI_PARSE",
            502,
            `Kalshi returned unexpected data format. This may indicate an API change. (ERR_KALSHI_PARSE)`,
            { error: error instanceof Error ? error.message : String(error) },
          );
        }

        const events = data.events ?? [];
        for (const event of events) {
          const markets = event.markets ?? [];
          for (const m of markets) {
            if (allMarkets.length >= MAX_MARKETS) break;
            const raw = toRawMarket(m, event.category);
            if (raw && raw.status === "active") allMarkets.push(raw);
          }
          if (allMarkets.length >= MAX_MARKETS) break;
        }

        if (!data.cursor || events.length === 0) break;
        cursor = data.cursor;
      }

      logger.info(`Kalshi: fetched ${allMarkets.length} markets`);
      return allMarkets;
    },
  };
}
