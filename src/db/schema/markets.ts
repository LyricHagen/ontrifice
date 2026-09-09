import {
  pgTable,
  uuid,
  text,
  decimal,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { platformEnum, marketStatusEnum, resolutionEnum } from "./enums";

export const markets = pgTable(
  "markets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platform: platformEnum("platform").notNull(),
    platformMarketId: text("platform_market_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category"),
    currentProbability: decimal("current_probability", {
      precision: 10,
      scale: 8,
    }),
    volumeUsd: decimal("volume_usd", { precision: 18, scale: 2 }),
    status: marketStatusEnum("status").notNull().default("active"),
    resolution: resolutionEnum("resolution"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (table) => [
    uniqueIndex("markets_platform_market_id_idx").on(
      table.platform,
      table.platformMarketId,
    ),
  ],
);
