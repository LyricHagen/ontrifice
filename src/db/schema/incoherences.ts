import {
  pgTable,
  uuid,
  decimal,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import {
  violationTypeEnum,
  detectionClassEnum,
  alertStatusEnum,
} from "./enums";

export const incoherences = pgTable("incoherences", {
  id: uuid("id").primaryKey().defaultRandom(),
  involvedMarketIds: uuid("involved_market_ids").array().notNull(),
  violationType: violationTypeEnum("violation_type").notNull(),
  detectionClass: detectionClassEnum("detection_class").notNull(),
  severity: decimal("severity", { precision: 10, scale: 8 }).notNull(),
  description: text("description").notNull(),
  impliedArbitrage: jsonb("implied_arbitrage").$type<Record<string, unknown>>(),
  detectedAt: timestamp("detected_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  status: alertStatusEnum("status").notNull().default("active"),
});
