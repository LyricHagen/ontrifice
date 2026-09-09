CREATE TYPE "public"."confidence_basis" AS ENUM('direct_observation', 'path_inference');--> statement-breakpoint
ALTER TABLE "implied_conditionals" ADD COLUMN "confidence_basis" "confidence_basis" NOT NULL;--> statement-breakpoint
ALTER TABLE "implied_conditionals" ADD COLUMN "model_version" text NOT NULL;--> statement-breakpoint
ALTER TABLE "implied_conditionals" ADD COLUMN "assumptions" text NOT NULL;