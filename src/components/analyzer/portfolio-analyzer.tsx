"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface MarketOption {
  id: string;
  title: string;
  platform: string;
  currentProbability: string | null;
}

interface PositionEntry {
  id: string;
  marketId: string;
  marketTitle: string;
  platform: string;
  side: "YES" | "NO";
  size: number;
  avgPrice: number;
}

interface BindingConstraint {
  market_id_a: string;
  market_id_b: string;
  market_title_a: string;
  market_title_b: string;
  relationship_type: string;
  collateral_saved: number;
  edge_id: string;
  confidence: number;
}

interface PositionPnl {
  market_id: string;
  market_title: string;
  side: string;
  size: number;
  avg_price: number;
  resolution: string;
  pnl: number;
}

interface AnalysisResult {
  naive_collateral: number;
  optimized_collateral: number;
  savings: number;
  savings_pct: number;
  constraint_count: number;
  binding_constraints: BindingConstraint[];
  worst_case: {
    resolutions: Record<string, boolean>;
    position_pnls: PositionPnl[];
    total_loss: number;
  };
  warnings: string[];
}

interface Suggestion {
  market_id: string;
  market_title: string;
  relationship_count: number;
  potential_savings: string;
}

const SAMPLE_PORTFOLIO: Omit<PositionEntry, "id">[] = [
  { marketId: "", marketTitle: "Sample position 1", platform: "polymarket", side: "YES", size: 100, avgPrice: 0.65 },
  { marketId: "", marketTitle: "Sample position 2", platform: "polymarket", side: "NO", size: 200, avgPrice: 0.40 },
  { marketId: "", marketTitle: "Sample position 3", platform: "kalshi", side: "YES", size: 150, avgPrice: 0.55 },
];

let nextId = 1;
function genId(): string {
  return `pos-${nextId++}`;
}

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function MarketSearch({
  onSelect,
}: {
  onSelect: (market: MarketOption) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const search = useCallback((q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    fetch(`/api/markets?search=${encodeURIComponent(q)}&limit=10&sort=volume&order=desc`)
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
        type="text"
        value={query}
        placeholder="Search markets..."
        className="w-full bg-surface border border-border px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted"
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
      {open && (query.length >= 2) && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 border border-border bg-surface max-h-60 overflow-y-auto"
          style={{ borderRadius: "2px" }}
        >
          {loading && (
            <div className="px-3 py-2 text-xs text-text-secondary font-mono">Searching...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-text-secondary font-mono">No markets found.</div>
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

export function PortfolioAnalyzer() {
  const [positions, setPositions] = useState<PositionEntry[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sampleLoaded, setSampleLoaded] = useState(false);

  const addPosition = useCallback((market: MarketOption) => {
    setPositions((prev) => [
      ...prev,
      {
        id: genId(),
        marketId: market.id,
        marketTitle: market.title,
        platform: market.platform,
        side: "YES",
        size: 100,
        avgPrice: market.currentProbability
          ? parseFloat(market.currentProbability)
          : 0.5,
      },
    ]);
    setResult(null);
  }, []);

  const removePosition = useCallback((id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
    setResult(null);
  }, []);

  const updatePosition = useCallback(
    (id: string, field: keyof PositionEntry, value: unknown) => {
      setPositions((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
      );
      setResult(null);
    },
    [],
  );

  const loadSample = useCallback(async () => {
    try {
      const res = await fetch("/api/markets?limit=10&sort=volume&order=desc");
      const data = await res.json();
      const markets = (data.markets ?? []) as MarketOption[];

      if (markets.length >= 3) {
        const entries: PositionEntry[] = markets.slice(0, Math.min(8, markets.length)).map((m, i) => ({
          id: genId(),
          marketId: m.id,
          marketTitle: m.title ?? "Market",
          platform: m.platform ?? "unknown",
          side: (i % 3 === 1 ? "NO" : "YES") as "YES" | "NO",
          size: [100, 200, 150, 100, 250, 100, 175, 200][i] ?? 100,
          avgPrice: m.currentProbability
            ? parseFloat(m.currentProbability as string)
            : SAMPLE_PORTFOLIO[i % SAMPLE_PORTFOLIO.length].avgPrice,
        }));
        setPositions(entries);
        setSampleLoaded(true);
        setResult(null);
      } else {
        setError(
          "Not enough markets in the database to build a sample portfolio. Run ingestion first. (ERR_INSUFFICIENT_MARKETS)",
        );
      }
    } catch {
      setError("Failed to load sample portfolio. (ERR_SAMPLE_LOAD)");
    }
  }, []);

  const analyze = useCallback(async () => {
    if (positions.length === 0) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setSuggestions([]);

    try {
      const res = await fetch("/api/portfolio/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positions: positions.map((p) => ({
            market_id: p.marketId,
            side: p.side,
            size: p.size,
            avg_price: p.avgPrice,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(
          body?.error?.message ?? `Analysis failed (HTTP ${res.status}).`,
        );
      }

      const data: AnalysisResult = await res.json();
      setResult(data);

      fetch("/api/portfolio/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positions: positions.map((p) => ({
            market_id: p.marketId,
            side: p.side,
            size: p.size,
            avg_price: p.avgPrice,
          })),
        }),
      })
        .then((r) => r.json())
        .then((d) => setSuggestions(d.suggestions ?? []))
        .catch(() => {});
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during analysis. (ERR_ANALYSIS)",
      );
    } finally {
      setAnalyzing(false);
    }
  }, [positions]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-mono text-2xl font-bold mb-1">Portfolio Analyzer</h1>
        <p className="text-sm text-text-secondary">
          Input positions across prediction markets. The solver computes your
          true max loss given proven structural constraints between markets.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left panel: portfolio builder */}
        <div className="lg:w-[400px] flex-shrink-0">
          <div className="border border-border p-4" style={{ borderRadius: "2px" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono text-sm font-semibold uppercase tracking-wider">
                Positions
              </h2>
              <button
                onClick={loadSample}
                className="text-xs font-mono text-accent bg-transparent border-none cursor-pointer p-0"
                disabled={sampleLoaded}
              >
                {sampleLoaded ? "Sample loaded" : "Try sample portfolio"}
              </button>
            </div>

            <MarketSearch onSelect={addPosition} />

            {positions.length === 0 && (
              <div className="text-xs text-text-secondary mt-4 text-center py-8">
                Search for markets above to add positions, or load a sample portfolio.
              </div>
            )}

            <div className="mt-3 flex flex-col gap-2 max-h-[480px] overflow-y-auto">
              {positions.map((pos) => (
                <div
                  key={pos.id}
                  className="border border-border p-3"
                  style={{ borderRadius: "2px" }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="text-xs font-mono truncate flex-1" title={pos.marketTitle}>
                      {pos.marketTitle}
                    </div>
                    <button
                      onClick={() => removePosition(pos.id)}
                      className="text-text-secondary text-xs font-mono bg-transparent border-none cursor-pointer p-0 flex-shrink-0"
                      aria-label={`Remove ${pos.marketTitle}`}
                    >
                      remove
                    </button>
                  </div>
                  <div className="text-[10px] text-muted font-mono mb-2">{pos.platform}</div>
                  <div className="flex gap-2 items-center">
                    <select
                      value={pos.side}
                      onChange={(e) =>
                        updatePosition(pos.id, "side", e.target.value)
                      }
                      className="bg-surface border border-border px-2 py-1 text-xs font-mono text-foreground"
                      style={{ borderRadius: "2px" }}
                    >
                      <option value="YES">YES</option>
                      <option value="NO">NO</option>
                    </select>
                    <input
                      type="number"
                      value={pos.size}
                      min={1}
                      step={1}
                      onChange={(e) =>
                        updatePosition(
                          pos.id,
                          "size",
                          Math.max(1, Number(e.target.value) || 1),
                        )
                      }
                      className="w-20 bg-surface border border-border px-2 py-1 text-xs font-mono text-foreground"
                      style={{ borderRadius: "2px" }}
                      title="Number of shares"
                    />
                    <span className="text-[10px] text-text-secondary">@</span>
                    <input
                      type="number"
                      value={pos.avgPrice}
                      min={0.01}
                      max={0.99}
                      step={0.01}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v > 0 && v < 1) {
                          updatePosition(pos.id, "avgPrice", v);
                        }
                      }}
                      className="w-16 bg-surface border border-border px-2 py-1 text-xs font-mono text-foreground"
                      style={{ borderRadius: "2px" }}
                      title="Average entry price"
                    />
                  </div>
                </div>
              ))}
            </div>

            {positions.length > 0 && (
              <button
                onClick={analyze}
                disabled={analyzing || positions.length === 0}
                className="w-full mt-4 py-2.5 font-mono text-sm border border-accent text-accent bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderRadius: "2px" }}
              >
                {analyzing ? "Analyzing..." : "Analyze portfolio"}
              </button>
            )}
          </div>
        </div>

        {/* Right panel: results */}
        <div className="flex-1 min-w-0">
          {error && (
            <div
              className="border border-error-border bg-error-bg p-4 mb-4 text-sm"
              style={{ borderRadius: "2px" }}
            >
              <p className="font-mono font-semibold text-error mb-1">
                Analysis failed
              </p>
              <p className="text-text-secondary">{error}</p>
            </div>
          )}

          {!result && !error && !analyzing && (
            <div className="border border-border p-8 text-center" style={{ borderRadius: "2px" }}>
              <p className="font-mono text-sm text-text-secondary">
                Add positions and click Analyze to compute collateral requirements.
              </p>
            </div>
          )}

          {analyzing && (
            <div className="border border-border p-8 text-center" style={{ borderRadius: "2px" }}>
              <div className="flex items-center justify-center gap-3">
                <div
                  className="w-4 h-4 border border-accent border-t-transparent animate-spin"
                  style={{ borderRadius: "2px" }}
                />
                <span className="font-mono text-sm text-text-secondary">
                  Computing collateral bounds...
                </span>
              </div>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-4">
              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div
                  className="border border-border bg-surface p-3"
                  style={{ borderRadius: "2px" }}
                >
                  {result.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-text-secondary font-mono">
                      {w}
                    </p>
                  ))}
                </div>
              )}

              {/* Top numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border border border-border" style={{ borderRadius: "2px" }}>
                <div className="bg-background p-4 text-center">
                  <div className="text-xs text-text-secondary uppercase tracking-wider mb-1 font-mono">
                    Naive Collateral
                  </div>
                  <div className="font-mono text-xl font-bold">
                    {formatUsd(result.naive_collateral)}
                  </div>
                </div>
                <div className="bg-background p-4 text-center">
                  <div className="text-xs text-text-secondary uppercase tracking-wider mb-1 font-mono">
                    True Max Loss
                  </div>
                  <div className="font-mono text-xl font-bold">
                    {formatUsd(result.optimized_collateral)}
                  </div>
                </div>
                <div className="bg-background p-4 text-center">
                  <div className="text-xs text-text-secondary uppercase tracking-wider mb-1 font-mono">
                    Capital Freed
                  </div>
                  <div className="font-mono text-xl font-bold text-accent">
                    {formatUsd(result.savings)}
                  </div>
                  <div className="text-xs text-text-secondary font-mono mt-0.5">
                    {result.savings_pct.toFixed(1)}% reduction
                  </div>
                </div>
              </div>

              {/* Binding constraints */}
              {result.binding_constraints.length > 0 && (
                <div className="border border-border" style={{ borderRadius: "2px" }}>
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="font-mono text-sm font-semibold uppercase tracking-wider">
                      Binding Constraints
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Proven relationships actively reducing your collateral requirement.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-border text-text-secondary">
                          <th className="text-left px-4 py-2 font-normal">Market A</th>
                          <th className="text-left px-4 py-2 font-normal">Market B</th>
                          <th className="text-left px-4 py-2 font-normal">Type</th>
                          <th className="text-right px-4 py-2 font-normal">Saved</th>
                          <th className="text-right px-4 py-2 font-normal">Conf.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.binding_constraints.map((bc, i) => (
                          <tr key={i} className="border-b border-border last:border-b-0">
                            <td className="px-4 py-2 max-w-[180px] truncate" title={bc.market_title_a}>
                              {bc.market_title_a}
                            </td>
                            <td className="px-4 py-2 max-w-[180px] truncate" title={bc.market_title_b}>
                              {bc.market_title_b}
                            </td>
                            <td className="px-4 py-2 text-text-secondary">
                              {bc.relationship_type.replace(/_/g, " ")}
                            </td>
                            <td className="px-4 py-2 text-right text-accent">
                              {formatUsd(bc.collateral_saved)}
                            </td>
                            <td className="px-4 py-2 text-right text-text-secondary">
                              {(bc.confidence * 100).toFixed(0)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Worst case scenario */}
              <div className="border border-border" style={{ borderRadius: "2px" }}>
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="font-mono text-sm font-semibold uppercase tracking-wider">
                    Worst-Case Scenario
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    The resolution combination that produces your maximum loss.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border text-text-secondary">
                        <th className="text-left px-4 py-2 font-normal">Market</th>
                        <th className="text-left px-4 py-2 font-normal">Side</th>
                        <th className="text-right px-4 py-2 font-normal">Size</th>
                        <th className="text-right px-4 py-2 font-normal">Price</th>
                        <th className="text-center px-4 py-2 font-normal">Resolves</th>
                        <th className="text-right px-4 py-2 font-normal">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.worst_case.position_pnls.map((p, i) => (
                        <tr key={i} className="border-b border-border last:border-b-0">
                          <td className="px-4 py-2 max-w-[200px] truncate" title={p.market_title}>
                            {p.market_title}
                          </td>
                          <td className="px-4 py-2">{p.side}</td>
                          <td className="px-4 py-2 text-right">{p.size}</td>
                          <td className="px-4 py-2 text-right">
                            {(p.avg_price * 100).toFixed(1)}c
                          </td>
                          <td className="px-4 py-2 text-center">{p.resolution}</td>
                          <td
                            className={`px-4 py-2 text-right ${
                              p.pnl >= 0 ? "text-accent" : "text-error"
                            }`}
                          >
                            {p.pnl >= 0 ? "+" : ""}
                            {formatUsd(p.pnl)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-border font-semibold">
                        <td colSpan={5} className="px-4 py-2 text-right">
                          Total loss:
                        </td>
                        <td className="px-4 py-2 text-right text-error">
                          {formatUsd(-result.worst_case.total_loss)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="border border-border" style={{ borderRadius: "2px" }}>
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="font-mono text-sm font-semibold uppercase tracking-wider">
                      Suggested Markets
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Markets with structural relationships to your portfolio that could reduce collateral.
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {suggestions.map((s) => (
                      <div key={s.market_id} className="px-4 py-2 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-mono truncate max-w-[300px]" title={s.market_title}>
                            {s.market_title}
                          </div>
                          <div className="text-[10px] text-text-secondary font-mono">
                            {s.relationship_count} relationship{s.relationship_count !== 1 ? "s" : ""} to portfolio
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meta info */}
              <div className="text-xs text-text-secondary font-mono py-2">
                {result.constraint_count} constraint{result.constraint_count !== 1 ? "s" : ""} evaluated
                {" / "}
                {result.binding_constraints.length} binding
                {" / "}
                {positions.length} position{positions.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
