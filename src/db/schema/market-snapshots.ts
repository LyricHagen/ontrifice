import {
  pgTable,
  bigserial,
  uuid,
  decimal,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { markets } from "./markets";

export const marketSnapshots = pgTable(
  "market_snapshots",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    probability: decimal("probability", { precision: 10, scale: 8 }).notNull(),
    volumeUsd: decimal("volume_usd", { precision: 18, scale: 2 }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("snapshots_market_recorded_idx").on(
      table.marketId,
      table.recordedAt,
    ),
  ],
);
