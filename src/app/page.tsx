import type { Metadata } from "next";
import Link from "next/link";
import { Skeleton } from "@/components/skeleton";

export const metadata: Metadata = {
  title: "Ontrifice",
};

function StatCell({ label }: { label: string }) {
  return (
    <div className="flex-1 py-4 px-3 text-center">
      <div className="font-mono text-2xl font-bold mb-1">
        <Skeleton rows={1} widths={["60%"]} />
      </div>
      <div className="text-xs text-text-secondary uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

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
        >
          Your account has been deleted.
        </div>
      )}

      {/* Header */}
      <header className="mb-16">
        <h1 className="font-mono text-4xl font-bold mb-4">Ontrifice</h1>
        <p className="text-lg mb-2">
          A live coherence engine for prediction markets.
        </p>
        <p className="text-sm text-text-secondary">
          Surfaces cross-event dependencies, logical inconsistencies, and
          implied conditional probabilities across Polymarket, Kalshi, and
          Limitless.
        </p>
      </header>

      {/* The Problem */}
      <section className="mb-16">
        <h2 className="font-mono text-sm text-muted uppercase tracking-wider mb-6">
          The problem
        </h2>
        <div className="flex flex-col gap-4 text-text-secondary leading-relaxed">
          <p>
            Prediction markets price events independently. But events are
            massively correlated. &ldquo;Fed cuts rates in September,&rdquo;
            &ldquo;S&P above 5500 by EOY,&rdquo; and &ldquo;recession by
            Q1&rdquo; are not independent propositions&mdash;yet every platform
            treats them as if they are.
          </p>
          <p>
            There is roughly $25B/month flowing through prediction markets with
            no coherence layer. Logical contradictions persist for hours or days.
            Implied conditionals go unpriced. Cascade effects&mdash;where one
            resolved event should reprice a dozen others&mdash;are invisible
            until they happen.
          </p>
          <p>
            The information is there. It is just scattered across platforms,
            contracts, and order books, with no system connecting the pieces.
          </p>
        </div>
      </section>

      {/* What Ontrifice Does */}
      <section className="mb-16">
        <h2 className="font-mono text-sm text-muted uppercase tracking-wider mb-6">
          What it does
        </h2>
        <dl className="flex flex-col">
          <div className="flex border-t border-border py-5 gap-6">
            <dt className="w-40 shrink-0 font-mono text-sm font-medium border-r border-border pr-6">
              Dependency Graph
            </dt>
            <dd className="text-sm text-text-secondary leading-relaxed">
              Continuously builds and updates a graph of cross-event
              probabilistic dependencies using semantic analysis, temporal
              co-movement (Granger-causal), and structural constraints.
            </dd>
          </div>
          <div className="flex border-t border-border py-5 gap-6">
            <dt className="w-40 shrink-0 font-mono text-sm font-medium border-r border-border pr-6">
              Incoherences
            </dt>
            <dd className="text-sm text-text-secondary leading-relaxed">
              Detects when a cluster of related markets implies a joint
              probability that violates basic logic. Shows the cheapest
              portfolio that exploits it.
            </dd>
          </div>
          <div className="flex border-t border-border py-5 gap-6">
            <dt className="w-40 shrink-0 font-mono text-sm font-medium border-r border-border pr-6">
              Implied Conditionals
            </dt>
            <dd className="text-sm text-text-secondary leading-relaxed">
              Computes conditional probabilities that no single market prices.
              P(recession&nbsp;|&nbsp;no&nbsp;Fed&nbsp;cut) derived from
              combining 6+ independent markets.
            </dd>
          </div>
          <div className="flex border-t border-b border-border py-5 gap-6">
            <dt className="w-40 shrink-0 font-mono text-sm font-medium border-r border-border pr-6">
              Cascade Alerts
            </dt>
            <dd className="text-sm text-text-secondary leading-relaxed">
              When market X moves but logically connected markets Y and Z
              haven&apos;t followed, surfaces the expected lag window and
              magnitude of the anticipated repricing.
            </dd>
          </div>
        </dl>
      </section>

      {/* Live Stats */}
      <section className="mb-16">
        <div className="border border-border flex divide-x divide-border">
          <StatCell label="Markets tracked" />
          <StatCell label="Active edges" />
          <StatCell label="Open incoherences" />
        </div>
      </section>

      {/* CTA */}
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

      {/* Data Sources */}
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
