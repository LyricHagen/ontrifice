import { NextRequest, NextResponse } from "next/server";
import { eq, desc, asc, and, count, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError, ValidationError } from "@/lib/errors";

const VALID_SORTS = ["detected_at", "trigger_delta"] as const;
const VALID_STATUSES = ["active", "resolved", "expired"] as const;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const sort = params.get("sort") ?? "detected_at";
    const order = params.get("order") ?? "desc";
    const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      Math.max(1, parseInt(params.get("limit") ?? "20", 10)),
      100,
    );

    if (
      !VALID_SORTS.includes(sort as (typeof VALID_SORTS)[number])
    ) {
      throw ValidationError(
        "sort",
        `must be one of: ${VALID_SORTS.join(", ")}`,
      );
    }
    if (
      status &&
      !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])
    ) {
      throw ValidationError(
        "status",
        `must be one of: ${VALID_STATUSES.join(", ")}`,
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
    const orderFn = order === "asc" ? asc : desc;
    const sortColumn =
      sort === "trigger_delta"
        ? schema.cascadeAlerts.triggerDelta
        : schema.cascadeAlerts.detectedAt;

    const [alerts, totalResult] = await Promise.all([
      db
        .select()
        .from(schema.cascadeAlerts)
        .where(where)
        .orderBy(orderFn(sortColumn))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: count() })
        .from(schema.cascadeAlerts)
        .where(where),
    ]);

    const allMarketIds = new Set<string>();
    for (const alert of alerts) {
      allMarketIds.add(alert.triggerMarketId);
      for (const id of alert.expectedMarketIds) {
        allMarketIds.add(id);
      }
    }

    const marketMap = new Map<
      string,
      {
        id: string;
        title: string;
        platform: string;
        currentProbability: string | null;
      }
    >();

    if (allMarketIds.size > 0) {
      const marketsData = await db
        .select({
          id: schema.markets.id,
          title: schema.markets.title,
          platform: schema.markets.platform,
          currentProbability: schema.markets.currentProbability,
        })
        .from(schema.markets)
        .where(inArray(schema.markets.id, [...allMarketIds]));

      for (const m of marketsData) {
        marketMap.set(m.id, m);
      }
    }

    const enriched = alerts.map((alert) => {
      const deltas = alert.expectedDeltas as Record<string, number>;
      return {
        ...alert,
        triggerMarket: marketMap.get(alert.triggerMarketId) ?? null,
        expectedMarkets: alert.expectedMarketIds.map((id) => ({
          ...(marketMap.get(id) ?? {
            id,
            title: "Unknown market",
            platform: "unknown",
            currentProbability: null,
          }),
          expectedDelta: deltas[id] ?? null,
        })),
      };
    });

    return NextResponse.json({
      cascades: enriched,
      total: totalResult[0].count,
      page,
      limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
