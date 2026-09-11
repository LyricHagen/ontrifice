"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GraphCanvas } from "./graph-canvas";
import { DetailPanel } from "./detail-panel";
import type {
  GraphMode,
  MarketNode,
  GraphEdge,
  MarketDetail,
  EdgeDetail,
} from "./types";

interface MarketSearchResult {
  id: string;
  title: string;
  platform: string;
  currentProbability: string | null;
}

interface Stats {
  marketsCount: number;
  structuralEdges: number;
  constraintTypes: number;
}

function MarketSearch({
  onSelect,
  autoFocus,
  placeholder,
}: {
  onSelect: (market: MarketSearchResult) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const search = useCallback((q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    fetch(
      `/api/markets?search=${encodeURIComponent(q)}&limit=10&sort=volume&order=desc`,
    )
      .then((r) => r.json())
      .then((data) => {
        setResults(
          (data.markets ?? []).map((m: Record<string, unknown>) => ({
            id: m.id as string,
            title: m.title as string,
            platform: m.platform as string,
            currentProbability: m.currentProbability as string | null,
          })),
        );
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder={
          placeholder ?? "Search for a market to explore its constraints..."
        }
        className="w-full bg-surface border border-border px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted"
        style={{ borderRadius: "2px" }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => search(e.target.value), 300);
        }}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
      />
      {open && query.length >= 2 && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 border border-border bg-surface max-h-60 overflow-y-auto"
          style={{ borderRadius: "2px" }}
        >
          {loading && (
            <div className="px-3 py-2 text-xs text-text-secondary font-mono">
              Searching...
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-text-secondary font-mono">
              No markets found.
            </div>
          )}
          {results.map((m) => (
            <button
              key={m.id}
              className="w-full text-left px-3 py-2 text-sm font-mono hover:bg-surface-raised border-b border-border last:border-b-0 cursor-pointer bg-transparent text-foreground"
              onClick={() => {
                onSelect(m);
                setQuery("");
                setResults([]);
                setOpen(false);
              }}
            >
              <div className="truncate">{m.title}</div>
              <div className="text-xs text-text-secondary mt-0.5">
                {m.platform}
                {m.currentProbability
                  ? ` / ${(parseFloat(m.currentProbability) * 100).toFixed(1)}%`
                  : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Explorer({
  focusMarketId,
  initialMode,
}: {
  focusMarketId: string | null;
  initialMode?: GraphMode;
}) {
  const [mode, setMode] = useState<GraphMode>(
    focusMarketId ? "ego" : initialMode ?? "empty",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nodes, setNodes] = useState<MarketNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);

  const [focalNodeId, setFocalNodeId] = useState<string | null>(
    focusMarketId,
  );
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MarketDetail | null>(null);
  const [edgeDetail, setEdgeDetail] = useState<EdgeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"market" | "edge">("market");

  const [stats, setStats] = useState<Stats | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [browseHiddenCount, setBrowseHiddenCount] = useState(0);

  const centerOnNodeRef = useRef<((id: string) => void) | null>(null);

  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < 768);
    }
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch stats for empty state
  useEffect(() => {
    if (mode !== "empty") return;
    Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/constraints?class=logical&limit=1").then((r) => r.json()),
    ])
      .then(([statsData, constraintsData]) => {
        setStats({
          marketsCount: statsData.marketsCount ?? 0,
          structuralEdges: constraintsData.total ?? 0,
          constraintTypes: statsData.constraintTypes ?? 0,
        });
      })
      .catch(() => {});
  }, [mode]);

  // Load ego graph
  const loadEgoGraph = useCallback(
    async (marketId: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/graph/edges?market_id=${encodeURIComponent(marketId)}&depth=1&relation_class=logical`,
        );
        if (!res.ok) {
          const body = await res.json();
          throw new Error(
            body?.error?.message ??
              `Failed to load graph (HTTP ${res.status}).`,
          );
        }
        const data = await res.json();
        const fetchedNodes: MarketNode[] = (data.nodes ?? []).map(
          (n: Record<string, unknown>) => ({
            id: n.id,
            platform: n.platform ?? "polymarket",
            platformMarketId: n.platformMarketId ?? "",
            title: n.title ?? "Unknown",
            category: n.category ?? null,
            currentProbability: n.currentProbability ?? null,
            volumeUsd: n.volumeUsd ?? null,
            status: n.status ?? "active",
            metadata: n.metadata ?? null,
          }),
        );
        const fetchedEdges: GraphEdge[] = (data.edges ?? []).map(
          (e: Record<string, unknown>) => ({
            id: e.id,
            sourceMarketId: e.sourceMarketId,
            targetMarketId: e.targetMarketId,
            relationClass: e.relationClass ?? "logical",
            relationType: e.relationType ?? "mutually_exclusive",
            score: String(e.score ?? "0"),
            confidence: String(e.confidence ?? "0"),
            direction: e.direction ?? "bidirectional",
            mathematicalSemantics: e.mathematicalSemantics ?? null,
            modelVersion: e.modelVersion ?? null,
            sampleSize: e.sampleSize ?? null,
            resolutionMatchStatus: e.resolutionMatchStatus ?? null,
            evidence: e.evidence ?? null,
          }),
        );

        setFocalNodeId(marketId);
        setNodes(fetchedNodes);
        setEdges(fetchedEdges);
        setExpandedNodes(new Set());
        setMode("ego");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load constraint graph. (ERR_EGO_GRAPH)",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Expand node in ego mode
  const handleExpandNode = useCallback(
    async (nodeId: string) => {
      if (expandedNodes.has(nodeId)) return;
      try {
        const res = await fetch(
          `/api/graph/edges?market_id=${encodeURIComponent(nodeId)}&depth=1&relation_class=logical`,
        );
        if (!res.ok) return;
        const data = await res.json();

        const existingNodeIds = new Set(nodes.map((n) => n.id));
        const newNodes: MarketNode[] = (data.nodes ?? [])
          .filter((n: Record<string, unknown>) => !existingNodeIds.has(n.id as string))
          .map((n: Record<string, unknown>) => ({
            id: n.id,
            platform: n.platform ?? "polymarket",
            platformMarketId: n.platformMarketId ?? "",
            title: n.title ?? "Unknown",
            category: n.category ?? null,
            currentProbability: n.currentProbability ?? null,
            volumeUsd: n.volumeUsd ?? null,
            status: n.status ?? "active",
            metadata: n.metadata ?? null,
          }));

        const existingEdgeIds = new Set(edges.map((e) => e.id));
        const newEdges: GraphEdge[] = (data.edges ?? [])
          .filter((e: Record<string, unknown>) => !existingEdgeIds.has(e.id as string))
          .map((e: Record<string, unknown>) => ({
            id: e.id,
            sourceMarketId: e.sourceMarketId,
            targetMarketId: e.targetMarketId,
            relationClass: e.relationClass ?? "logical",
            relationType: e.relationType ?? "mutually_exclusive",
            score: String(e.score ?? "0"),
            confidence: String(e.confidence ?? "0"),
            direction: e.direction ?? "bidirectional",
            mathematicalSemantics: e.mathematicalSemantics ?? null,
            modelVersion: e.modelVersion ?? null,
            sampleSize: e.sampleSize ?? null,
            resolutionMatchStatus: e.resolutionMatchStatus ?? null,
            evidence: e.evidence ?? null,
          }));

        setNodes((prev) => [...prev, ...newNodes]);
        setEdges((prev) => [...prev, ...newEdges]);
        setExpandedNodes((prev) => new Set(prev).add(nodeId));
      } catch {
        // Silently fail expansion
      }
    },
    [nodes, edges, expandedNodes],
  );

  // Load browse mode
  const loadBrowseGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/graph/explorer?relation_class=logical");
      if (!res.ok) {
        const body = await res.json();
        throw new Error(
          body?.error?.message ??
            `Failed to load graph (HTTP ${res.status}).`,
        );
      }
      const data = await res.json();

      const rawMarkets: MarketNode[] = (data.markets ?? []).map(
        (m: Record<string, unknown>) => ({
          id: m.id,
          platform: m.platform ?? "polymarket",
          platformMarketId: m.platformMarketId ?? "",
          title: m.title ?? "Unknown",
          category: m.category ?? null,
          currentProbability: m.currentProbability ?? null,
          volumeUsd: m.volumeUsd ?? null,
          status: m.status ?? "active",
          metadata: m.metadata ?? null,
        }),
      );

      const rawEdges: GraphEdge[] = (data.edges ?? []).map(
        (e: Record<string, unknown>) => ({
          id: e.id,
          sourceMarketId: e.sourceMarketId,
          targetMarketId: e.targetMarketId,
          relationClass: e.relationClass ?? "logical",
          relationType: e.relationType ?? "mutually_exclusive",
          score: String(e.score ?? "0"),
          confidence: String(e.confidence ?? "0"),
          direction: e.direction ?? "bidirectional",
          mathematicalSemantics: e.mathematicalSemantics ?? null,
          modelVersion: e.modelVersion ?? null,
          sampleSize: e.sampleSize ?? null,
          resolutionMatchStatus: e.resolutionMatchStatus ?? null,
          evidence: e.evidence ?? null,
        }),
      );

      // Only show markets that participate in at least one structural edge
      const marketIdsWithEdges = new Set<string>();
      for (const e of rawEdges) {
        marketIdsWithEdges.add(e.sourceMarketId);
        marketIdsWithEdges.add(e.targetMarketId);
      }
      const filteredMarkets = rawMarkets.filter((m) =>
        marketIdsWithEdges.has(m.id),
      );
      setBrowseHiddenCount(rawMarkets.length - filteredMarkets.length);

      setFocalNodeId(null);
      setNodes(filteredMarkets);
      setEdges(rawEdges);
      setExpandedNodes(new Set());
      setMode("browse");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load structural network. (ERR_BROWSE_GRAPH)",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Focus market from URL param
  useEffect(() => {
    if (focusMarketId && mode === "ego" && nodes.length === 0) {
      loadEgoGraph(focusMarketId);
    }
  }, [focusMarketId, mode, nodes.length, loadEgoGraph]);

  // Load browse mode from URL param
  useEffect(() => {
    if (initialMode === "browse" && mode === "browse" && nodes.length === 0) {
      loadBrowseGraph();
    }
  }, [initialMode, mode, nodes.length, loadBrowseGraph]);

  // Select market from search
  const handleSearchSelect = useCallback(
    (market: MarketSearchResult) => {
      loadEgoGraph(market.id);
    },
    [loadEgoGraph],
  );

  // Node click
  const handleNodeClick = useCallback(
    async (id: string) => {
      setSelectedNodeId(id);
      setSelectedEdgeId(null);
      setPanelMode("market");
      setDetailLoading(true);
      setDetailError(null);
      try {
        const res = await fetch(`/api/markets/${id}`);
        if (!res.ok) {
          const body = await res.json();
          throw new Error(
            body?.error?.message ??
              `Failed to load details (HTTP ${res.status}).`,
          );
        }
        setDetail(await res.json());
      } catch (err) {
        setDetailError(
          err instanceof Error
            ? err.message
            : "Failed to load market details. (ERR_DETAIL_FETCH)",
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [],
  );

  // Edge click
  const handleEdgeClick = useCallback(async (edgeId: string) => {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
    setPanelMode("edge");
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/graph/edges/${edgeId}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(
          body?.error?.message ??
            `Failed to load details (HTTP ${res.status}).`,
        );
      }
      setEdgeDetail(await res.json());
    } catch (err) {
      setDetailError(
        err instanceof Error
          ? err.message
          : "Failed to load relationship details. (ERR_EDGE_DETAIL_FETCH)",
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setDetail(null);
    setEdgeDetail(null);
    setDetailError(null);
    setPanelMode("market");
  }, []);

  const handleBackToSearch = useCallback(() => {
    setMode("empty");
    setNodes([]);
    setEdges([]);
    setFocalNodeId(null);
    setExpandedNodes(new Set());
    handleCloseDetail();
  }, [handleCloseDetail]);

  const showPanel = selectedNodeId !== null || selectedEdgeId !== null;
  const hasGraph = nodes.length > 0 && mode !== "empty";

  return (
    <div className="flex h-full" style={{ minHeight: 0 }}>
      <div className="flex-1 relative" style={{ minWidth: 0 }}>
        {/* Empty state: search-first interface */}
        {mode === "empty" && !loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
            <div
              className="w-full px-4"
              style={{ maxWidth: "560px", marginTop: "-10%" }}
            >
              <h1
                className="font-mono text-lg font-semibold text-foreground mb-1 text-center"
              >
                Constraint Explorer
              </h1>
              <p className="text-xs text-text-secondary text-center mb-6 font-sans">
                Explore structural relationships between prediction markets.
                Search for a market to see its constraint neighborhood.
              </p>

              <MarketSearch
                onSelect={handleSearchSelect}
                autoFocus
                placeholder="Search for a market to explore its constraints..."
              />

              <div className="flex items-center justify-center gap-4 mt-4">
                <button
                  onClick={loadBrowseGraph}
                  className="text-xs font-mono text-accent bg-transparent border-none cursor-pointer p-0"
                >
                  Browse all structural relationships
                </button>
              </div>

              {stats && (
                <div className="text-center mt-12 text-xs font-mono text-muted">
                  {stats.marketsCount} markets tracked &middot;{" "}
                  {stats.structuralEdges} structural relationships &middot;{" "}
                  {stats.constraintTypes} constraint types
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-5 h-5 border border-accent border-t-transparent animate-spin"
                style={{ borderRadius: "2px" }}
              />
              <span className="font-mono text-sm text-text-secondary">
                {mode === "browse"
                  ? "Loading structural network..."
                  : "Loading constraint graph..."}
              </span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="max-w-md px-4 text-center">
              <p className="font-mono text-sm text-foreground mb-2">
                Failed to load graph data.
              </p>
              <p className="font-mono text-xs text-text-secondary mb-3">
                {error}
              </p>
              <button
                onClick={handleBackToSearch}
                className="font-mono text-xs text-accent"
              >
                Back to search
              </button>
            </div>
          </div>
        )}

        {/* Top bar when graph is active */}
        {hasGraph && !loading && (
          <div
            className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-3 py-2"
            style={{ pointerEvents: "none" }}
          >
            <div
              className="flex items-center gap-2"
              style={{ pointerEvents: "auto", maxWidth: "400px", width: "100%" }}
            >
              <button
                onClick={handleBackToSearch}
                className="text-xs font-mono text-text-secondary bg-surface border border-border px-2 py-1.5 shrink-0"
                style={{ borderRadius: "2px" }}
              >
                Back
              </button>
              <div className="flex-1 min-w-0">
                <MarketSearch
                  onSelect={handleSearchSelect}
                  placeholder="Search markets..."
                />
              </div>
            </div>

            {mode === "browse" && browseHiddenCount > 0 && (
              <span
                className="text-[10px] font-mono text-muted ml-auto hidden md:inline"
                style={{ pointerEvents: "auto" }}
              >
                {browseHiddenCount} markets with only semantic relationships
                hidden
              </span>
            )}

            {mode === "ego" && focalNodeId && (
              <span
                className="text-[10px] font-mono text-muted ml-auto hidden md:inline"
                style={{ pointerEvents: "auto" }}
              >
                {nodes.length} nodes &middot; {edges.length} structural edges
              </span>
            )}
          </div>
        )}

        {/* Canvas - always rendered as background */}
        <GraphCanvas
          markets={hasGraph ? nodes : []}
          edges={hasGraph ? edges : []}
          mode={mode}
          focalNodeId={focalNodeId}
          expandedNodes={expandedNodes}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onExpandNode={handleExpandNode}
          centerOnNodeRef={centerOnNodeRef}
        />
      </div>

      {/* Detail panel */}
      {showPanel && (
        <DetailPanel
          detail={detail}
          edgeDetail={edgeDetail}
          mode={panelMode}
          loading={detailLoading}
          error={detailError}
          onClose={handleCloseDetail}
          onNodeClick={(id) => {
            handleNodeClick(id);
            centerOnNodeRef.current?.(id);
          }}
          onEdgeClick={handleEdgeClick}
          isBottomSheet={isMobile}
        />
      )}
    </div>
  );
}
