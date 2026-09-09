"use client";

import type { MarketDetail } from "./types";

interface DetailPanelProps {
  detail: MarketDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onNodeClick: (id: string) => void;
  isBottomSheet: boolean;
}

function platformUrl(platform: string, platformMarketId: string, metadata: Record<string, unknown> | null): string | null {
  if (metadata && typeof metadata.url === "string") return metadata.url;
  switch (platform) {
    case "polymarket":
      return `https://polymarket.com/event/${platformMarketId}`;
    case "kalshi":
      return `https://kalshi.com/markets/${platformMarketId}`;
    case "limitless":
      return `https://limitless.exchange/markets/${platformMarketId}`;
    default:
      return null;
  }
}

function directionArrow(direction: string, marketId: string, sourceId: string): string {
  if (direction === "bidirectional") return "<->";
  if (direction === "source_leads") return sourceId === marketId ? "->" : "<-";
  return sourceId === marketId ? "<-" : "->";
}

export function DetailPanel({
  detail,
  loading,
  error,
  onClose,
  onNodeClick,
  isBottomSheet,
}: DetailPanelProps) {
  const panelClasses = isBottomSheet
    ? "fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-border max-h-[60vh] overflow-y-auto"
    : "w-[320px] shrink-0 border-l border-border bg-surface overflow-y-auto";

  return (
    <div className={panelClasses} style={{ height: isBottomSheet ? "auto" : "100%" }}>
      <div className="px-3 py-3 border-b border-border flex items-center justify-between">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Market detail
        </span>
        <button
          onClick={onClose}
          className="font-mono text-sm text-text-secondary"
          aria-label="Close detail panel"
        >
          X
        </button>
      </div>

      <div className="px-3 py-3">
        {loading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-3 bg-surface-raised animate-pulse"
                style={{
                  width: `${[100, 60, 40, 80, 70, 50][i]}%`,
                  borderRadius: "2px",
                }}
              />
            ))}
          </div>
        )}

        {error && (
          <div className="text-sm font-mono">
            <p className="text-foreground mb-1">Failed to load market details.</p>
            <p className="text-text-secondary text-xs">{error}</p>
          </div>
        )}

        {detail && !loading && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold leading-snug">
                {detail.market.title}
              </h2>
              <span className="font-mono text-xs text-text-secondary mt-1 inline-block">
                [{detail.market.platform}]
              </span>
            </div>

            <div>
              <span className="font-mono text-2xl font-bold">
                {detail.market.currentProbability
                  ? `${(parseFloat(detail.market.currentProbability) * 100).toFixed(1)}%`
                  : "--"}
              </span>
              <span className="text-xs text-text-secondary ml-2">probability</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-text-secondary block">Volume</span>
                <span>
                  {detail.market.volumeUsd
                    ? `$${parseFloat(detail.market.volumeUsd).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                    : "--"}
                </span>
              </div>
              <div>
                <span className="text-text-secondary block">Category</span>
                <span>{detail.market.category ?? "--"}</span>
              </div>
              <div>
                <span className="text-text-secondary block">Status</span>
                <span>{detail.market.status}</span>
              </div>
            </div>

            {detail.connectedMarkets.length > 0 && (
              <div>
                <span className="block text-xs font-mono text-text-secondary mb-2 uppercase tracking-wider">
                  Connected markets ({detail.connectedMarkets.length})
                </span>
                <div className="flex flex-col gap-1.5">
                  {detail.edges
                    .sort(
                      (a, b) => parseFloat(b.score) - parseFloat(a.score),
                    )
                    .map((edge) => {
                      const neighborId =
                        edge.sourceMarketId === detail.market.id
                          ? edge.targetMarketId
                          : edge.sourceMarketId;
                      const neighbor = detail.connectedMarkets.find(
                        (m) => m.id === neighborId,
                      );
                      if (!neighbor) return null;
                      const title =
                        neighbor.title.length > 35
                          ? neighbor.title.slice(0, 35) + "..."
                          : neighbor.title;
                      return (
                        <button
                          key={edge.id}
                          onClick={() => onNodeClick(neighborId)}
                          className="text-left border border-border px-2 py-1.5 text-xs font-mono flex items-start gap-1.5"
                          style={{ borderRadius: "2px" }}
                        >
                          <span className="text-accent shrink-0">
                            {directionArrow(
                              edge.direction,
                              detail.market.id,
                              edge.sourceMarketId,
                            )}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block truncate">{title}</span>
                            <span className="text-text-secondary">
                              {edge.relationClass}/{edge.relationType} &middot;{" "}
                              {parseFloat(edge.score).toFixed(3)}
                            </span>
                            {edge.relationClass === "semantic" && edge.resolutionMatchStatus && edge.resolutionMatchStatus !== "verified_equivalent" && (
                              <span className="block text-text-secondary mt-0.5" style={{ fontSize: "10px" }}>
                                {edge.resolutionMatchStatus === "divergent"
                                  ? "RESOLUTION: DIVERGENT"
                                  : edge.resolutionMatchStatus === "unverified"
                                    ? "RESOLUTION: UNVERIFIED"
                                    : "RESOLUTION: LIKELY EQUIVALENT"}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {(() => {
              const url = platformUrl(
                detail.market.platform,
                detail.market.platformMarketId,
                detail.market.metadata,
              );
              if (!url) return null;
              return (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-accent"
                >
                  View on {detail.market.platform}
                </a>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
