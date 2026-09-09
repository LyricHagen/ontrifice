import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError, ValidationError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const limit = Math.min(
      Math.max(1, parseInt(params.get("limit") ?? "50", 10)),
      200,
    );

    const validStatuses = ["active", "resolved", "expired"];
    if (status && !validStatuses.includes(status)) {
      throw ValidationError(
        "status",
        `must be one of: ${validStatuses.join(", ")}`,
      );
    }

    const conditions = [];
    if (status) {
      conditions.push(
        eq(
          schema.cascadeAlerts.status,
          status as "active" | "resolved" | "expired",
        ),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const alerts = await db
      .select()
      .from(schema.cascadeAlerts)
      .where(where)
      .orderBy(desc(schema.cascadeAlerts.detectedAt))
      .limit(limit);

    const enriched = [];
    for (const alert of alerts) {
      const [triggerMarket] = await db
        .select({
          id: schema.markets.id,
          title: schema.markets.title,
          currentProbability: schema.markets.currentProbability,
        })
        .from(schema.markets)
        .where(eq(schema.markets.id, alert.triggerMarketId));

      enriched.push({
        ...alert,
        triggerMarket: triggerMarket ?? null,
      });
    }

    return NextResponse.json({
      cascades: enriched,
      count: enriched.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
