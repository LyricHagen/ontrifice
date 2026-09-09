"use client";

import { useEffect, useState } from "react";

interface Stats {
  marketsCount: number;
  edgesCount: number;
  activeIncoherences: number;
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
      .then((data: Stats) => setStats(data))
      .catch(() => {
        setStats({ marketsCount: 0, edgesCount: 0, activeIncoherences: 0 });
      });
  }, []);

  return (
    <div className="border border-border flex divide-x divide-border">
      <StatCell
        label="Markets tracked"
        value={stats ? stats.marketsCount.toLocaleString() : null}
      />
      <StatCell
        label="Active edges"
        value={stats ? stats.edgesCount.toLocaleString() : null}
      />
      <StatCell
        label="Open incoherences"
        value={stats ? stats.activeIncoherences.toLocaleString() : null}
      />
    </div>
  );
}
