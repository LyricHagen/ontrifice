import { logger } from "@/lib/logger";
import type { PlatformClient, RawMarket } from "../types";

export function createLimitlessClient(): PlatformClient {
  return {
    platform: "limitless",
    async fetchMarkets(): Promise<RawMarket[]> {
      logger.info("Limitless: client not yet verified, skipping");
      return [];
    },
  };
}
