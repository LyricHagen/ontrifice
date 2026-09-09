export type Platform = "polymarket" | "kalshi" | "limitless";

export interface RawMarket {
  platform: Platform;
  platformMarketId: string;
  title: string;
  description?: string;
  resolutionRules?: string;
  category?: string;
  probability?: number;
  volumeUsd?: number;
  status: "active" | "resolved" | "voided";
  resolution?: "yes" | "no" | "unresolved";
  metadata?: Record<string, unknown>;
}

export interface NormalizedMarket {
  platform: Platform;
  platformMarketId: string;
  title: string;
  description: string | null;
  resolutionRules: string | null;
  category: string | null;
  currentProbability: string | null;
  volumeUsd: string | null;
  status: "active" | "resolved" | "voided";
  resolution: "yes" | "no" | "unresolved" | null;
  metadata: Record<string, unknown> | null;
  lastFetchedAt: Date;
}

export interface IngestionSummary {
  marketsProcessed: number;
  marketsCreated: number;
  marketsUpdated: number;
  snapshotsRecorded: number;
  errors: Array<{ platform: Platform; code: string; message: string }>;
}

export interface PlatformClient {
  platform: Platform;
  fetchMarkets(): Promise<RawMarket[]>;
}
