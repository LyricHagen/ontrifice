import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { markets, edges, marketSnapshots } from "../schema";

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log("seeding markets...");

  const inserted = await db
    .insert(markets)
    .values([
      {
        platform: "polymarket",
        platformMarketId: "pm-us-pres-2028",
        title: "Will a Democrat win the 2028 US Presidential Election?",
        category: "politics",
        currentProbability: "0.48",
        volumeUsd: "15420000.00",
        status: "active",
        metadata: { slug: "democrat-wins-2028", endDate: "2028-11-03" },
      },
      {
        platform: "polymarket",
        platformMarketId: "pm-fed-rate-dec-2026",
        title: "Will the Fed cut rates in December 2026?",
        category: "economics",
        currentProbability: "0.62",
        volumeUsd: "8340000.00",
        status: "active",
        metadata: { slug: "fed-rate-cut-dec-2026" },
      },
      {
        platform: "kalshi",
        platformMarketId: "kal-btc-100k-2026",
        title: "Will Bitcoin exceed $100k by end of 2026?",
        category: "crypto",
        currentProbability: "0.71",
        volumeUsd: "5210000.00",
        status: "active",
        metadata: { ticker: "BTC-100K-2026" },
      },
      {
        platform: "kalshi",
        platformMarketId: "kal-recession-2027",
        title: "Will the US enter a recession by Q2 2027?",
        category: "economics",
        currentProbability: "0.23",
        volumeUsd: "3150000.00",
        status: "active",
        metadata: { ticker: "RECESSION-2027-Q2" },
      },
      {
        platform: "limitless",
        platformMarketId: "lim-agi-2030",
        title: "Will AGI be achieved by 2030?",
        category: "technology",
        currentProbability: "0.12",
        volumeUsd: "920000.00",
        status: "active",
        metadata: { category: "ai" },
      },
      {
        platform: "polymarket",
        platformMarketId: "pm-gop-house-2026",
        title: "Will Republicans hold the House after 2026 midterms?",
        category: "politics",
        currentProbability: "0.55",
        volumeUsd: "11200000.00",
        status: "active",
        metadata: { slug: "gop-holds-house-2026" },
      },
      {
        platform: "kalshi",
        platformMarketId: "kal-sp500-above-6000",
        title: "Will the S&P 500 close above 6000 on Dec 31 2026?",
        category: "economics",
        currentProbability: "0.58",
        volumeUsd: "4780000.00",
        status: "active",
        metadata: { ticker: "SP500-6000-EOY-2026" },
      },
      {
        platform: "limitless",
        platformMarketId: "lim-spacex-mars-2029",
        title: "Will SpaceX land humans on Mars before 2030?",
        category: "technology",
        currentProbability: "0.04",
        volumeUsd: "310000.00",
        status: "active",
        metadata: { category: "space" },
      },
    ])
    .returning();

  console.log(`inserted ${inserted.length} markets`);

  const now = Date.now();
  const snapshotValues = inserted.flatMap((m) =>
    Array.from({ length: 5 }, (_, i) => ({
      marketId: m.id,
      probability: (
        Number(m.currentProbability) +
        (Math.random() - 0.5) * 0.1
      )
        .toFixed(8)
        .toString(),
      volumeUsd: m.volumeUsd!,
      recordedAt: new Date(now - (4 - i) * 3600_000),
    })),
  );

  await db.insert(marketSnapshots).values(snapshotValues);
  console.log(`inserted ${snapshotValues.length} snapshots`);

  // semantic edge: dem president <-> gop house (inverse correlation)
  await db.insert(edges).values([
    {
      sourceMarketId: inserted[0].id,
      targetMarketId: inserted[5].id,
      edgeType: "semantic",
      weight: "-0.65",
      confidence: "0.80",
      direction: "bidirectional",
      evidence: {
        method: "nli",
        score: 0.82,
        rationale: "partisan control correlation",
      },
    },
    {
      sourceMarketId: inserted[1].id,
      targetMarketId: inserted[6].id,
      edgeType: "temporal",
      weight: "0.45",
      confidence: "0.70",
      direction: "source_leads",
      evidence: {
        method: "granger",
        pValue: 0.03,
        lagDays: 14,
      },
    },
    {
      sourceMarketId: inserted[3].id,
      targetMarketId: inserted[6].id,
      edgeType: "structural",
      weight: "-0.72",
      confidence: "0.85",
      direction: "bidirectional",
      evidence: {
        method: "economic_model",
        rationale: "recession inversely correlated with equity performance",
      },
    },
  ]);
  console.log("inserted 3 edges");

  await pool.end();
  console.log("seed complete");
}

seed().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
