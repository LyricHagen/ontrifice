import {
  pgTable,
  uuid,
  decimal,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relationClassEnum, edgeDirectionEnum } from "./enums";
import { markets } from "./markets";

export const edges = pgTable(
  "edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceMarketId: uuid("source_market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    targetMarketId: uuid("target_market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    relationClass: relationClassEnum("relation_class").notNull(),
    relationType: text("relation_type").notNull(),
    score: decimal("score", { precision: 10, scale: 8 }).notNull(),
    confidence: decimal("confidence", { precision: 10, scale: 8 }).notNull(),
    direction: edgeDirectionEnum("direction")
      .notNull()
      .default("bidirectional"),
    mathematicalSemantics: text("mathematical_semantics"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>(),
    modelVersion: text("model_version"),
    algorithmParams: jsonb("algorithm_params").$type<Record<string, unknown>>(),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    sampleSize: integer("sample_size"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("edges_source_idx").on(table.sourceMarketId),
    index("edges_target_idx").on(table.targetMarketId),
    index("edges_relation_class_idx").on(table.relationClass),
    index("edges_relation_type_idx").on(table.relationType),
    index("edges_source_target_class_idx").on(
      table.sourceMarketId,
      table.targetMarketId,
      table.relationClass,
    ),
  ],
);
