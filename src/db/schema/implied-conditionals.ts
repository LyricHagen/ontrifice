import { pgTable, uuid, decimal, timestamp } from "drizzle-orm/pg-core";
import { markets } from "./markets";

export const impliedConditionals = pgTable("implied_conditionals", {
  id: uuid("id").primaryKey().defaultRandom(),
  conditionMarketId: uuid("condition_market_id")
    .notNull()
    .references(() => markets.id, { onDelete: "cascade" }),
  targetMarketId: uuid("target_market_id")
    .notNull()
    .references(() => markets.id, { onDelete: "cascade" }),
  conditionalProbability: decimal("conditional_probability", {
    precision: 10,
    scale: 8,
  }).notNull(),
  confidence: decimal("confidence", { precision: 10, scale: 8 }).notNull(),
  derivationPath: uuid("derivation_path").array().notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
