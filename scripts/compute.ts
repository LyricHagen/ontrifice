import "dotenv/config";

if (!process.env.DATABASE_URL && !process.env.DATABASE_POSTGRES_URL && !process.env.POSTGRES_URL) {
  console.error("ERROR: No database connection string found.");
  console.error("Set DATABASE_URL, DATABASE_POSTGRES_URL, or POSTGRES_URL.");
  console.error("");
  console.error("Usage:");
  console.error('  DATABASE_URL="postgresql://..." npx tsx scripts/compute.ts');
  process.exit(1);
}

async function main() {
  const { runFullPipeline } = await import("@/lib/engine/orchestrator");

  console.log("starting graph computation...\n");
  const summary = await runFullPipeline();

  console.log("--- compute summary ---");
  console.log(`duration:           ${summary.durationMs}ms`);
  console.log(`semantic edges:     ${summary.steps.semantic.edges}`);
  console.log(`structural edges:   ${summary.steps.structural.edges}`);
  console.log(`temporal edges:     ${summary.steps.temporal.edges}`);
  console.log(`graph created:      ${summary.steps.graph.created}`);
  console.log(`graph updated:      ${summary.steps.graph.updated}`);
  console.log(`incoherences:       ${summary.steps.incoherences.detected}`);
  console.log(`cascade alerts:     ${summary.steps.cascades.alertsCreated}`);
  console.log(`cascades resolved:  ${summary.steps.cascades.alertsResolved}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("compute failed:", err);
  process.exit(1);
});
