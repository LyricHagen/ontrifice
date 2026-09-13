import type { Metadata } from "next";
import Link from "next/link";
import { LiveStats } from "@/components/live-stats";

export const metadata: Metadata = {
  title: "Ontrifice",
  description:
    "Cross-market structural risk analyzer for prediction markets. Proves logical relationships between contracts across platforms to compute true portfolio max loss.",
  openGraph: {
    title: "Ontrifice",
    description:
      "Structural risk analyzer for prediction markets. Computes true max loss given proven constraints between contracts.",
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
          Your prediction market portfolio has a lower true max loss than the
          sum of its parts.
        </p>
      </header>

      {/* Live stats */}
      <section className="mb-16">
        <LiveStats />
      </section>

      {/* Problem + How it works + Use cases */}
      <section className="mb-16">
        <div className="flex flex-col gap-4 text-text-secondary leading-relaxed">
          <p>
            Platforms margin each position independently. If you hold YES on
            candidate A and YES on candidate B in the same race, both lock up
            full risk. But at most one can win; your actual worst case is
            lower than the sum.
          </p>
          <p>
            The same logic applies across markets and platforms: bucketed data
            releases (only one unemployment range can hit), the same binary
            question on Polymarket and Kalshi (they resolve identically), and
            logical implications (winning the nomination is necessary to win the
            general).
          </p>
          <p>
            Ontrifice ingests markets from Polymarket and Kalshi, detects
            provable structural relationships (mutual exclusion, complement,
            implication), and computes your true economic max loss given those
            constraints. The output is an auditable risk certificate: every
            worst-case scenario, every binding constraint, every shadow price.
          </p>
          <p>
            Use cases: computing true risk across a multi-leg book, finding
            structural hedges you didn&apos;t know you had, handing a risk
            manager a verifiable max-loss proof, identifying positions that
            reduce your worst case.
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
          </a>{" "}
          and{" "}
          <a href="https://kalshi.com" target="_blank" rel="noopener noreferrer">
            Kalshi
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
