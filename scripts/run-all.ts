import "dotenv/config";

if (!process.env.DATABASE_URL && !process.env.DATABASE_POSTGRES_URL && !process.env.POSTGRES_URL) {
  console.error("ERROR: No database connection string found.");
  console.error("Set DATABASE_URL, DATABASE_POSTGRES_URL, or POSTGRES_URL.");
  console.error("");
  console.error("Usage:");
  console.error('  DATABASE_URL="postgresql://..." npx tsx scripts/run-all.ts');
  process.exit(1);
}

async function main() {
  const { runIngestion } = await import("@/lib/ingestion/coordinator");
  const { runFullPipeline } = await import("@/lib/engine/orchestrator");

  console.log("=== phase 1: ingestion ===\n");
  const ingestion = await runIngestion();

  console.log("--- ingestion summary ---");
  console.log(`markets processed: ${ingestion.marketsProcessed}`);
  console.log(`markets created:   ${ingestion.marketsCreated}`);
  console.log(`markets updated:   ${ingestion.marketsUpdated}`);
  console.log(`snapshots:         ${ingestion.snapshotsRecorded}`);
  if (ingestion.errors.length > 0) {
    console.log(`errors (${ingestion.errors.length}):`);
    for (const err of ingestion.errors) {
      console.log(`  ${err.platform}: ${err.message} (${err.code})`);
    }
  }

  console.log("\n=== phase 2: graph computation ===\n");
  const compute = await runFullPipeline();

  console.log("--- compute summary ---");
  console.log(`duration:           ${compute.durationMs}ms`);
  console.log(`semantic edges:     ${compute.steps.semantic.edges}`);
  console.log(`structural edges:   ${compute.steps.structural.edges}`);
  console.log(`temporal edges:     ${compute.steps.temporal.edges}`);
  console.log(`graph created:      ${compute.steps.graph.created}`);
  console.log(`graph updated:      ${compute.steps.graph.updated}`);
  console.log(`incoherences:       ${compute.steps.incoherences.detected}`);
  console.log(`cascade alerts:     ${compute.steps.cascades.alertsCreated}`);
  console.log(`cascades resolved:  ${compute.steps.cascades.alertsResolved}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("pipeline failed:", err);
  process.exit(1);
});
