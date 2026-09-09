import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

export interface GroundTruthPair {
  market_a_title: string;
  market_b_title: string;
  true_relation_class: "logical" | "statistical" | "semantic" | "none";
  true_relation_type:
    | "equivalent"
    | "implies"
    | "mutually_exclusive"
    | "correlation"
    | "lead_lag"
    | "unrelated";
  true_label: "related" | "unrelated";
  notes: string;
}

export function loadGroundTruth(): GroundTruthPair[] {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const dataPath = resolve(currentDir, "data", "relations.json");
  const raw = readFileSync(dataPath, "utf-8");
  const pairs: GroundTruthPair[] = JSON.parse(raw);
  return pairs;
}

export function summarizeDataset(pairs: GroundTruthPair[]): {
  total: number;
  byType: Record<string, number>;
  byLabel: Record<string, number>;
  byClass: Record<string, number>;
} {
  const byType: Record<string, number> = {};
  const byLabel: Record<string, number> = {};
  const byClass: Record<string, number> = {};

  for (const pair of pairs) {
    byType[pair.true_relation_type] =
      (byType[pair.true_relation_type] ?? 0) + 1;
    byLabel[pair.true_label] = (byLabel[pair.true_label] ?? 0) + 1;
    byClass[pair.true_relation_class] =
      (byClass[pair.true_relation_class] ?? 0) + 1;
  }

  return { total: pairs.length, byType, byLabel, byClass };
}
