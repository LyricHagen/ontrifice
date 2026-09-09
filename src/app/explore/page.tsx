import type { Metadata } from "next";
import { db, schema } from "@/db";
import { desc, count } from "drizzle-orm";
import { Suspense } from "react";
import { Skeleton } from "@/components/skeleton";

export const metadata: Metadata = {
  title: "Explore",
};

export const dynamic = "force-dynamic";

async function MarketList() {
  const [markets, totalResult] = await Promise.all([
    db
      .select({
        id: schema.markets.id,
        platform: schema.markets.platform,
        title: schema.markets.title,
        currentProbability: schema.markets.currentProbability,
        volumeUsd: schema.markets.volumeUsd,
        status: schema.markets.status,
        updatedAt: schema.markets.updatedAt,
      })
      .from(schema.markets)
      .orderBy(desc(schema.markets.updatedAt))
      .limit(50),
    db.select({ count: count() }).from(schema.markets),
  ]);

  const total = totalResult[0].count;

  if (markets.length === 0) {
    return (
      <p className="text-text-secondary py-8">
        No markets ingested yet. Trigger an ingestion run via POST /api/ingestion/trigger.
      </p>
    );
  }

  return (
    <>
      <p className="text-text-secondary text-sm mb-4 font-mono">
        {total} markets tracked
      </p>
      <div className="border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-secondary">
              <th className="px-3 py-2 font-medium">market</th>
              <th className="px-3 py-2 font-medium w-24">platform</th>
              <th className="px-3 py-2 font-medium w-28 text-right">probability</th>
              <th className="px-3 py-2 font-medium w-28 text-right">volume</th>
            </tr>
          </thead>
          <tbody>
            {markets.map((market) => (
              <tr key={market.id} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2">{market.title}</td>
                <td className="px-3 py-2 font-mono text-text-secondary text-xs">
                  {market.platform}
                </td>
                <td className="px-3 py-2 font-mono text-right">
                  {market.currentProbability
                    ? `${(parseFloat(market.currentProbability) * 100).toFixed(1)}%`
                    : "--"}
                </td>
                <td className="px-3 py-2 font-mono text-right text-text-secondary">
                  {market.volumeUsd
                    ? `$${parseFloat(market.volumeUsd).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                    : "--"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function ExplorePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold font-mono mb-4">Explore</h1>
      <Suspense fallback={<Skeleton rows={10} widths={["100%", "100%", "100%", "100%", "100%", "100%", "100%", "100%", "100%", "100%"]} />}>
        <MarketList />
      </Suspense>
    </div>
  );
}
