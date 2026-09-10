import type { Metadata } from "next";
import Link from "next/link";
import { LiveStats } from "@/components/live-stats";

export const metadata: Metadata = {
  title: "Ontrifice",
  description:
    "Live prediction market coherence engine. Surfaces cross-event logical inconsistencies, model-implied probabilities, and cascade alerts across Polymarket, Kalshi, and Limitless.",
  openGraph: {
    title: "Ontrifice",
    description:
      "Live prediction market coherence engine. Surfaces cross-event logical inconsistencies, model-implied probabilities, and cascade alerts.",
    type: "website",
    url: "https://ontrifice.dev",
  },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="max-w-[720px] mx-auto px-4 py-16">
      {params.deleted === "true" && (
        <div
          className="border border-border bg-surface px-4 py-3 text-sm text-text-secondary mb-8"
          style={{ borderRadius: "2px" }}
          role="status"
        >
          Your account has been deleted.
        </div>
      )}

      <header className="mb-16">
        <h1 className="font-mono text-4xl font-bold mb-4">Ontrifice</h1>
      </header>

      <section className="mb-16">
        <div className="flex flex-col gap-4 text-text-secondary leading-relaxed">
          <p>
            Prediction markets price events independently. But events are
            massively correlated. &ldquo;Fed cuts rates in September&rdquo; and
            &ldquo;S&P above 5500 by EOY&rdquo; and &ldquo;recession by
            Q1&rdquo; are not independent propositions&mdash;yet every platform
            treats them as if they are.
          </p>
          <p>
            There is roughly $25B/month flowing through prediction markets with
            no coherence layer. Logical contradictions persist for hours or
            days; implied conditionals go unpriced. Cascade
            effects&mdash;where one resolved event should reprice a dozen
            others&mdash;are invisible until they happen. The information is
            there, it&apos;s just scattered across platforms, contracts, and
            order books with no system connecting the different pieces.
          </p>
          <p>
            Some use cases: pricing conditionals no single market offers,
            catching cascade lag before downstream contracts reprice, flagging
            when exclusive outcomes sum past 100%.
          </p>
        </div>
      </section>

      <section className="mb-16">
        <LiveStats />
      </section>

      <section className="mb-16 flex gap-4">
        <Link
          href="/explore"
          className="font-mono text-sm px-5 py-2.5 border border-border text-foreground no-underline hover:border-accent hover:text-accent"
          style={{ borderRadius: "2px" }}
        >
          Explore the graph
        </Link>
        <Link
          href="/docs"
          className="font-mono text-sm px-5 py-2.5 border border-border text-foreground no-underline hover:border-accent hover:text-accent"
          style={{ borderRadius: "2px" }}
        >
          Read the docs
        </Link>
      </section>

      <section className="text-sm text-text-secondary border-t border-border pt-6">
        <p>
          Built on data from{" "}
          <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer">
            Polymarket
          </a>
          ,{" "}
          <a href="https://kalshi.com" target="_blank" rel="noopener noreferrer">
            Kalshi
          </a>
          , and{" "}
          <a href="https://limitless.exchange" target="_blank" rel="noopener noreferrer">
            Limitless
          </a>
          .{" "}
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">
            Open source
          </a>
          .
        </p>
      </section>
    </div>
  );
}
