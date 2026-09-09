"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/skeleton";

interface Market {
  id: string;
  title: string;
  platform: string;
  currentProbability: string | null;
}

interface ExpectedMarket extends Market {
  expectedDelta: number | null;
}

interface CascadeAlert {
  id: string;
  triggerMarketId: string;
  expectedMarketIds: string[];
  triggerDelta: string;
  expectedDeltas: Record<string, number>;
  lagWindowSeconds: number;
  detectedAt: string;
  resolvedAt: string | null;
  status: string;
  triggerMarket: Market | null;
  expectedMarkets: ExpectedMarket[];
}

interface ApiResponse {
  cascades: CascadeAlert[];
  total: number;
  page: number;
  limit: number;
}

interface ApiError {
  error: { code: string; message: string };
}

const PAGE_SIZE = 20;

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDelta(delta: string | number): string {
  const num = typeof delta === "string" ? parseFloat(delta) : delta;
  const pct = (num * 100).toFixed(1);
  return num >= 0 ? `+${pct}%` : `${pct}%`;
}

function formatTimeRemaining(detectedAt: string, lagWindowSeconds: number): string {
  const end = new Date(detectedAt).getTime() + lagWindowSeconds * 1000;
  const remaining = end - Date.now();

  if (remaining <= 0) return "expired";

  const minutes = Math.floor(remaining / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `~${hours}h ${minutes % 60}m remaining`;
  return `~${minutes}m remaining`;
}

export function CascadesFeed() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("detected_at");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);

    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      sort,
      order: "desc",
    });
    if (status !== "all") params.set("status", status);

    try {
      const res = await fetch(`/api/graph/cascades?${params}`);
      if (!res.ok) {
        const body = (await res.json()) as ApiError;
        setError(body.error.message);
        setErrorCode(body.error.code);
        return;
      }
      setData(await res.json());
    } catch {
      setError(
        "Failed to fetch cascade alerts. The server may be temporarily unavailable. Try refreshing the page.",
      );
      setErrorCode("ERR_NETWORK");
    } finally {
      setLoading(false);
    }
  }, [page, status, sort]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-8 border-b border-border pb-4">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="bg-surface border border-border text-foreground text-sm px-2 py-1 font-mono"
            style={{ borderRadius: "2px" }}
          >
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="expired">Expired</option>
            <option value="all">All</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Sort
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="bg-surface border border-border text-foreground text-sm px-2 py-1 font-mono"
            style={{ borderRadius: "2px" }}
          >
            <option value="detected_at">Detected</option>
            <option value="trigger_delta">Trigger delta</option>
          </select>
        </label>
      </div>

      {loading && (
        <div className="flex flex-col gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="py-4 border-b border-border">
              <Skeleton rows={5} widths={["40%", "70%", "50%", "60%", "30%"]} />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="border border-border p-4 bg-surface">
          <p className="text-sm text-foreground">{error}</p>
          {errorCode && (
            <p className="text-xs font-mono text-text-secondary mt-1">
              {errorCode}
            </p>
          )}
        </div>
      )}

      {!loading && !error && data && data.cascades.length === 0 && (
        <div className="border border-border p-6 bg-surface">
          <p className="text-sm text-foreground">
            No active cascade alerts. This means either no significant market
            movements occurred recently, or all connected markets reacted within
            expected timeframes.
          </p>
        </div>
      )}

      {!loading && !error && data && data.cascades.length > 0 && (
        <div>
          {data.cascades.map((alert) => (
            <div key={alert.id} className="py-4 border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs text-text-secondary font-mono">
                      TRIGGER
                    </span>
                    <span className="text-xs font-mono text-text-secondary">
                      [{alert.status.toUpperCase()}]
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    {alert.triggerMarket ? (
                      <Link
                        href={`/explore?focus=${alert.triggerMarket.id}`}
                        className="text-sm text-accent no-underline hover:underline"
                      >
                        {alert.triggerMarket.title}
                      </Link>
                    ) : (
                      <span className="text-sm text-foreground">
                        Unknown market
                      </span>
                    )}
                    {alert.triggerMarket && (
                      <span className="text-xs text-text-secondary font-mono">
                        [{alert.triggerMarket.platform}]
                      </span>
                    )}
                    <span className="font-mono text-sm text-foreground">
                      {formatDelta(alert.triggerDelta)}
                    </span>
                  </div>

                  <p className="text-xs text-text-secondary mt-0.5">
                    Moved {formatRelativeTime(alert.detectedAt)}
                  </p>

                  <div className="mt-3">
                    <span className="text-xs text-text-secondary font-mono">
                      EXPECTED REACTIONS
                    </span>
                    <div className="mt-1">
                      {alert.expectedMarkets.map((market) => {
                        const isResolved = alert.status === "resolved";
                        return (
                          <div
                            key={market.id}
                            className="flex items-baseline gap-2 py-0.5 text-sm"
                          >
                            <Link
                              href={`/explore?focus=${market.id}`}
                              className="text-accent no-underline hover:underline truncate"
                            >
                              {market.title}
                            </Link>
                            {market.expectedDelta !== null && (
                              <span className="font-mono text-xs text-text-secondary whitespace-nowrap">
                                expected: {formatDelta(market.expectedDelta)}
                              </span>
                            )}
                            {alert.status === "active" && (
                              <span className="text-xs text-text-secondary whitespace-nowrap">
                                {formatTimeRemaining(
                                  alert.detectedAt,
                                  alert.lagWindowSeconds,
                                )}
                              </span>
                            )}
                            {isResolved && (
                              <span className="text-xs font-mono text-text-secondary">
                                [resolved]
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 text-sm">
              {page > 1 ? (
                <button
                  onClick={() => setPage(page - 1)}
                  className="text-accent bg-transparent border-none cursor-pointer p-0 hover:underline"
                >
                  Previous
                </button>
              ) : (
                <span className="text-text-secondary">Previous</span>
              )}
              <span className="text-text-secondary font-mono text-xs">
                {page} / {totalPages}
              </span>
              {page < totalPages ? (
                <button
                  onClick={() => setPage(page + 1)}
                  className="text-accent bg-transparent border-none cursor-pointer p-0 hover:underline"
                >
                  Next
                </button>
              ) : (
                <span className="text-text-secondary">Next</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
