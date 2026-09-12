"use client";

import { useEffect, useState } from "react";

interface Stats {
  marketsCount: number;
  constraintsCount: number;
  constraintTypes: number;
}

function StatCell({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex-1 py-4 px-3 text-center">
      <div className="font-mono text-2xl font-bold mb-1">
        {value === null ? (
          <div
            className="h-7 bg-surface-raised animate-pulse mx-auto"
            style={{ width: "60%", borderRadius: "2px" }}
          />
        ) : (
          value
        )}
      </div>
      <div className="text-xs text-text-secondary uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

export function LiveStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch stats");
        return res.json();
      })
      .then((data) =>
        setStats({
          marketsCount: data.marketsCount ?? 0,
          constraintsCount: data.constraintsCount ?? 0,
          constraintTypes: data.constraintTypes ?? 4,
        }),
      )
      .catch(() => {
        setStats({ marketsCount: 0, constraintsCount: 0, constraintTypes: 0 });
      });
  }, []);

  return (
    <div className="border border-border flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
      <StatCell
        label="Markets tracked"
        value={stats ? stats.marketsCount.toLocaleString() : null}
      />
      <StatCell
        label="Proven constraints"
        value={stats ? stats.constraintsCount.toLocaleString() : null}
      />
      <StatCell
        label="Constraint types"
        value={stats ? String(stats.constraintTypes) : null}
      />
    </div>
  );
}
