import { NextResponse } from "next/server";
import { count, eq, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError, DatabaseError } from "@/lib/errors";

export async function GET() {
  try {
    let marketsResult;
    let edgesResult;
    let incoherencesResult;
    try {
      [marketsResult, edgesResult, incoherencesResult] = await Promise.all([
        db.select({ count: count() }).from(schema.markets),
        db.select({ count: count() }).from(schema.edges),
        db
          .select({ count: count() })
          .from(schema.incoherences)
          .where(eq(schema.incoherences.status, "active")),
      ]);
    } catch (error) {
      throw DatabaseError("count", "stats", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    const marketsCount = marketsResult[0]?.count ?? 0;
    const edgesCount = edgesResult[0]?.count ?? 0;
    const activeIncoherences = incoherencesResult[0]?.count ?? 0;

    let lastComputedAt: string | null = null;
    if (edgesCount > 0) {
      try {
        const [latest] = await db
          .select({ updatedAt: schema.edges.updatedAt })
          .from(schema.edges)
          .orderBy(desc(schema.edges.updatedAt))
          .limit(1);
        lastComputedAt = latest?.updatedAt?.toISOString() ?? null;
      } catch {
        lastComputedAt = null;
      }
    }

    return NextResponse.json({
      marketsCount,
      edgesCount,
      activeIncoherences,
      lastComputedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
