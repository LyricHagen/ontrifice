import type { Metadata } from "next";
import { CascadesFeed } from "@/components/cascades/feed";

export const metadata: Metadata = {
  title: "Cascade Alerts",
  description:
    "Markets that moved significantly but whose connected markets haven't followed yet.",
  openGraph: {
    title: "Cascade Alerts | Ontrifice",
    description: "Markets that moved significantly but whose connected markets haven't followed yet.",
    type: "website",
    url: "https://ontrifice.dev/cascades",
  },
};

export default function CascadesPage() {
  return (
    <div className="max-w-[960px] mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold font-mono mb-1">Cascade Alerts</h1>
      <p className="text-sm text-text-secondary mb-8">
        Markets that moved significantly but whose connected markets
        haven&apos;t followed yet.
      </p>
      <CascadesFeed />
    </div>
  );
}
