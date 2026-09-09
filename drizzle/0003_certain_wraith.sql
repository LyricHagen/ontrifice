CREATE TYPE "public"."detection_class" AS ENUM('contradiction', 'divergence');--> statement-breakpoint
ALTER TABLE "incoherences" ALTER COLUMN "violation_type" SET DATA TYPE text;--> statement-breakpoint
UPDATE "incoherences" SET "violation_type" = 'probability_divergence' WHERE "violation_type" = 'conditional_contradiction';--> statement-breakpoint
DELETE FROM "incoherences" WHERE "violation_type" = 'implication_violation' AND "description" LIKE 'Transitive inconsistency%';--> statement-breakpoint
DROP TYPE "public"."violation_type";--> statement-breakpoint
CREATE TYPE "public"."violation_type" AS ENUM('probability_sum', 'probability_divergence', 'mutual_exclusion', 'implication_violation');--> statement-breakpoint
ALTER TABLE "incoherences" ALTER COLUMN "violation_type" SET DATA TYPE "public"."violation_type" USING "violation_type"::"public"."violation_type";--> statement-breakpoint
ALTER TABLE "incoherences" ADD COLUMN "detection_class" "detection_class";--> statement-breakpoint
UPDATE "incoherences" SET "detection_class" = 'contradiction' WHERE "violation_type" IN ('probability_sum', 'mutual_exclusion', 'implication_violation');--> statement-breakpoint
UPDATE "incoherences" SET "detection_class" = 'divergence' WHERE "violation_type" = 'probability_divergence';--> statement-breakpoint
ALTER TABLE "incoherences" ALTER COLUMN "detection_class" SET NOT NULL;
