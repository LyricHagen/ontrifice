import {
  pgTable,
  uuid,
  decimal,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { alertStatusEnum } from "./enums";
import { markets } from "./markets";

export const cascadeAlerts = pgTable("cascade_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  triggerMarketId: uuid("trigger_market_id")
    .notNull()
    .references(() => markets.id, { onDelete: "cascade" }),
  expectedMarketIds: uuid("expected_market_ids").array().notNull(),
  triggerDelta: decimal("trigger_delta", {
    precision: 10,
    scale: 8,
  }).notNull(),
  expectedDeltas: jsonb("expected_deltas")
    .notNull()
    .$type<Record<string, number>>(),
  lagWindowSeconds: integer("lag_window_seconds").notNull(),
  detectedAt: timestamp("detected_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  status: alertStatusEnum("status").notNull().default("active"),
});
