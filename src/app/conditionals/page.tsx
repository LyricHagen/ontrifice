import type { Metadata } from "next";
import { ConditionalsInterface } from "@/components/conditionals/interface";

export const metadata: Metadata = {
  title: "Implied Conditionals",
  description:
    "Conditional probabilities derived from the dependency graph that no single market prices.",
};

export default function ConditionalsPage() {
  return (
    <div className="max-w-[960px] mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold font-mono mb-1">
        Implied Conditionals
      </h1>
      <p className="text-sm text-text-secondary mb-8">
        Conditional probabilities derived from the dependency graph that no
        single market prices.
      </p>
      <ConditionalsInterface />
    </div>
  );
}
