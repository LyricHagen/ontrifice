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

interface Incoherence {
  id: string;
  involvedMarketIds: string[];
  violationType: string;
  detectionClass: string;
  severity: string;
  description: string;
  impliedArbitrage: Record<string, unknown> | null;
  detectedAt: string;
  resolvedAt: string | null;
  status: string;
  involvedMarkets: Market[];
}

interface ApiResponse {
  incoherences: Incoherence[];
  total: number;
  page: number;
  limit: number;
}

interface ApiError {
  error: { code: string; message: string };
}

const VIOLATION_LABELS: Record<string, string> = {
  probability_sum: "PROBABILITY SUM",
  probability_divergence: "PROBABILITY DIVERGENCE",
  mutual_exclusion: "MUTUAL EXCLUSION",
  implication_violation: "IMPLICATION VIOLATION",
};

const CLASS_LABELS: Record<string, { label: string; explanation: string }> = {
  contradiction: {
    label: "CONTRADICTION",
    explanation: "These prices are logically impossible given the relationship between these markets.",
  },
  divergence: {
    label: "DIVERGENCE",
    explanation: "These prices are statistically unusual but not necessarily wrong.",
  },
};

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

function formatProbability(prob: string | null): string {
  if (prob === null) return "--";
  return `${(parseFloat(prob) * 100).toFixed(1)}%`;
}

type ClassTab = "all" | "contradiction" | "divergence";

export function IncoherencesFeed() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [classTab, setClassTab] = useState<ClassTab>("all");
  const [violationType, setViolationType] = useState("all");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("severity");
  const [expandedArbitrage, setExpandedArbitrage] = useState<Set<string>>(
    new Set(),
  );

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
    if (violationType !== "all") params.set("violation_type", violationType);
    if (classTab !== "all") params.set("detection_class", classTab);

    try {
      const res = await fetch(`/api/graph/incoherences?${params}`);
      if (!res.ok) {
        const body = (await res.json()) as ApiError;
        setError(body.error.message);
        setErrorCode(body.error.code);
        return;
      }
      setData(await res.json());
    } catch {
      setError(
        "Failed to fetch incoherences. The server may be temporarily unavailable. Try refreshing the page.",
      );
      setErrorCode("ERR_NETWORK");
    } finally {
      setLoading(false);
    }
  }, [page, violationType, classTab, status, sort]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleArbitrage(id: string) {
    setExpandedArbitrage((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function switchTab(tab: ClassTab) {
    setClassTab(tab);
    setPage(1);
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const tabs: { key: ClassTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "contradiction", label: "Contradictions" },
    { key: "divergence", label: "Divergences" },
  ];

  return (
    <div>
      <div className="flex gap-0 mb-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={`px-4 py-2 text-sm font-mono bg-transparent border-none cursor-pointer ${
              classTab === tab.key
                ? "text-foreground border-b-2 border-b-accent -mb-px"
                : "text-text-secondary"
            }`}
            style={{ borderRadius: 0 }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 mb-8 border-b border-border pb-4">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Violation type
          <select
            value={violationType}
            onChange={(e) => {
              setViolationType(e.target.value);
              setPage(1);
            }}
            className="bg-surface border border-border text-foreground text-sm px-2 py-1 font-mono"
            style={{ borderRadius: "2px" }}
          >
            <option value="all">All</option>
            <option value="probability_sum">Probability sum</option>
            <option value="probability_divergence">Probability divergence</option>
            <option value="mutual_exclusion">Mutual exclusion</option>
            <option value="implication_violation">Implication violation</option>
          </select>
        </label>

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
            <option value="severity">Severity</option>
            <option value="detected_at">Detected</option>
            <option value="market_count">Market count</option>
          </select>
        </label>
      </div>

      {loading && (
        <div className="flex flex-col gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="py-4 border-b border-border">
              <Skeleton rows={4} widths={["30%", "100%", "80%", "60%"]} />
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

      {!loading && !error && data && data.incoherences.length === 0 && (
        <div className="border border-border p-6 bg-surface">
          <p className="text-sm text-text-secondary">
            No incoherences detected yet.
          </p>
        </div>
      )}

      {!loading && !error && data && data.incoherences.length > 0 && (
        <div>
          {data.incoherences.map((inc) => {
            const classInfo = CLASS_LABELS[inc.detectionClass];
            const isContradiction = inc.detectionClass === "contradiction";
            const arbType = inc.impliedArbitrage?.type as string | undefined;

            return (
              <div key={inc.id} className="py-4 border-b border-border">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="font-mono text-sm text-foreground whitespace-nowrap shrink-0">
                      {parseFloat(inc.severity).toFixed(2)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        {classInfo && (
                          <span className="font-mono text-xs font-bold text-foreground">
                            [{classInfo.label}]
                          </span>
                        )}
                        <span className="font-mono text-xs text-text-secondary">
                          [{VIOLATION_LABELS[inc.violationType] ?? inc.violationType}]
                        </span>
                      </div>
                      {classInfo && (
                        <p className="text-xs text-text-secondary mt-0.5 italic">
                          {classInfo.explanation}
                        </p>
                      )}
                      <p className="text-sm text-foreground mt-1">
                        {inc.description}
                      </p>

                      <div className="mt-3">
                        {inc.involvedMarkets.map((market) => (
                          <div
                            key={market.id}
                            className="text-sm py-0.5 flex items-baseline gap-2"
                          >
                            <Link
                              href={`/explore?focus=${market.id}`}
                              className="text-accent no-underline hover:underline truncate"
                            >
                              {market.title}
                            </Link>
                            <span className="text-xs text-text-secondary font-mono whitespace-nowrap">
                              [{market.platform}]
                            </span>
                            <span className="text-xs font-mono text-foreground whitespace-nowrap">
                              {formatProbability(market.currentProbability)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {inc.impliedArbitrage && (
                        <div className="mt-3">
                          <button
                            onClick={() => toggleArbitrage(inc.id)}
                            className="text-xs text-text-secondary font-mono cursor-pointer bg-transparent border-none p-0 hover:text-foreground"
                            aria-expanded={expandedArbitrage.has(inc.id)}
                            aria-label={isContradiction ? "Toggle implied arbitrage details" : "Toggle suggested position details"}
                          >
                            {expandedArbitrage.has(inc.id)
                              ? `[-] ${isContradiction ? "implied arbitrage" : "suggested position"}`
                              : `[+] ${isContradiction ? "implied arbitrage" : "suggested position"}`}
                          </button>

                          {expandedArbitrage.has(inc.id) && (
                            <ArbitrageTable
                              data={inc.impliedArbitrage}
                              violationType={inc.violationType}
                              detectionClass={inc.detectionClass}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-text-secondary whitespace-nowrap shrink-0">
                    Detected {formatRelativeTime(inc.detectedAt)}
                  </span>
                </div>
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 text-sm">
              {page > 1 ? (
                <button
                  onClick={() => setPage(page - 1)}
                  className="text-accent bg-transparent border-none cursor-pointer p-0 hover:underline"
                  aria-label="Previous page"
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
                  aria-label="Next page"
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

function ArbitrageTable({
  data,
  violationType,
  detectionClass,
}: {
  data: Record<string, unknown>;
  violationType: string;
  detectionClass: string;
}) {
  const isDivergence = detectionClass === "divergence";
  const warning = data.warning as string | undefined;

  if (violationType === "probability_sum" && data.markets) {
    const markets = data.markets as Array<{
      id: string;
      title: string;
      probability: number;
    }>;
    const direction = data.direction as string;

    return (
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border text-text-secondary text-left">
              <th className="py-1 pr-4 font-normal">Market</th>
              <th className="py-1 pr-4 font-normal">Position</th>
              <th className="py-1 pr-4 font-normal">Current</th>
              <th className="py-1 font-normal">Edge</th>
            </tr>
          </thead>
          <tbody>
            {markets.map((m) => (
              <tr key={m.id} className="border-b border-border">
                <td className="py-1 pr-4 max-w-[300px] truncate">
                  {m.title}
                </td>
                <td className="py-1 pr-4">
                  {direction === "overpriced" ? "BUY NO" : "BUY YES"}
                </td>
                <td className="py-1 pr-4">
                  {(m.probability * 100).toFixed(1)}%
                </td>
                <td className="py-1">
                  {direction === "overpriced"
                    ? `+${((1 - m.probability) * 100).toFixed(1)}%`
                    : `+${(m.probability * 100).toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-text-secondary mt-1">
          Sum deviation: {((data.deviation as number) * 100).toFixed(1)}pp
          ({direction})
        </p>
      </div>
    );
  }

  if (violationType === "probability_divergence") {
    return (
      <div className="mt-2 text-xs font-mono text-text-secondary">
        {warning && (
          <p className="mb-2 italic">{warning}</p>
        )}
        <p>Edge score: {(data.edgeScore as number).toFixed(3)}</p>
        <p>
          Divergence: {((data.divergence as number) * 100).toFixed(1)}pp (max
          expected: {((data.expectedMaxDivergence as number) * 100).toFixed(1)}
          pp)
        </p>
      </div>
    );
  }

  if (isDivergence && warning) {
    return (
      <div className="mt-2 text-xs font-mono text-text-secondary">
        <p className="mb-2 italic">{warning}</p>
        <pre className="whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="mt-2 text-xs font-mono text-text-secondary">
      <pre className="whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
