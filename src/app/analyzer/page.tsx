import type { Metadata } from "next";
import { PortfolioAnalyzer } from "@/components/analyzer/portfolio-analyzer";

export const metadata: Metadata = {
  title: "Portfolio Risk Analyzer",
  description:
    "Compute true max loss for prediction market portfolios. Input your positions, see your worst case given proven structural constraints.",
  openGraph: {
    title: "Portfolio Risk Analyzer | Ontrifice",
    description:
      "Compute true max loss across structurally constrained prediction market positions.",
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
