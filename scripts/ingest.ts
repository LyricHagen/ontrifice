import "dotenv/config";

if (!process.env.DATABASE_URL && !process.env.DATABASE_POSTGRES_URL && !process.env.POSTGRES_URL) {
  console.error("ERROR: No database connection string found.");
  console.error("Set DATABASE_URL, DATABASE_POSTGRES_URL, or POSTGRES_URL.");
  console.error("");
  console.error("Usage:");
  console.error('  DATABASE_URL="postgresql://..." npx tsx scripts/ingest.ts');
  process.exit(1);
}

async function main() {
  const { runIngestion } = await import("@/lib/ingestion/coordinator");

  console.log("starting ingestion...\n");
  const summary = await runIngestion();

  console.log("--- ingestion summary ---");
  console.log(`markets processed: ${summary.marketsProcessed}`);
  console.log(`markets created:   ${summary.marketsCreated}`);
  console.log(`markets updated:   ${summary.marketsUpdated}`);
  console.log(`snapshots:         ${summary.snapshotsRecorded}`);

  if (summary.errors.length > 0) {
    console.log(`\nerrors (${summary.errors.length}):`);
    for (const err of summary.errors) {
      console.log(`  ${err.platform}: ${err.message} (${err.code})`);
    }
  } else {
    console.log("\nno errors");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("ingestion failed:", err);
  process.exit(1);
});
