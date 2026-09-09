DO $$ BEGIN
  CREATE TYPE "public"."resolution_match_status" AS ENUM('verified_equivalent', 'likely_equivalent', 'unverified', 'divergent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "markets" ADD COLUMN IF NOT EXISTS "resolution_rules" text;

ALTER TABLE "edges" ADD COLUMN IF NOT EXISTS "resolution_match_status" "resolution_match_status";
