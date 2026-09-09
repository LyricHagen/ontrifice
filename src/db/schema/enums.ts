import { pgEnum } from "drizzle-orm/pg-core";

export const platformEnum = pgEnum("platform", [
  "polymarket",
  "kalshi",
  "limitless",
]);

export const marketStatusEnum = pgEnum("market_status", [
  "active",
  "resolved",
  "voided",
]);

export const resolutionEnum = pgEnum("resolution", [
  "yes",
  "no",
  "unresolved",
]);

export const relationClassEnum = pgEnum("relation_class", [
  "logical",
  "statistical",
  "semantic",
]);

export const edgeDirectionEnum = pgEnum("edge_direction", [
  "bidirectional",
  "source_leads",
  "target_leads",
]);

export const violationTypeEnum = pgEnum("violation_type", [
  "probability_sum",
  "conditional_contradiction",
  "mutual_exclusion",
  "implication_violation",
]);

export const alertStatusEnum = pgEnum("alert_status", [
  "active",
  "resolved",
  "expired",
]);

export const confidenceBasisEnum = pgEnum("confidence_basis", [
  "direct_observation",
  "path_inference",
]);
