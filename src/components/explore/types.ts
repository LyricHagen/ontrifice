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
  edgeType: "semantic" | "temporal" | "structural" | "composite";
  weight: string;
  direction: "bidirectional" | "source_leads" | "target_leads";
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
    edgeType: string;
    weight: string;
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
  edgeTypes: Set<string>;
  minWeight: number;
}

export const PLATFORM_COLORS: Record<string, string> = {
  polymarket: "#4a7cff",
  kalshi: "#7c7c7c",
  limitless: "#a0522d",
};

export const EDGE_TYPE_COLORS: Record<string, { dark: string; light: string; opacity: number }> = {
  semantic: { dark: "#e5e5e5", light: "#0a0a0a", opacity: 0.2 },
  temporal: { dark: "#4a7cff", light: "#4a7cff", opacity: 0.3 },
  structural: { dark: "#ffffff", light: "#000000", opacity: 0.4 },
  composite: { dark: "#4a7cff", light: "#4a7cff", opacity: 0.5 },
};
