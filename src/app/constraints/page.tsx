import type { Metadata } from "next";
import { ConstraintsBrowser } from "@/components/constraints/constraints-browser";

export const metadata: Metadata = {
  title: "Constraints",
  description:
    "Browse proven structural constraints between prediction markets. The logical relationships that power risk analysis.",
  openGraph: {
    title: "Constraints | Ontrifice",
    description:
      "Proven structural relationships between prediction markets across Polymarket and Kalshi.",
    type: "website",
    url: "https://ontrifice.dev/constraints",
  },
};

export const dynamic = "force-dynamic";

export default function ConstraintsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <ConstraintsBrowser />
    </div>
  );
}
