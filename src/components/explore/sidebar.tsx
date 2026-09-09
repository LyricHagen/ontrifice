"use client";

import { useCallback } from "react";
import type { Filters } from "./types";

interface SidebarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  categories: string[];
  marketCount: number;
  edgeCount: number;
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({
  filters,
  onFiltersChange,
  categories,
  marketCount,
  edgeCount,
  collapsed,
  onToggle,
}: SidebarProps) {
  const updateFilter = useCallback(
    (patch: Partial<Filters>) => {
      onFiltersChange({ ...filters, ...patch });
    },
    [filters, onFiltersChange],
  );

  const toggleSetItem = useCallback(
    (set: Set<string>, item: string): Set<string> => {
      const next = new Set(set);
      if (next.has(item)) {
        next.delete(item);
      } else {
        next.add(item);
      }
      return next;
    },
    [],
  );

  const resetFilters = useCallback(() => {
    onFiltersChange({
      search: "",
      platforms: new Set(),
      categories: new Set(),
      relationClasses: new Set(),
      minScore: 0,
    });
  }, [onFiltersChange]);

  const hasActiveFilters =
    filters.search !== "" ||
    filters.platforms.size > 0 ||
    filters.categories.size > 0 ||
    filters.relationClasses.size > 0 ||
    filters.minScore > 0;

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="absolute top-3 left-3 z-20 bg-surface border border-border px-2 py-1.5 text-xs font-mono text-text-secondary"
        style={{ borderRadius: "2px" }}
        aria-label="Open filters"
      >
        Filters
      </button>
    );
  }

  return (
    <aside
      className="w-[280px] shrink-0 border-r border-border bg-surface overflow-y-auto flex flex-col"
      style={{ height: "100%" }}
    >
      <div className="px-3 py-3 border-b border-border flex items-center justify-between">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Filters
        </span>
        <button
          onClick={onToggle}
          className="text-text-secondary text-xs font-mono md:hidden"
          aria-label="Close filters"
        >
          X
        </button>
      </div>

      <div className="px-3 py-3 flex flex-col gap-4 flex-1">
        <div>
          <label className="block text-xs font-mono text-text-secondary mb-1">
            Search
          </label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilter({ search: e.target.value })}
            placeholder="Filter by title..."
            className="w-full bg-background border border-border px-2 py-1.5 text-sm font-mono text-foreground placeholder:text-muted"
            style={{ borderRadius: "2px" }}
          />
        </div>

        <div>
          <span className="block text-xs font-mono text-text-secondary mb-1.5">
            Platform
          </span>
          {(["polymarket", "kalshi", "limitless"] as const).map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm mb-1 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.platforms.has(p)}
                onChange={() =>
                  updateFilter({ platforms: toggleSetItem(filters.platforms, p) })
                }
                className="accent-accent"
              />
              <span className="font-mono text-xs">{p}</span>
            </label>
          ))}
        </div>

        <div>
          <span className="block text-xs font-mono text-text-secondary mb-1.5">
            Category
          </span>
          {categories.length === 0 ? (
            <span className="text-xs text-muted">No categories</span>
          ) : (
            <div className="max-h-32 overflow-y-auto">
              {categories.map((cat) => (
                <label
                  key={cat}
                  className="flex items-center gap-2 text-sm mb-1 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={filters.categories.has(cat)}
                    onChange={() =>
                      updateFilter({
                        categories: toggleSetItem(filters.categories, cat),
                      })
                    }
                    className="accent-accent"
                  />
                  <span className="font-mono text-xs truncate">{cat}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="block text-xs font-mono text-text-secondary mb-1.5">
            Relation class
          </span>
          {(["semantic", "statistical", "logical"] as const).map(
            (t) => (
              <label
                key={t}
                className="flex items-center gap-2 text-sm mb-1 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={filters.relationClasses.has(t)}
                  onChange={() =>
                    updateFilter({
                      relationClasses: toggleSetItem(filters.relationClasses, t),
                    })
                  }
                  className="accent-accent"
                />
                <span className="font-mono text-xs">{t}</span>
              </label>
            ),
          )}
        </div>

        <div>
          <label className="block text-xs font-mono text-text-secondary mb-1">
            Min score: {filters.minScore.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={filters.minScore}
            onChange={(e) =>
              updateFilter({ minScore: parseFloat(e.target.value) })
            }
            className="w-full accent-accent"
          />
        </div>

        <div className="text-xs font-mono text-text-secondary">
          {marketCount} markets, {edgeCount} edges visible
        </div>

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-xs font-mono text-accent text-left"
          >
            Reset filters
          </button>
        )}
      </div>
    </aside>
  );
}
