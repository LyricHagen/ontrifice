import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError } from "@/lib/errors";

export async function GET() {
  try {
    const [marketsResult, edgesResult, incoherencesResult] = await Promise.all([
      db.select({ count: count() }).from(schema.markets),
      db.select({ count: count() }).from(schema.edges),
      db
        .select({ count: count() })
        .from(schema.incoherences)
        .where(eq(schema.incoherences.status, "active")),
    ]);

    return NextResponse.json({
      marketsCount: marketsResult[0].count,
      edgesCount: edgesResult[0].count,
      activeIncoherences: incoherencesResult[0].count,
      lastComputedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
