import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ontrifice",
};

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold font-mono mb-4">Ontrifice</h1>
      <p className="text-text-secondary max-w-2xl">
        Live prediction market coherence engine. Surfaces cross-event logical
        inconsistencies, implied conditional probabilities, and cascade alerts
        across the entire prediction market universe.
      </p>
    </div>
  );
}
