import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const ingestionState = pgTable("ingestion_state", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
