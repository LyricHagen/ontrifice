-- Create new relation_class enum
CREATE TYPE "public"."relation_class" AS ENUM('logical', 'statistical', 'semantic');

-- Add new columns to edges table
ALTER TABLE "edges" ADD COLUMN "relation_class" "relation_class";
ALTER TABLE "edges" ADD COLUMN "relation_type" text;
ALTER TABLE "edges" ADD COLUMN "mathematical_semantics" text;
ALTER TABLE "edges" ADD COLUMN "model_version" text;
ALTER TABLE "edges" ADD COLUMN "algorithm_params" jsonb;
ALTER TABLE "edges" ADD COLUMN "observed_at" timestamp with time zone DEFAULT now();
ALTER TABLE "edges" ADD COLUMN "valid_until" timestamp with time zone;
ALTER TABLE "edges" ADD COLUMN "sample_size" integer;

-- Migrate data from old edge_type to new relation_class + relation_type
UPDATE "edges" SET
  "relation_class" = 'semantic',
  "relation_type" = 'same_topic',
  "model_version" = 'migrated-from-v0'
WHERE "edge_type" = 'semantic';

UPDATE "edges" SET
  "relation_class" = 'statistical',
  "relation_type" = 'correlation',
  "model_version" = 'migrated-from-v0'
WHERE "edge_type" = 'temporal';

UPDATE "edges" SET
  "relation_class" = 'logical',
  "relation_type" = 'mutually_exclusive',
  "model_version" = 'migrated-from-v0'
WHERE "edge_type" = 'structural';

-- For composite edges, pick the highest-priority class based on evidence
-- Structural/logical takes precedence, then temporal/statistical, then semantic
UPDATE "edges" SET
  "relation_class" = CASE
    WHEN "evidence"::jsonb ? 'structural' THEN 'logical'
    WHEN "evidence"::jsonb ? 'temporal' THEN 'statistical'
    ELSE 'semantic'
  END,
  "relation_type" = CASE
    WHEN "evidence"::jsonb ? 'structural' THEN 'mutually_exclusive'
    WHEN "evidence"::jsonb ? 'temporal' THEN 'correlation'
    ELSE 'same_topic'
  END,
  "model_version" = 'migrated-from-v0-composite'
WHERE "edge_type" = 'composite';

-- Set observed_at for existing rows
UPDATE "edges" SET "observed_at" = "created_at" WHERE "observed_at" IS NULL;

-- Now make the new columns NOT NULL
ALTER TABLE "edges" ALTER COLUMN "relation_class" SET NOT NULL;
ALTER TABLE "edges" ALTER COLUMN "relation_type" SET NOT NULL;
ALTER TABLE "edges" ALTER COLUMN "observed_at" SET NOT NULL;
ALTER TABLE "edges" ALTER COLUMN "observed_at" SET DEFAULT now();

-- Rename weight to score
ALTER TABLE "edges" RENAME COLUMN "weight" TO "score";

-- Drop the old unique index (source_market_id, target_market_id)
-- since we now allow multiple edges between the same pair
DROP INDEX IF EXISTS "edges_source_target_idx";

-- Drop old edge_type column and enum
ALTER TABLE "edges" DROP COLUMN "edge_type";
DROP TYPE IF EXISTS "public"."edge_type";

-- Create new indexes
CREATE INDEX IF NOT EXISTS "edges_relation_class_idx" ON "edges" ("relation_class");
CREATE INDEX IF NOT EXISTS "edges_relation_type_idx" ON "edges" ("relation_type");
CREATE INDEX IF NOT EXISTS "edges_source_target_class_idx" ON "edges" ("source_market_id", "target_market_id", "relation_class");
