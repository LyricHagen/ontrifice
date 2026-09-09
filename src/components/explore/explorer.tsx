"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { GraphCanvas } from "./graph-canvas";
import { Sidebar } from "./sidebar";
import { DetailPanel } from "./detail-panel";
import type {
  GraphData,
  MarketDetail,
  Filters,
  MarketNode,
  GraphEdge,
} from "./types";
import { PLATFORM_COLORS, EDGE_TYPE_COLORS } from "./types";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function buildQueryParams(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.platforms.size > 0) {
    params.set("platform", Array.from(filters.platforms).join(","));
  }
  if (filters.categories.size > 0) {
    params.set("category", Array.from(filters.categories).join(","));
  }
  if (filters.edgeTypes.size === 1) {
    params.set("edge_type", Array.from(filters.edgeTypes)[0]);
  }
  if (filters.minWeight > 0) {
    params.set("min_weight", filters.minWeight.toFixed(2));
  }
  return params.toString();
}

export function Explorer() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    search: "",
    platforms: new Set(),
    categories: new Set(),
    edgeTypes: new Set(),
    minWeight: 0,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MarketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const debouncedSearch = useDebounce(filters.search, 300);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function checkMobile() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
      else setSidebarOpen(true);
    }
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const effectiveFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const qs = buildQueryParams(effectiveFilters);
    const url = `/api/graph/explorer${qs ? `?${qs}` : ""}`;

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) return res.json().then((body) => Promise.reject(body));
        return res.json();
      })
      .then((body: GraphData) => {
        setData(body);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        const msg =
          err?.error?.message ??
          "Failed to fetch graph data. The server may be unavailable. Try again shortly. (ERR_GRAPH_FETCH)";
        setError(msg);
        setLoading(false);
      });

    return () => controller.abort();
  }, [effectiveFilters]);

  const filteredEdges = useMemo(() => {
    if (!data) return [];
    let edges = data.edges;
    if (filters.edgeTypes.size > 1) {
      edges = edges.filter((e) => filters.edgeTypes.has(e.edgeType));
    }
    return edges;
  }, [data, filters.edgeTypes]);

  const categories = useMemo(() => {
    if (!data) return [];
    const cats = new Set<string>();
    for (const m of data.markets) {
      if (m.category) cats.add(m.category);
    }
    return Array.from(cats).sort();
  }, [data]);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/markets/${id}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(
          body?.error?.message ??
            `Failed to load market details (HTTP ${res.status}).`,
        );
      }
      const body: MarketDetail = await res.json();
      setDetail(body);
    } catch (err) {
      setDetailError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred loading details. (ERR_DETAIL_FETCH)",
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleNodeClick = useCallback(
    (id: string) => {
      setSelectedId(id);
      fetchDetail(id);
    },
    [fetchDetail],
  );

  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
  }, []);

  const handleNodeHover = useCallback((_id: string | null) => {}, []);

  return (
    <div className="flex h-full" style={{ minHeight: 0 }}>
      {(sidebarOpen || !isMobile) && sidebarOpen && (
        <Sidebar
          filters={filters}
          onFiltersChange={setFilters}
          categories={categories}
          marketCount={data?.markets.length ?? 0}
          edgeCount={filteredEdges.length}
          collapsed={false}
          onToggle={() => setSidebarOpen(false)}
        />
      )}

      {!sidebarOpen && isMobile && (
        <Sidebar
          filters={filters}
          onFiltersChange={setFilters}
          categories={categories}
          marketCount={data?.markets.length ?? 0}
          edgeCount={filteredEdges.length}
          collapsed={true}
          onToggle={() => setSidebarOpen(true)}
        />
      )}

      <div className="flex-1 relative" style={{ minWidth: 0 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-5 h-5 border border-accent border-t-transparent animate-spin" style={{ borderRadius: "2px" }} />
              <span className="font-mono text-sm text-text-secondary">
                Loading market graph...
              </span>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="max-w-md px-4 text-center">
              <p className="font-mono text-sm text-foreground mb-2">
                Failed to load graph data.
              </p>
              <p className="font-mono text-xs text-text-secondary mb-3">
                {error}
              </p>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  const qs = buildQueryParams(effectiveFilters);
                  fetch(`/api/graph/explorer${qs ? `?${qs}` : ""}`)
                    .then((res) => {
                      if (!res.ok)
                        return res
                          .json()
                          .then((body) => Promise.reject(body));
                      return res.json();
                    })
                    .then((body: GraphData) => {
                      setData(body);
                      setLoading(false);
                    })
                    .catch((err) => {
                      setError(
                        err?.error?.message ??
                          "Retry failed. (ERR_GRAPH_FETCH)",
                      );
                      setLoading(false);
                    });
                }}
                className="font-mono text-xs text-accent"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!loading && !error && data && data.markets.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="max-w-md px-4 text-center">
              <p className="font-mono text-sm text-foreground mb-2">
                No markets found.
              </p>
              <p className="font-mono text-xs text-text-secondary">
                The ingestion pipeline may not have run yet. Try triggering it
                from the API or check /docs. (ERR_NO_MARKETS)
              </p>
            </div>
          </div>
        )}

        {data && data.markets.length > 0 && (
          <GraphCanvas
            markets={data.markets}
            edges={filteredEdges}
            selectedId={selectedId}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            platformColors={PLATFORM_COLORS}
            edgeTypeColors={EDGE_TYPE_COLORS}
          />
        )}

        {!sidebarOpen && !isMobile && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-3 left-3 z-20 bg-surface border border-border px-2 py-1.5 text-xs font-mono text-text-secondary"
            style={{ borderRadius: "2px" }}
          >
            Filters
          </button>
        )}
      </div>

      {selectedId && (
        <DetailPanel
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={handleCloseDetail}
          onNodeClick={handleNodeClick}
          isBottomSheet={isMobile}
        />
      )}
    </div>
  );
}
