"use client";

import type { MarketDetail, EdgeDetail } from "./types";
import { getEdgeStyle, getEdgeTypeKey, EDGE_TYPE_DESCRIPTIONS } from "./types";

interface DetailPanelProps {
  detail: MarketDetail | null;
  edgeDetail: EdgeDetail | null;
  mode: "market" | "edge";
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onNodeClick: (id: string) => void;
  onEdgeClick: (edgeId: string) => void;
  isBottomSheet: boolean;
}

function platformUrl(
  platform: string,
  platformMarketId: string,
  metadata: Record<string, unknown> | null,
): string | null {
  if (metadata && typeof metadata.url === "string") return metadata.url;
  switch (platform) {
    case "polymarket":
      return `https://polymarket.com/event/${platformMarketId}`;
    case "kalshi":
      return `https://kalshi.com/markets/${platformMarketId}`;
    default:
      return null;
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toISOString().slice(0, 10);
  } catch {
    return dateStr;
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs font-mono">
      <span className="text-text-secondary shrink-0">{label}</span>
      <span className="text-right" style={{ wordBreak: "break-word" }}>
        {value}
      </span>
    </div>
  );
}

function RelationTypeTag({ relationType }: { relationType: string }) {
  const labels: Record<string, string> = {
    mutually_exclusive: "mutual exclusion",
    implies: "implication",
    temporal_precondition: "temporal",
  };
  return (
    <span className="font-mono text-xs text-text-secondary">
      {labels[relationType] ?? relationType.replace(/_/g, " ")}
    </span>
  );
}

function EdgeDetailView({
  edgeDetail,
  onNodeClick,
}: {
  edgeDetail: EdgeDetail;
  onNodeClick: (id: string) => void;
}) {
  const { edge, sourceMarket, targetMarket } = edgeDetail;
  const evidence = edge.evidence ?? {};
  const typeKey = getEdgeTypeKey(edge.relationType, evidence);
  const description = EDGE_TYPE_DESCRIPTIONS[typeKey];
  const style = getEdgeStyle(edge.relationType, evidence);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="font-mono text-xs text-text-secondary uppercase tracking-wider">
          Relationship
        </span>
        <div className="text-sm font-semibold mt-1">{style.label}</div>
        {description && (
          <p className="text-xs text-text-secondary mt-1">{description}</p>
        )}
      </div>

      {sourceMarket && (
        <button
          onClick={() => onNodeClick(sourceMarket.id)}
          className="text-left border border-border px-2 py-1.5 text-xs font-mono"
          style={{ borderRadius: "2px" }}
        >
          <span
            className="text-text-secondary block"
            style={{ fontSize: "10px" }}
          >
            {edge.direction === "bidirectional"
              ? "MARKET A"
              : "SOURCE"}
          </span>
          <span className="block" style={{ wordBreak: "break-word" }}>
            {sourceMarket.title}
          </span>
          <span className="text-text-secondary">[{sourceMarket.platform}]</span>
        </button>
      )}

      {targetMarket && (
        <button
          onClick={() => onNodeClick(targetMarket.id)}
          className="text-left border border-border px-2 py-1.5 text-xs font-mono"
          style={{ borderRadius: "2px" }}
        >
          <span
            className="text-text-secondary block"
            style={{ fontSize: "10px" }}
          >
            {edge.direction === "bidirectional"
              ? "MARKET B"
              : "TARGET"}
          </span>
          <span className="block" style={{ wordBreak: "break-word" }}>
            {targetMarket.title}
          </span>
          <span className="text-text-secondary">[{targetMarket.platform}]</span>
        </button>
      )}

      <div className="border-t border-border pt-3 text-xs font-mono flex flex-col gap-1">
        <Row
          label="Confidence"
          value={parseFloat(edge.confidence).toFixed(3)}
        />
        <Row label="Score" value={parseFloat(edge.score).toFixed(3)} />
        {edge.modelVersion && (
          <Row label="Detection" value={edge.modelVersion} />
        )}
      </div>

      {edge.mathematicalSemantics && (
        <div className="border-t border-border pt-3">
          <span className="font-mono text-xs text-text-secondary uppercase tracking-wider block mb-2">
            Mathematical semantics
          </span>
          <div
            className="text-xs font-mono"
            style={{ lineHeight: "1.6", wordBreak: "break-word" }}
          >
            {edge.mathematicalSemantics}
          </div>
        </div>
      )}

      <div className="border-t border-border pt-3">
        <span className="font-mono text-xs text-text-secondary uppercase tracking-wider block mb-2">
          Collateral implication
        </span>
        <div
          className="text-xs text-text-secondary"
          style={{ lineHeight: "1.6" }}
        >
          If you hold positions in both markets, this relationship reduces your
          max loss by constraining which outcomes are simultaneously feasible.
        </div>
      </div>

      <div className="border-t border-border pt-3 text-xs font-mono text-text-secondary flex flex-col gap-1">
        <Row label="Observed" value={formatDate(edge.observedAt)} />
        {edge.validUntil && (
          <Row label="Valid until" value={formatDate(edge.validUntil)} />
        )}
        <Row
          label="Resolution match"
          value={edge.resolutionMatchStatus ?? "unverified"}
        />
      </div>
    </div>
  );
}

export function DetailPanel({
  detail,
  edgeDetail,
  mode,
  loading,
  error,
  onClose,
  onNodeClick,
  onEdgeClick,
  isBottomSheet,
}: DetailPanelProps) {
  const panelClasses = isBottomSheet
    ? "fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-border max-h-[60vh] overflow-y-auto"
    : "w-[280px] shrink-0 border-l border-border bg-surface overflow-y-auto";

  return (
    <div
      className={panelClasses}
      style={{ height: isBottomSheet ? "auto" : "100%" }}
    >
      <div className="px-3 py-3 border-b border-border flex items-center justify-between">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {mode === "edge" ? "Relationship" : "Market"}
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
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-3 bg-surface-raised animate-pulse"
                style={{
                  width: `${[100, 60, 40, 80, 50][i]}%`,
                  borderRadius: "2px",
                }}
              />
            ))}
          </div>
        )}

        {error && (
          <div className="text-sm font-mono">
            <p className="text-foreground mb-1">Failed to load details.</p>
            <p className="text-text-secondary text-xs">{error}</p>
          </div>
        )}

        {mode === "edge" && edgeDetail && !loading && (
          <EdgeDetailView edgeDetail={edgeDetail} onNodeClick={onNodeClick} />
        )}

        {mode === "market" && detail && !loading && (
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className="text-sm font-semibold leading-snug"
                style={{ wordBreak: "break-word" }}
              >
                {detail.market.title}
              </h2>
              <span className="font-mono text-xs text-text-secondary mt-1 inline-block">
                {detail.market.platform}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-text-secondary block">Probability</span>
                <span className="text-base font-bold">
                  {detail.market.currentProbability
                    ? `${(parseFloat(detail.market.currentProbability) * 100).toFixed(1)}%`
                    : "--"}
                </span>
              </div>
              <div>
                <span className="text-text-secondary block">Volume</span>
                <span>
                  {detail.market.volumeUsd
                    ? `$${parseFloat(detail.market.volumeUsd).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                    : "--"}
                </span>
              </div>
            </div>

            {/* Structural relationships */}
            {detail.edges.length > 0 && (
              <div>
                <span className="block text-xs font-mono text-text-secondary mb-2 uppercase tracking-wider">
                  Structural relationships (
                  {detail.edges.filter((e) => e.relationClass === "logical")
                    .length}
                  )
                </span>
                <div className="flex flex-col gap-1.5">
                  {detail.edges
                    .filter((e) => e.relationClass === "logical")
                    .sort(
                      (a, b) =>
                        parseFloat(b.confidence) - parseFloat(a.confidence),
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
                        <div
                          key={edge.id}
                          className="border border-border px-2 py-1.5 text-xs font-mono"
                          style={{ borderRadius: "2px" }}
                        >
                          <button
                            onClick={() => onNodeClick(neighborId)}
                            className="w-full text-left"
                          >
                            <span className="block truncate">{title}</span>
                          </button>
                          <div className="flex items-center justify-between mt-1">
                            <RelationTypeTag
                              relationType={edge.relationType}
                            />
                            <button
                              onClick={() => onEdgeClick(edge.id)}
                              className="text-accent"
                              style={{ fontSize: "10px" }}
                              aria-label="View relationship evidence"
                            >
                              details
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Link to platform */}
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

            {/* Link to analyzer */}
            <a
              href={`/analyzer`}
              className="text-xs font-mono text-accent"
            >
              Add to portfolio in Analyzer
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
