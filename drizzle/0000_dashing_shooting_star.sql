CREATE TYPE "public"."alert_status" AS ENUM('active', 'resolved', 'expired');--> statement-breakpoint
CREATE TYPE "public"."edge_direction" AS ENUM('bidirectional', 'source_leads', 'target_leads');--> statement-breakpoint
CREATE TYPE "public"."edge_type" AS ENUM('semantic', 'temporal', 'structural', 'composite');--> statement-breakpoint
CREATE TYPE "public"."market_status" AS ENUM('active', 'resolved', 'voided');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('polymarket', 'kalshi', 'limitless');--> statement-breakpoint
CREATE TYPE "public"."resolution" AS ENUM('yes', 'no', 'unresolved');--> statement-breakpoint
CREATE TYPE "public"."violation_type" AS ENUM('probability_sum', 'conditional_contradiction', 'mutual_exclusion', 'implication_violation');--> statement-breakpoint
CREATE TABLE "markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "platform" NOT NULL,
	"platform_market_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text,
	"current_probability" numeric(10, 8),
	"volume_usd" numeric(18, 2),
	"status" "market_status" DEFAULT 'active' NOT NULL,
	"resolution" "resolution",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "market_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"market_id" uuid NOT NULL,
	"probability" numeric(10, 8) NOT NULL,
	"volume_usd" numeric(18, 2) NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_market_id" uuid NOT NULL,
	"target_market_id" uuid NOT NULL,
	"edge_type" "edge_type" NOT NULL,
	"weight" numeric(10, 8) NOT NULL,
	"confidence" numeric(10, 8) NOT NULL,
	"direction" "edge_direction" DEFAULT 'bidirectional' NOT NULL,
	"evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incoherences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"involved_market_ids" uuid[] NOT NULL,
	"violation_type" "violation_type" NOT NULL,
	"severity" numeric(10, 8) NOT NULL,
	"description" text NOT NULL,
	"implied_arbitrage" jsonb,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"status" "alert_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "implied_conditionals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"condition_market_id" uuid NOT NULL,
	"target_market_id" uuid NOT NULL,
	"conditional_probability" numeric(10, 8) NOT NULL,
	"confidence" numeric(10, 8) NOT NULL,
	"derivation_path" uuid[] NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"api_key" text,
	"api_key_created_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "cascade_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger_market_id" uuid NOT NULL,
	"expected_market_ids" uuid[] NOT NULL,
	"trigger_delta" numeric(10, 8) NOT NULL,
	"expected_deltas" jsonb NOT NULL,
	"lag_window_seconds" integer NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"status" "alert_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market_snapshots" ADD CONSTRAINT "market_snapshots_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_source_market_id_markets_id_fk" FOREIGN KEY ("source_market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_target_market_id_markets_id_fk" FOREIGN KEY ("target_market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implied_conditionals" ADD CONSTRAINT "implied_conditionals_condition_market_id_markets_id_fk" FOREIGN KEY ("condition_market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implied_conditionals" ADD CONSTRAINT "implied_conditionals_target_market_id_markets_id_fk" FOREIGN KEY ("target_market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cascade_alerts" ADD CONSTRAINT "cascade_alerts_trigger_market_id_markets_id_fk" FOREIGN KEY ("trigger_market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "markets_platform_market_id_idx" ON "markets" USING btree ("platform","platform_market_id");--> statement-breakpoint
CREATE INDEX "snapshots_market_recorded_idx" ON "market_snapshots" USING btree ("market_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "edges_source_target_idx" ON "edges" USING btree ("source_market_id","target_market_id");--> statement-breakpoint
CREATE INDEX "edges_source_idx" ON "edges" USING btree ("source_market_id");--> statement-breakpoint
CREATE INDEX "edges_target_idx" ON "edges" USING btree ("target_market_id");