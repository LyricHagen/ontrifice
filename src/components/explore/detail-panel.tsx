"use client";

import type { MarketDetail, EdgeDetail } from "./types";

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

function classTag(rc: string): string {
  if (rc === "logical") return "[LOG]";
  if (rc === "statistical") return "[STAT]";
  return "[SEM]";
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toISOString().slice(0, 10);
  } catch {
    return dateStr;
  }
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
  const rc = edge.relationClass;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="font-mono text-xs text-text-secondary uppercase tracking-wider">
          Relation
        </span>
        <div className="text-sm font-semibold mt-1">
          {rc.charAt(0).toUpperCase() + rc.slice(1)} / {edge.relationType}
        </div>
      </div>

      {sourceMarket && (
        <button
          onClick={() => onNodeClick(sourceMarket.id)}
          className="text-left border border-border px-2 py-1.5 text-xs font-mono"
          style={{ borderRadius: "2px" }}
        >
          <span className="text-text-secondary block" style={{ fontSize: "10px" }}>SOURCE</span>
          <span className="block" style={{ wordBreak: "break-word" }}>{sourceMarket.title}</span>
          <span className="text-text-secondary">[{sourceMarket.platform}]</span>
        </button>
      )}

      {targetMarket && (
        <button
          onClick={() => onNodeClick(targetMarket.id)}
          className="text-left border border-border px-2 py-1.5 text-xs font-mono"
          style={{ borderRadius: "2px" }}
        >
          <span className="text-text-secondary block" style={{ fontSize: "10px" }}>TARGET</span>
          <span className="block" style={{ wordBreak: "break-word" }}>{targetMarket.title}</span>
          <span className="text-text-secondary">[{targetMarket.platform}]</span>
        </button>
      )}

      <div className="border-t border-border pt-3">
        {rc === "statistical" && (
          <StatisticalEvidence edge={edge} evidence={evidence} />
        )}
        {rc === "logical" && (
          <LogicalEvidence edge={edge} sourceMarket={sourceMarket} targetMarket={targetMarket} />
        )}
        {rc === "semantic" && (
          <SemanticEvidence edge={edge} evidence={evidence} />
        )}
      </div>

      <div className="border-t border-border pt-3 text-xs font-mono text-text-secondary flex flex-col gap-1">
        <Row label="Model version" value={edge.modelVersion ?? "--"} />
        <Row label="Observed" value={formatDate(edge.observedAt)} />
        {edge.validUntil && <Row label="Valid until" value={formatDate(edge.validUntil)} />}
      </div>
    </div>
  );
}

function StatisticalEvidence({
  edge,
  evidence,
}: {
  edge: EdgeDetail["edge"];
  evidence: Record<string, unknown>;
}) {
  const pearsonR = evidence.pearson_r ?? evidence.pearsonR;
  const rawP = evidence.raw_p_value ?? evidence.rawPValue ?? evidence.p_value ?? evidence.pValue;
  const fdrP = evidence.fdr_adjusted_p ?? evidence.fdrAdjustedP;
  const window = evidence.window ?? evidence.window_days;
  const lag = evidence.lag ?? evidence.lead_lag;
  const responseStdDev = evidence.response_std_dev ?? evidence.responseStdDev;
  const responseN = evidence.response_n ?? evidence.responseN;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="font-mono text-xs text-text-secondary uppercase tracking-wider block mb-2">
          Evidence
        </span>
        <div className="text-xs font-mono flex flex-col gap-1">
          {pearsonR != null && <Row label="Pearson r" value={formatNum(pearsonR, true)} />}
          {rawP != null && <Row label="Raw p-value" value={formatNum(rawP)} />}
          {fdrP != null && <Row label="FDR-adjusted p" value={formatNum(fdrP)} />}
          {window != null && <Row label="Window" value={`${window} days`} />}
          <Row label="Sample size" value={edge.sampleSize != null ? `${edge.sampleSize} observations` : "--"} />
          {lag != null && <Row label="Lag" value={String(lag)} />}
          <Row label="Score" value={parseFloat(edge.score).toFixed(3)} />
          <Row label="Confidence" value={parseFloat(edge.confidence).toFixed(3)} />
        </div>
      </div>

      {(responseStdDev != null || responseN != null) && (
        <div>
          <span className="font-mono text-xs text-text-secondary uppercase tracking-wider block mb-2">
            Historical response
          </span>
          <div className="text-xs font-mono text-text-secondary" style={{ lineHeight: "1.6" }}>
            {responseStdDev != null && (
              <span>
                When source moved +1 std dev, target moved {formatNum(responseStdDev, true)} std dev
                {responseN != null && <span> (mean, n={String(responseN)})</span>}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LogicalEvidence({
  edge,
  sourceMarket,
  targetMarket,
}: {
  edge: EdgeDetail["edge"];
  sourceMarket: EdgeDetail["sourceMarket"];
  targetMarket: EdgeDetail["targetMarket"];
}) {
  const srcTitle = sourceMarket?.title ?? "source market";
  const tgtTitle = targetMarket?.title ?? "target market";

  let basisText = "";
  if (edge.relationType === "implies") {
    basisText = `If [${srcTitle}] resolves YES, then [${tgtTitle}] must resolve YES.`;
  } else if (edge.relationType === "mutex") {
    basisText = `[${srcTitle}] and [${tgtTitle}] cannot both resolve YES.`;
  } else if (edge.relationType === "equivalent") {
    basisText = `[${srcTitle}] and [${tgtTitle}] must resolve identically.`;
  } else if (edge.mathematicalSemantics) {
    basisText = edge.mathematicalSemantics;
  } else {
    basisText = `Logical ${edge.relationType} between source and target.`;
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="font-mono text-xs text-text-secondary uppercase tracking-wider block mb-2">
          Basis
        </span>
        <div className="text-xs font-mono" style={{ lineHeight: "1.6", wordBreak: "break-word" }}>
          {basisText}
        </div>
      </div>

      <div className="text-xs font-mono flex flex-col gap-1">
        <Row label="Resolution match" value={edge.resolutionMatchStatus ?? "--"} />
        <Row label="Confidence" value={parseFloat(edge.confidence).toFixed(3)} />
        <Row label="Score" value={parseFloat(edge.score).toFixed(3)} />
      </div>
    </div>
  );
}

function SemanticEvidence({
  edge,
  evidence,
}: {
  edge: EdgeDetail["edge"];
  evidence: Record<string, unknown>;
}) {
  const cosineSim = evidence.cosine_similarity ?? evidence.cosineSimilarity;
  const sharedEntities = evidence.shared_entities ?? evidence.sharedEntities;
  const categoryMatch = evidence.category_match ?? evidence.categoryMatch;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="font-mono text-xs text-text-secondary uppercase tracking-wider block mb-2">
          Basis
        </span>
        <div className="text-xs font-mono flex flex-col gap-1">
          {cosineSim != null && <Row label="TF-IDF cosine similarity" value={formatNum(cosineSim)} />}
          {Array.isArray(sharedEntities) && sharedEntities.length > 0 && (
            <Row label="Shared entities" value={sharedEntities.join(", ")} />
          )}
          {categoryMatch != null && <Row label="Category match" value={String(categoryMatch)} />}
          <Row label="Score" value={parseFloat(edge.score).toFixed(3)} />
          <Row label="Confidence" value={parseFloat(edge.confidence).toFixed(3)} />
        </div>
      </div>

      <div className="text-xs font-mono text-text-secondary border-t border-border pt-2" style={{ lineHeight: "1.6" }}>
        WARNING: Textual similarity does not guarantee meaningful economic relationship.
      </div>

      <div className="text-xs font-mono flex flex-col gap-1">
        <Row label="Resolution match" value={edge.resolutionMatchStatus ?? "unverified"} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs font-mono">
      <span className="text-text-secondary shrink-0">{label}</span>
      <span className="text-right" style={{ wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function formatNum(val: unknown, showSign?: boolean): string {
  const n = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(n)) return String(val);
  const s = n.toFixed(3);
  return showSign && n > 0 ? `+${s}` : s;
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
    : "w-[320px] shrink-0 border-l border-border bg-surface overflow-y-auto";

  return (
    <div className={panelClasses} style={{ height: isBottomSheet ? "auto" : "100%" }}>
      <div className="px-3 py-3 border-b border-border flex items-center justify-between">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {mode === "edge" ? "Edge detail" : "Market detail"}
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
            <p className="text-foreground mb-1">
              {mode === "edge" ? "Failed to load edge details." : "Failed to load market details."}
            </p>
            <p className="text-text-secondary text-xs">{error}</p>
          </div>
        )}

        {mode === "edge" && edgeDetail && !loading && (
          <EdgeDetailView edgeDetail={edgeDetail} onNodeClick={onNodeClick} />
        )}

        {mode === "market" && detail && !loading && (
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
                        <div
                          key={edge.id}
                          className="border border-border px-2 py-1.5 text-xs font-mono flex items-start gap-1.5"
                          style={{ borderRadius: "2px" }}
                        >
                          <span className="text-accent shrink-0">
                            {directionArrow(
                              edge.direction,
                              detail.market.id,
                              edge.sourceMarketId,
                            )}
                          </span>
                          <button
                            onClick={() => onNodeClick(neighborId)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <span className="block truncate">{title}</span>
                            <span className="text-text-secondary">
                              {classTag(edge.relationClass)} {edge.relationType} &middot;{" "}
                              {parseFloat(edge.score).toFixed(3)}
                              {edge.relationClass === "statistical" && edge.sampleSize != null && (
                                <span> &middot; n={edge.sampleSize}</span>
                              )}
                            </span>
                          </button>
                          <button
                            onClick={() => onEdgeClick(edge.id)}
                            className="shrink-0 text-accent"
                            style={{ fontSize: "10px" }}
                            aria-label="View edge evidence"
                          >
                            evidence
                          </button>
                        </div>
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
