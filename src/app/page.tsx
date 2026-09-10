import type { Metadata } from "next";
import Link from "next/link";
import { LiveStats } from "@/components/live-stats";

export const metadata: Metadata = {
  title: "Ontrifice",
  description:
    "Cross-market neg risk engine for prediction markets. Proves structural relationships between contracts across platforms to compute collateral-efficient portfolios.",
  openGraph: {
    title: "Ontrifice",
    description:
      "Cross-market neg risk engine. Proves structural relationships between prediction market contracts to reduce collateral requirements.",
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

      {/* Hero */}
      <header className="mb-16">
        <h1 className="font-mono text-4xl font-bold mb-6">Ontrifice</h1>
        <p className="text-lg text-foreground leading-relaxed">
          Your prediction market portfolio posts collateral for each position
          independently; your actual max loss is lower.
        </p>
      </header>

      {/* Live demo number */}
      <section className="mb-16">
        <LiveStats />
      </section>

      {/* Problem + How it works + Use cases */}
      <section className="mb-16">
        <div className="flex flex-col gap-4 text-text-secondary leading-relaxed">
          <p>
            Prediction markets are fully collateralized and every position locks
            up its full risk amount. Neg risk solves this within single
            winner-take-all events: if you hold NO on every candidate in
            &ldquo;Who wins the election?&rdquo;, you only post collateral for
            your max loss, not the sum of all legs.
          </p>
          <p>
            But across disparate markets / platforms / different contract
            structures, your capital is fragmented; you post collateral as if
            your positions are independent but they aren&apos;t.
          </p>
          <p>
            How it works: Ontrifice ingests markets from Polymarket and Kalshi
            and detects structural relationships (mutual exclusion, implication,
            exhaustive sets). Then, you input a portfolio of positions across any
            markets on any platform. Then, the solver computes your true max loss
            given the proven constraints and shows exactly which relationships
            are saving you capital.
          </p>
          <p>
            Use cases: margining a trifecta book as one position, finding hedges
            you didn&apos;t know you had, handing your broker an auditable
            max-loss proof, adding a leg that shrinks your worst case.
          </p>
        </div>
      </section>

      {/* CTAs */}
      <section className="mb-16 flex gap-4">
        <Link
          href="/analyzer"
          className="font-mono text-sm px-5 py-2.5 border border-accent text-accent no-underline"
          style={{ borderRadius: "2px" }}
        >
          Open the analyzer
        </Link>
        <Link
          href="/docs"
          className="font-mono text-sm px-5 py-2.5 border border-border text-foreground no-underline hover:border-accent hover:text-accent"
          style={{ borderRadius: "2px" }}
        >
          Read the docs
        </Link>
      </section>

      {/* Footer note */}
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
          <a href="https://github.com/LyricHagen/ontrifice" target="_blank" rel="noopener noreferrer">
            Open source
          </a>
          .
        </p>
      </section>
    </div>
  );
}
