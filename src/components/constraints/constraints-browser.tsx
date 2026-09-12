"use client";

import { useState, useEffect, useCallback } from "react";

interface MarketRef {
  id: string;
  title: string;
  platform: string;
}

interface ConstraintRow {
  id: string;
  market_a: MarketRef;
  market_b: MarketRef;
  relation_class: string;
  relation_type: string;
  confidence: string;
  score: string;
  direction: string;
  mathematical_semantics: string | null;
  evidence: Record<string, unknown> | null;
  detected_at: string;
  model_version: string | null;
}

const RELATION_TYPES = [
  { value: "", label: "All types" },
  { value: "mutually_exclusive", label: "Mutual exclusion" },
  { value: "implies", label: "Implication" },
  { value: "complement", label: "Complement" },
  { value: "temporal_precondition", label: "Temporal" },
];

const RELATION_CLASSES = [
  { value: "logical", label: "Logical (constraints)" },
  { value: "", label: "All classes" },
  { value: "statistical", label: "Statistical" },
  { value: "semantic", label: "Semantic (similarities)" },
];

const PLATFORMS = [
  { value: "", label: "All platforms" },
  { value: "polymarket", label: "Polymarket" },
  { value: "kalshi", label: "Kalshi" },
  { value: "cross-platform", label: "Cross-platform" },
];

function middleTruncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  const keep = maxLen - 3;
  const front = Math.ceil(keep * 0.4);
  const back = Math.floor(keep * 0.6);
  return str.slice(0, front) + "..." + str.slice(-back);
}

export function ConstraintsBrowser() {
  const [constraints, setConstraints] = useState<ConstraintRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [relationType, setRelationType] = useState("");
  const [relationClass, setRelationClass] = useState("logical");
  const [platform, setPlatform] = useState("");
  const [minConfidence, setMinConfidence] = useState("");

  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("limit", "50");
    if (relationType) params.set("type", relationType);
    if (relationClass) params.set("class", relationClass);
    if (platform) params.set("platform", platform);
    if (minConfidence) params.set("min_confidence", minConfidence);

    try {
      const res = await fetch(`/api/constraints?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error?.message ?? `Failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      setConstraints(data.constraints ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load constraints. (ERR_CONSTRAINTS_FETCH)",
      );
    } finally {
      setLoading(false);
    }
  }, [relationType, relationClass, platform, minConfidence]);

  useEffect(() => {
    setPage(1);
    fetchData(1);
  }, [fetchData]);

  const goPage = (p: number) => {
    setPage(p);
    fetchData(p);
  };

  const totalPages = Math.max(1, Math.ceil(total / 50));

  const isSemanticView = relationClass === "semantic";

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-mono text-2xl font-bold mb-1">Constraints</h1>
        <p className="text-sm text-text-secondary">
          {isSemanticView
            ? "Semantic similarities between markets. These are textual matches, not usable for risk computation."
            : "Proven structural constraints between markets. These power risk analysis in the analyzer."}
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 mb-4 text-xs font-mono text-text-secondary flex-wrap">
        <span>{total.toLocaleString()} {isSemanticView ? "similarities" : "constraints"}</span>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={relationClass}
          onChange={(e) => setRelationClass(e.target.value)}
          className="bg-surface border border-border px-2 py-1.5 text-xs font-mono text-foreground"
          style={{ borderRadius: "2px" }}
        >
          {RELATION_CLASSES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={relationType}
          onChange={(e) => setRelationType(e.target.value)}
          className="bg-surface border border-border px-2 py-1.5 text-xs font-mono text-foreground"
          style={{ borderRadius: "2px" }}
        >
          {RELATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="bg-surface border border-border px-2 py-1.5 text-xs font-mono text-foreground"
          style={{ borderRadius: "2px" }}
        >
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div
          className="border border-error-border bg-error-bg p-4 mb-4"
          style={{ borderRadius: "2px" }}
        >
          <p className="font-mono text-sm text-error">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-12 justify-center">
          <div
            className="w-4 h-4 border border-accent border-t-transparent animate-spin"
            style={{ borderRadius: "2px" }}
          />
          <span className="font-mono text-sm text-text-secondary">
            Loading constraints...
          </span>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
          {constraints.length === 0 ? (
            <div className="text-center py-12 text-sm text-text-secondary font-mono">
              No constraints found matching the current filters.
            </div>
          ) : (
            <div className="border border-border overflow-x-auto" style={{ borderRadius: "2px" }}>
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border text-text-secondary">
                    <th className="text-left px-4 py-2 font-normal">Market A</th>
                    <th className="text-left px-4 py-2 font-normal">Market B</th>
                    <th className="text-left px-4 py-2 font-normal">Type</th>
                    <th className="text-left px-4 py-2 font-normal">Class</th>
                    <th className="text-right px-4 py-2 font-normal">
                      {isSemanticView ? "Similarity" : "Confidence"}
                    </th>
                    <th className="text-left px-4 py-2 font-normal">Platforms</th>
                  </tr>
                </thead>
                <tbody>
                  {constraints.map((c) => (
                    <>
                      <tr
                        key={c.id}
                        className="border-b border-border cursor-pointer hover:bg-surface-raised"
                        onClick={() =>
                          setExpanded(expanded === c.id ? null : c.id)
                        }
                      >
                        <td className="px-4 py-2 max-w-[200px]" title={c.market_a.title}>
                          {middleTruncate(c.market_a.title, 45)}
                        </td>
                        <td className="px-4 py-2 max-w-[200px]" title={c.market_b.title}>
                          {middleTruncate(c.market_b.title, 45)}
                        </td>
                        <td className="px-4 py-2 text-text-secondary">
                          {c.relation_type.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-2 text-text-secondary">{c.relation_class}</td>
                        <td className="px-4 py-2 text-right">
                          {isSemanticView
                            ? parseFloat(c.score).toFixed(2)
                            : (parseFloat(c.confidence) * 100).toFixed(0) + "%"}
                        </td>
                        <td className="px-4 py-2 text-text-secondary">
                          {c.market_a.platform === c.market_b.platform
                            ? c.market_a.platform
                            : `${c.market_a.platform} / ${c.market_b.platform}`}
                        </td>
                      </tr>
                      {expanded === c.id && (
                        <tr key={`${c.id}-detail`} className="border-b border-border">
                          <td colSpan={6} className="px-4 py-3 bg-surface">
                            <div className="flex flex-col gap-2 text-xs">
                              <div>
                                <span className="text-text-secondary">Market A: </span>
                                <span className="text-foreground">{c.market_a.title}</span>
                              </div>
                              <div>
                                <span className="text-text-secondary">Market B: </span>
                                <span className="text-foreground">{c.market_b.title}</span>
                              </div>
                              {c.mathematical_semantics && (
                                <div>
                                  <span className="text-text-secondary">Semantics: </span>
                                  <span className="text-foreground">{c.mathematical_semantics}</span>
                                </div>
                              )}
                              {c.evidence && (
                                <div>
                                  <span className="text-text-secondary">Evidence: </span>
                                  <span className="text-foreground">
                                    {(c.evidence as Record<string, unknown>).reason as string ??
                                      JSON.stringify(c.evidence)}
                                  </span>
                                </div>
                              )}
                              <div>
                                <span className="text-text-secondary">Score: </span>
                                <span>{parseFloat(c.score).toFixed(4)}</span>
                                {c.model_version && (
                                  <>
                                    <span className="text-text-secondary ml-4">Model: </span>
                                    <span>{c.model_version}</span>
                                  </>
                                )}
                              </div>
                              <div className="text-text-secondary">
                                Detected: {new Date(c.detected_at).toLocaleString()}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-text-secondary font-mono">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => goPage(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1 text-xs font-mono border border-border bg-transparent text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ borderRadius: "2px" }}
                >
                  Prev
                </button>
                <button
                  onClick={() => goPage(page + 1)}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-xs font-mono border border-border bg-transparent text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ borderRadius: "2px" }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
