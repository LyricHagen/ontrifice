import {
  pgTable,
  uuid,
  text,
  decimal,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { positionSideEnum } from "./enums";
import { users } from "./users";
import { markets } from "./markets";

export const portfolios = pgTable("portfolios", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id),
    side: positionSideEnum("side").notNull(),
    size: decimal("size", { precision: 18, scale: 8 }).notNull(),
    avgPrice: decimal("avg_price", { precision: 10, scale: 8 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("positions_portfolio_idx").on(table.portfolioId),
    index("positions_market_idx").on(table.marketId),
  ],
);

export const collateralAnalyses = pgTable(
  "collateral_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    naiveCollateral: decimal("naive_collateral", {
      precision: 18,
      scale: 8,
    }).notNull(),
    optimizedCollateral: decimal("optimized_collateral", {
      precision: 18,
      scale: 8,
    }).notNull(),
    savings: decimal("savings", { precision: 18, scale: 8 }).notNull(),
    savingsPct: decimal("savings_pct", { precision: 10, scale: 4 }).notNull(),
    constraintCount: integer("constraint_count").notNull(),
    bindingConstraints: jsonb("binding_constraints")
      .notNull()
      .$type<BindingConstraint[]>(),
    worstCaseScenario: jsonb("worst_case_scenario")
      .notNull()
      .$type<WorstCaseScenario>(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("collateral_analyses_portfolio_idx").on(table.portfolioId),
  ],
);

interface BindingConstraint {
  marketIdA: string;
  marketIdB: string;
  relationshipType: string;
  collateralSaved: number;
}

interface WorstCaseScenario {
  resolutions: Record<string, boolean>;
  positionPnls: Record<string, number>;
  totalLoss: number;
}
