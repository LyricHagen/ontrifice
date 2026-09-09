export interface MarketNode {
  id: string;
  platform: "polymarket" | "kalshi" | "limitless";
  platformMarketId: string;
  title: string;
  category: string | null;
  currentProbability: string | null;
  volumeUsd: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphEdge {
  id: string;
  sourceMarketId: string;
  targetMarketId: string;
  relationClass: "logical" | "statistical" | "semantic";
  relationType: string;
  score: string;
  confidence: string;
  direction: "bidirectional" | "source_leads" | "target_leads";
  mathematicalSemantics: string | null;
  modelVersion: string | null;
  sampleSize: number | null;
}

export interface GraphData {
  markets: MarketNode[];
  edges: GraphEdge[];
}

export interface MarketDetail {
  market: {
    id: string;
    platform: string;
    platformMarketId: string;
    title: string;
    description: string | null;
    category: string | null;
    currentProbability: string | null;
    volumeUsd: string | null;
    status: string;
    metadata: Record<string, unknown> | null;
  };
  edges: Array<{
    id: string;
    sourceMarketId: string;
    targetMarketId: string;
    relationClass: string;
    relationType: string;
    score: string;
    direction: string;
  }>;
  connectedMarkets: Array<{
    id: string;
    title: string;
    platform: string;
    currentProbability: string | null;
  }>;
}

export interface Filters {
  search: string;
  platforms: Set<string>;
  categories: Set<string>;
  relationClasses: Set<string>;
  minScore: number;
}

export const PLATFORM_COLORS: Record<string, string> = {
  polymarket: "#4a7cff",
  kalshi: "#7c7c7c",
  limitless: "#a0522d",
};

export const RELATION_CLASS_COLORS: Record<string, { dark: string; light: string; opacity: number }> = {
  semantic: { dark: "#e5e5e5", light: "#0a0a0a", opacity: 0.2 },
  statistical: { dark: "#4a7cff", light: "#4a7cff", opacity: 0.3 },
  logical: { dark: "#ffffff", light: "#000000", opacity: 0.4 },
};
