-- Migrate composite edges by splitting them into separate edges based on evidence jsonb.
-- Run AFTER the main migration (0001_edge_taxonomy_provenance.sql) has been applied.
-- This script handles edges that were tagged 'composite' and had multiple evidence keys.
--
-- The main migration already mapped composite edges to a single relation based on priority.
-- This script creates additional edges for any secondary evidence that was lost.

-- For each migrated-composite edge that has multiple evidence keys, create additional edges.
-- Only run this if you have composite edges that contained multiple evidence types.

-- Insert semantic edges from composite evidence
INSERT INTO "edges" (
  "source_market_id", "target_market_id", "relation_class", "relation_type",
  "score", "confidence", "direction", "evidence", "model_version",
  "observed_at", "created_at", "updated_at"
)
SELECT
  e."source_market_id", e."target_market_id",
  'semantic', 'same_topic',
  e."score", e."confidence", e."direction",
  e."evidence"->'semantic', 'migrated-from-v0-composite-split',
  e."observed_at", e."created_at", now()
FROM "edges" e
WHERE e."model_version" = 'migrated-from-v0-composite'
  AND e."relation_class" != 'semantic'
  AND e."evidence"::jsonb ? 'semantic';

-- Insert statistical edges from composite evidence
INSERT INTO "edges" (
  "source_market_id", "target_market_id", "relation_class", "relation_type",
  "score", "confidence", "direction", "evidence", "model_version",
  "observed_at", "created_at", "updated_at"
)
SELECT
  e."source_market_id", e."target_market_id",
  'statistical', 'correlation',
  e."score", e."confidence", e."direction",
  e."evidence"->'temporal', 'migrated-from-v0-composite-split',
  e."observed_at", e."created_at", now()
FROM "edges" e
WHERE e."model_version" = 'migrated-from-v0-composite'
  AND e."relation_class" != 'statistical'
  AND e."evidence"::jsonb ? 'temporal';

-- Insert logical edges from composite evidence
INSERT INTO "edges" (
  "source_market_id", "target_market_id", "relation_class", "relation_type",
  "score", "confidence", "direction", "evidence", "model_version",
  "observed_at", "created_at", "updated_at"
)
SELECT
  e."source_market_id", e."target_market_id",
  'logical', 'mutually_exclusive',
  e."score", e."confidence", e."direction",
  e."evidence"->'structural', 'migrated-from-v0-composite-split',
  e."observed_at", e."created_at", now()
FROM "edges" e
WHERE e."model_version" = 'migrated-from-v0-composite'
  AND e."relation_class" != 'logical'
  AND e."evidence"::jsonb ? 'structural';
