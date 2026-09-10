import type { Metadata } from "next";
import { PortfolioAnalyzer } from "@/components/analyzer/portfolio-analyzer";

export const metadata: Metadata = {
  title: "Analyzer",
  description:
    "Compute collateral-efficient portfolios. Input your positions, see your true max loss and the proven relationships that reduce it.",
  openGraph: {
    title: "Analyzer | Ontrifice",
    description:
      "Cross-market neg risk engine. Compute true max loss across correlated prediction market positions.",
    type: "website",
    url: "https://ontrifice.dev/analyzer",
  },
};

export const dynamic = "force-dynamic";

export default function AnalyzerPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PortfolioAnalyzer />
    </div>
  );
}
