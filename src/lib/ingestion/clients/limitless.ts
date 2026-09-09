import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";
import type { PlatformClient, RawMarket } from "../types";

const BASE_URL = "https://api.limitless.exchange/v1";
const MAX_PAGES = 20;
const PAGE_SIZE = 100;
const MAX_RETRIES = 3;

// TODO: confirm exact response shape against Limitless API docs
interface LimitlessMarket {
  id: string;
  title: string;
  description?: string;
  category?: string;
  status: string;
  probability?: number;
  volume?: number;
  outcomes?: Array<{ name: string; price: number }>;
}

interface LimitlessResponse {
  markets: LimitlessMarket[];
  next_cursor?: string;
}

function limitlessError(
  code: string,
  statusCode: number,
  message: string,
  details?: Record<string, unknown>,
): AppError {
  return new AppError(code, statusCode, message, { platform: "limitless", ...details });
}

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        const backoff = Math.pow(2, attempt + 1);
        logger.warn(
          `Limitless API rate limit hit. Backing off for ${backoff} seconds.`,
          "ERR_LIMITLESS_RATE_LIMIT",
          { attempt, backoff },
        );
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, backoff * 1000));
          continue;
        }
        throw limitlessError(
          "ERR_LIMITLESS_RATE_LIMIT",
          429,
          `Limitless API rate limit hit. Backing off for ${backoff} seconds. (ERR_LIMITLESS_RATE_LIMIT)`,
        );
      }

      if (response.status >= 500) {
        const backoff = Math.pow(2, attempt + 1);
        logger.warn(
          `Limitless API returned a server error (${response.status}).`,
          "ERR_LIMITLESS_SERVER",
          { statusCode: response.status, attempt },
        );
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, backoff * 1000));
          continue;
        }
        throw limitlessError(
          "ERR_LIMITLESS_SERVER",
          502,
          `Limitless API returned a server error (${response.status}). Their service may be experiencing issues. Will retry in ${backoff} seconds. (ERR_LIMITLESS_SERVER)`,
          { statusCode: response.status },
        );
      }

      if (!response.ok) {
        throw limitlessError(
          "ERR_LIMITLESS_SERVER",
          502,
          `Limitless API returned HTTP ${response.status}. (ERR_LIMITLESS_SERVER)`,
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
      throw limitlessError(
        "ERR_LIMITLESS_UNREACHABLE",
        502,
        `Could not reach Limitless API. Check network connectivity. (ERR_LIMITLESS_UNREACHABLE)`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }
  throw limitlessError("ERR_LIMITLESS_UNREACHABLE", 502, "Could not reach Limitless API. (ERR_LIMITLESS_UNREACHABLE)");
}

function parseStatus(market: LimitlessMarket): "active" | "resolved" | "voided" {
  const s = market.status?.toLowerCase() ?? "active";
  if (s === "resolved" || s === "settled" || s === "closed") return "resolved";
  if (s === "voided" || s === "cancelled") return "voided";
  return "active";
}

function parseProbability(market: LimitlessMarket): number | undefined {
  if (market.probability != null && market.probability >= 0 && market.probability <= 1) {
    return market.probability;
  }
  if (market.outcomes?.length) {
    const yesOutcome = market.outcomes.find((o) => o.name.toLowerCase() === "yes");
    if (yesOutcome && yesOutcome.price >= 0 && yesOutcome.price <= 1) {
      return yesOutcome.price;
    }
  }
  return undefined;
}

function toRawMarket(market: LimitlessMarket): RawMarket | null {
  try {
    return {
      platform: "limitless",
      platformMarketId: market.id,
      title: market.title,
      description: market.description,
      category: market.category,
      probability: parseProbability(market),
      volumeUsd: market.volume,
      status: parseStatus(market),
      metadata: {
        outcomes: market.outcomes,
      },
    };
  } catch (error) {
    logger.warn(
      `Limitless returned unexpected data format for market ${market.id}. This may indicate an API change.`,
      "ERR_LIMITLESS_PARSE",
      { marketId: market.id, error: error instanceof Error ? error.message : String(error) },
    );
    return null;
  }
}

export function createLimitlessClient(): PlatformClient {
  return {
    platform: "limitless",
    async fetchMarkets(): Promise<RawMarket[]> {
      const allMarkets: RawMarket[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < MAX_PAGES; page++) {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
        });
        if (cursor) params.set("cursor", cursor);

        const url = `${BASE_URL}/markets?${params}`;
        logger.debug(`Fetching Limitless page ${page + 1}`, { url });

        const response = await fetchWithRetry(url);
        let data: LimitlessResponse;

        try {
          const raw = await response.json();
          if (Array.isArray(raw)) {
            data = { markets: raw };
          } else {
            data = raw as LimitlessResponse;
          }
        } catch (error) {
          throw limitlessError(
            "ERR_LIMITLESS_PARSE",
            502,
            `Limitless returned unexpected data format. This may indicate an API change. (ERR_LIMITLESS_PARSE)`,
            { error: error instanceof Error ? error.message : String(error) },
          );
        }

        const markets = data.markets ?? [];
        for (const m of markets) {
          const raw = toRawMarket(m);
          if (raw) allMarkets.push(raw);
        }

        if (!data.next_cursor || markets.length < PAGE_SIZE) break;
        cursor = data.next_cursor;
      }

      logger.info(`Limitless: fetched ${allMarkets.length} markets`);
      return allMarkets;
    },
  };
}
