import type { Metadata } from "next";
import { IncoherencesFeed } from "@/components/incoherences/feed";

export const metadata: Metadata = {
  title: "Incoherences",
  description:
    "Cross-market contradictions and statistical divergences detected in the prediction market dependency graph.",
  openGraph: {
    title: "Incoherences | Ontrifice",
    description: "Cross-market contradictions and statistical divergences detected in the prediction market dependency graph.",
    type: "website",
    url: "https://ontrifice.dev/incoherences",
  },
};

export default function IncoherencesPage() {
  return (
    <div className="max-w-[960px] mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold font-mono mb-1">Incoherences</h1>
      <p className="text-sm text-text-secondary mb-8">
        Contradictions (logically impossible prices) and divergences (statistically unusual prices) detected in the dependency graph.
      </p>
      <IncoherencesFeed />
    </div>
  );
}
