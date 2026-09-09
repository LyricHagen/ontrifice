import type { Metadata } from "next";
import { ConditionalsInterface } from "@/components/conditionals/interface";

export const metadata: Metadata = {
  title: "Model-Implied Probabilities",
  description:
    "Probability estimates derived from the dependency graph. Model outputs, not market prices.",
  openGraph: {
    title: "Model-Implied Probabilities | Ontrifice",
    description:
      "Probability estimates derived from the dependency graph. Model outputs, not market prices.",
    type: "website",
    url: "https://ontrifice.dev/conditionals",
  },
};

export default function ConditionalsPage() {
  return (
    <div className="max-w-[960px] mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold font-mono mb-1">
        Model-Implied Probabilities
      </h1>
      <p className="text-sm text-text-secondary mb-8">
        Probability estimates derived from the dependency graph. These are model
        outputs, not market prices. Confidence depends on the quality and type of
        the underlying relationships.
      </p>
      <ConditionalsInterface />
    </div>
  );
}
