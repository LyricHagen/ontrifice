"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/skeleton";

interface MarketOption {
  id: string;
  title: string;
  platform: string;
  currentProbability: string | null;
}

interface ConditionalResult {
  probability: number;
  confidence: number;
  derivationPath: Array<{ id: string; title: string }>;
  conditionMarket: { id: string; title: string; probability: number };
  targetMarket: { id: string; title: string; probability: number };
}

interface RecentConditional {
  id: string;
  conditionMarketId: string;
  targetMarketId: string;
  conditionalProbability: string;
  confidence: string;
  computedAt: string;
  conditionMarket: MarketOption;
  targetMarket: MarketOption;
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

export function ConditionalsInterface() {
  return (
    <div>
      <QuerySection />
      <div className="mt-10 border-t border-border pt-8">
        <h2 className="text-lg font-semibold font-mono mb-1">
          Recent computations
        </h2>
        <p className="text-sm text-text-secondary mb-6">
          Previously computed conditional probabilities.
        </p>
        <BrowseSection />
      </div>
    </div>
  );
}

function MarketSearchInput({
  label,
  selected,
  onSelect,
  onClear,
}: {
  label: string;
  selected: MarketOption | null;
  onSelect: (market: MarketOption) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketOption[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleInput(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          search: value,
          status: "active",
          limit: "10",
        });
        const res = await fetch(`/api/markets?${params}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.markets ?? []);
          setOpen(true);
        }
      } finally {
        setSearching(false);
      }
    }, 250);
  }

  if (selected) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-text-secondary">{label}</span>
        <div className="flex items-center gap-2 bg-surface border border-border px-2 py-1 text-sm" style={{ borderRadius: "2px" }}>
          <span className="truncate flex-1">{selected.title}</span>
          <button
            onClick={onClear}
            className="text-text-secondary text-xs bg-transparent border-none cursor-pointer p-0 hover:text-foreground shrink-0"
            aria-label={`Clear ${label}`}
          >
            [x]
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 relative" ref={containerRef}>
      <span className="text-xs text-text-secondary">{label}</span>
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search markets..."
        className="bg-surface border border-border text-foreground text-sm px-2 py-1 font-mono w-full"
        style={{ borderRadius: "2px" }}
      />
      {searching && (
        <span className="text-xs text-text-secondary absolute right-2 top-6">
          ...
        </span>
      )}
      {open && results.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 bg-surface border border-border z-10 max-h-48 overflow-y-auto"
          style={{ borderRadius: "2px" }}
        >
          {results.map((market) => (
            <button
              key={market.id}
              onClick={() => {
                onSelect(market);
                setQuery("");
                setResults([]);
                setOpen(false);
              }}
              className="w-full text-left px-2 py-1.5 text-sm text-foreground bg-transparent border-none cursor-pointer border-b border-border hover:bg-surface-raised block"
            >
              <span className="truncate block">{market.title}</span>
              <span className="text-xs text-text-secondary font-mono">
                [{market.platform}]{" "}
                {market.currentProbability
                  ? `${(parseFloat(market.currentProbability) * 100).toFixed(1)}%`
                  : "--"}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && query.length >= 2 && !searching && (
        <div
          className="absolute top-full left-0 right-0 bg-surface border border-border z-10 px-2 py-2 text-xs text-text-secondary"
          style={{ borderRadius: "2px" }}
        >
          No markets found.
        </div>
      )}
    </div>
  );
}

function QuerySection() {
  const [target, setTarget] = useState<MarketOption | null>(null);
  const [condition, setCondition] = useState<MarketOption | null>(null);
  const [computing, setComputing] = useState(false);
  const [result, setResult] = useState<ConditionalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function handleCompute() {
    if (!target || !condition) return;

    setComputing(true);
    setResult(null);
    setError(null);
    setErrorCode(null);

    try {
      const params = new URLSearchParams({
        condition: condition.id,
        target: target.id,
      });
      const res = await fetch(`/api/graph/conditionals?${params}`);

      if (!res.ok) {
        const body = (await res.json()) as ApiError;
        const code = body.error.code;

        if (code === "ERR_NO_PATH") {
          setError(
            "No dependency path exists between these two markets. They appear to be independent based on current data. Try markets that share a category or have temporal co-movement.",
          );
          setErrorCode("ERR_CONDITIONAL_NO_PATH");
        } else if (code === "ERR_INSUFFICIENT_DATA") {
          setError(
            "Not enough snapshot data to compute this conditional reliably. Markets need at least 14 days of price history.",
          );
          setErrorCode("ERR_CONDITIONAL_INSUFFICIENT_DATA");
        } else {
          setError(body.error.message);
          setErrorCode(code);
        }
        return;
      }

      const data = await res.json();
      setResult(data.conditional);
    } catch {
      setError(
        "Failed to compute conditional. The server may be temporarily unavailable. Try again.",
      );
      setErrorCode("ERR_NETWORK");
    } finally {
      setComputing(false);
    }
  }

  return (
    <div>
      <div className="flex items-end gap-2 flex-wrap">
        <span className="text-sm font-mono text-text-secondary pb-1">P(</span>
        <div className="w-64">
          <MarketSearchInput
            label="Target"
            selected={target}
            onSelect={setTarget}
            onClear={() => {
              setTarget(null);
              setResult(null);
            }}
          />
        </div>
        <span className="text-sm font-mono text-text-secondary pb-1">|</span>
        <div className="w-64">
          <MarketSearchInput
            label="Condition"
            selected={condition}
            onSelect={setCondition}
            onClear={() => {
              setCondition(null);
              setResult(null);
            }}
          />
        </div>
        <span className="text-sm font-mono text-text-secondary pb-1">)</span>
        <button
          onClick={handleCompute}
          disabled={!target || !condition || computing}
          className="border border-border text-foreground text-sm px-4 py-1 font-mono bg-transparent cursor-pointer disabled:opacity-40 disabled:cursor-default hover:bg-surface"
          style={{ borderRadius: "2px" }}
        >
          {computing ? "Computing..." : "Compute"}
        </button>
      </div>

      {computing && (
        <div className="mt-6">
          <Skeleton rows={3} widths={["40%", "80%", "60%"]} />
        </div>
      )}

      {error && (
        <div className="mt-6 border border-border p-4 bg-surface">
          <p className="text-sm text-foreground">{error}</p>
          {errorCode && (
            <p className="text-xs font-mono text-text-secondary mt-1">
              {errorCode}
            </p>
          )}
        </div>
      )}

      {result && !computing && (
        <div className="mt-6 border border-border p-4 bg-surface">
          <p className="font-mono text-2xl text-foreground">
            P({result.targetMarket.title} | {result.conditionMarket.title}) ={" "}
            {(result.probability * 100).toFixed(1)}%
          </p>
          <p className="text-sm text-text-secondary mt-2 font-mono">
            Confidence: {(result.confidence * 100).toFixed(1)}%
          </p>
          <div className="mt-4">
            <p className="text-xs text-text-secondary mb-1">
              Derivation path
            </p>
            <div className="flex items-center gap-1 flex-wrap font-mono text-sm">
              {result.derivationPath.map((node, i) => (
                <span key={node.id} className="flex items-center gap-1">
                  <Link
                    href={`/explore?focus=${node.id}`}
                    className="text-accent no-underline hover:underline"
                  >
                    {node.title}
                  </Link>
                  {i < result.derivationPath.length - 1 && (
                    <span className="text-text-secondary">-&gt;</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BrowseSection() {
  const [data, setData] = useState<{
    conditionals: RecentConditional[];
    total: number;
    page: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);

    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });

    try {
      const res = await fetch(`/api/graph/conditionals?${params}`);
      if (!res.ok) {
        const body = (await res.json()) as ApiError;
        setError(body.error.message);
        setErrorCode(body.error.code);
        return;
      }
      setData(await res.json());
    } catch {
      setError(
        "Failed to fetch recent conditionals. The server may be temporarily unavailable.",
      );
      setErrorCode("ERR_NETWORK");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="py-3 border-b border-border">
            <Skeleton rows={2} widths={["60%", "30%"]} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-border p-4 bg-surface">
        <p className="text-sm text-foreground">{error}</p>
        {errorCode && (
          <p className="text-xs font-mono text-text-secondary mt-1">
            {errorCode}
          </p>
        )}
      </div>
    );
  }

  if (!data || data.conditionals.length === 0) {
    return (
      <div className="border border-border p-4 bg-surface">
        <p className="text-sm text-text-secondary">
          No conditionals computed yet. Use the query interface above to compute
          your first conditional probability.
        </p>
      </div>
    );
  }

  return (
    <div>
      {data.conditionals.map((c) => (
        <div key={c.id} className="py-3 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono text-foreground">
                P(
                <Link
                  href={`/explore?focus=${c.targetMarketId}`}
                  className="text-accent no-underline hover:underline"
                >
                  {c.targetMarket.title}
                </Link>{" "}
                |{" "}
                <Link
                  href={`/explore?focus=${c.conditionMarketId}`}
                  className="text-accent no-underline hover:underline"
                >
                  {c.conditionMarket.title}
                </Link>
                ) ={" "}
                <span className="text-foreground">
                  {(parseFloat(c.conditionalProbability) * 100).toFixed(1)}%
                </span>
              </p>
              <p className="text-xs text-text-secondary font-mono mt-1">
                Confidence: {(parseFloat(c.confidence) * 100).toFixed(1)}%
              </p>
            </div>
            <span className="text-xs text-text-secondary whitespace-nowrap shrink-0">
              {formatRelativeTime(c.computedAt)}
            </span>
          </div>
        </div>
      ))}

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
  );
}
