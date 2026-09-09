import {
  pgTable,
  uuid,
  decimal,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { edgeTypeEnum, edgeDirectionEnum } from "./enums";
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
    edgeType: edgeTypeEnum("edge_type").notNull(),
    weight: decimal("weight", { precision: 10, scale: 8 }).notNull(),
    confidence: decimal("confidence", { precision: 10, scale: 8 }).notNull(),
    direction: edgeDirectionEnum("direction")
      .notNull()
      .default("bidirectional"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("edges_source_target_idx").on(
      table.sourceMarketId,
      table.targetMarketId,
    ),
    index("edges_source_idx").on(table.sourceMarketId),
    index("edges_target_idx").on(table.targetMarketId),
  ],
);
