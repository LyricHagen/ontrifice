export type GraphMode = "empty" | "ego" | "browse";

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
  resolutionMatchStatus: string | null;
  evidence?: Record<string, unknown> | null;
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
    confidence: string;
    direction: string;
    sampleSize: number | null;
    resolutionMatchStatus: string | null;
  }>;
  connectedMarkets: Array<{
    id: string;
    title: string;
    platform: string;
    currentProbability: string | null;
  }>;
}

export interface EdgeDetail {
  edge: {
    id: string;
    sourceMarketId: string;
    targetMarketId: string;
    relationClass: string;
    relationType: string;
    score: string;
    confidence: string;
    direction: string;
    mathematicalSemantics: string | null;
    resolutionMatchStatus: string | null;
    evidence: Record<string, unknown> | null;
    modelVersion: string | null;
    algorithmParams: Record<string, unknown> | null;
    observedAt: string;
    validUntil: string | null;
    sampleSize: number | null;
  };
  sourceMarket: {
    id: string;
    title: string;
    platform: string;
    currentProbability: string | null;
  } | null;
  targetMarket: {
    id: string;
    title: string;
    platform: string;
    currentProbability: string | null;
  } | null;
}

export interface EdgeStyle {
  color: string;
  colorLight: string;
  width: number;
  dash: number[];
  directed: boolean;
  label: string;
}

export function getEdgeStyle(
  relationType: string,
  evidence?: Record<string, unknown> | null,
): EdgeStyle {
  const isExhaustive = evidence?.collectivelyExhaustive === true;

  if (relationType === "mutually_exclusive" && isExhaustive) {
    return {
      color: "#d4d4d4",
      colorLight: "#262626",
      width: 2,
      dash: [],
      directed: false,
      label: "ME + exhaustive",
    };
  }

  if (relationType === "mutually_exclusive") {
    return {
      color: "#b05050",
      colorLight: "#9a3030",
      width: 1.5,
      dash: [],
      directed: false,
      label: "mutual exclusion",
    };
  }

  if (relationType === "implies") {
    return {
      color: "#5080b0",
      colorLight: "#3060a0",
      width: 1,
      dash: [],
      directed: true,
      label: "implication",
    };
  }

  if (relationType === "temporal_precondition") {
    return {
      color: "#508060",
      colorLight: "#306040",
      width: 1,
      dash: [6, 4],
      directed: true,
      label: "temporal precondition",
    };
  }

  return {
    color: "#333333",
    colorLight: "#cccccc",
    width: 0.5,
    dash: [2, 3],
    directed: false,
    label: "semantic",
  };
}

export function getEdgeTypeKey(
  relationType: string,
  evidence?: Record<string, unknown> | null,
): string {
  if (
    relationType === "mutually_exclusive" &&
    evidence?.collectivelyExhaustive === true
  ) {
    return "mutually_exclusive+exhaustive";
  }
  return relationType;
}

export const NODE_COLORS: Record<
  string,
  { fill: string; fillLight: string; stroke: string; strokeLight: string }
> = {
  polymarket: {
    fill: "#5B8A9A",
    fillLight: "#4A7A8A",
    stroke: "#7AAAB8",
    strokeLight: "#3A6A7A",
  },
  kalshi: {
    fill: "#B8934A",
    fillLight: "#A8833A",
    stroke: "#D4AD6A",
    strokeLight: "#887030",
  },
  limitless: {
    fill: "#7c7c7c",
    fillLight: "#6c6c6c",
    stroke: "#9c9c9c",
    strokeLight: "#5c5c5c",
  },
};

export const EDGE_TYPE_DESCRIPTIONS: Record<string, string> = {
  mutually_exclusive:
    "These markets cannot both resolve YES. At most one outcome occurs.",
  complement:
    "Same binary question on different platforms. They resolve to the same truth value.",
  implies:
    "If the source market resolves YES, the target must also resolve YES.",
  temporal_precondition:
    "The source event must occur before the target event can occur.",
  "mutually_exclusive+exhaustive":
    "Full logical complements. Exactly one must resolve YES.",
};

export const LEGEND_ENTRIES: Array<{
  relationType: string;
  evidence?: Record<string, unknown>;
  label: string;
}> = [
  {
    relationType: "mutually_exclusive",
    evidence: { collectivelyExhaustive: true },
    label: "complement (ME + exhaustive)",
  },
  {
    relationType: "mutually_exclusive",
    label: "mutual exclusion",
  },
  {
    relationType: "complement",
    label: "complement (cross-platform)",
  },
  {
    relationType: "implies",
    label: "implication",
  },
];
