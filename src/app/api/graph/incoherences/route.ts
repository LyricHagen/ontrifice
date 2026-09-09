import { NextRequest, NextResponse } from "next/server";
import { eq, desc, asc, and, count, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError, ValidationError } from "@/lib/errors";

const VALID_SORTS = ["severity", "detected_at", "market_count"] as const;
const VALID_STATUSES = ["active", "resolved", "expired"] as const;
const VALID_VIOLATION_TYPES = [
  "probability_sum",
  "probability_divergence",
  "mutual_exclusion",
  "implication_violation",
] as const;
const VALID_DETECTION_CLASSES = ["contradiction", "divergence"] as const;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const violationType = params.get("violation_type");
    const detectionClass = params.get("detection_class");
    const sort = params.get("sort") ?? "severity";
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
    if (
      violationType &&
      !VALID_VIOLATION_TYPES.includes(
        violationType as (typeof VALID_VIOLATION_TYPES)[number],
      )
    ) {
      throw ValidationError(
        "violation_type",
        `must be one of: ${VALID_VIOLATION_TYPES.join(", ")}`,
      );
    }
    if (
      detectionClass &&
      !VALID_DETECTION_CLASSES.includes(
        detectionClass as (typeof VALID_DETECTION_CLASSES)[number],
      )
    ) {
      throw ValidationError(
        "detection_class",
        `must be one of: ${VALID_DETECTION_CLASSES.join(", ")}`,
      );
    }

    const conditions = [];
    if (status) {
      conditions.push(
        eq(
          schema.incoherences.status,
          status as "active" | "resolved" | "expired",
        ),
      );
    }
    if (violationType) {
      conditions.push(
        eq(
          schema.incoherences.violationType,
          violationType as
            | "probability_sum"
            | "probability_divergence"
            | "mutual_exclusion"
            | "implication_violation",
        ),
      );
    }
    if (detectionClass) {
      conditions.push(
        eq(
          schema.incoherences.detectionClass,
          detectionClass as "contradiction" | "divergence",
        ),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderFn = order === "asc" ? asc : desc;

    let orderBy;
    if (sort === "market_count") {
      orderBy = orderFn(
        sql`array_length(${schema.incoherences.involvedMarketIds}, 1)`,
      );
    } else if (sort === "severity") {
      orderBy = orderFn(schema.incoherences.severity);
    } else {
      orderBy = orderFn(schema.incoherences.detectedAt);
    }

    const [incoherences, totalResult] = await Promise.all([
      db
        .select()
        .from(schema.incoherences)
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: count() })
        .from(schema.incoherences)
        .where(where),
    ]);

    const allMarketIds = [
      ...new Set(incoherences.flatMap((i) => i.involvedMarketIds)),
    ];
    const marketMap = new Map<
      string,
      {
        id: string;
        title: string;
        platform: string;
        currentProbability: string | null;
      }
    >();

    if (allMarketIds.length > 0) {
      const marketsData = await db
        .select({
          id: schema.markets.id,
          title: schema.markets.title,
          platform: schema.markets.platform,
          currentProbability: schema.markets.currentProbability,
        })
        .from(schema.markets)
        .where(inArray(schema.markets.id, allMarketIds));

      for (const m of marketsData) {
        marketMap.set(m.id, m);
      }
    }

    const enriched = incoherences.map((inc) => ({
      ...inc,
      involvedMarkets: inc.involvedMarketIds.map(
        (id) =>
          marketMap.get(id) ?? {
            id,
            title: "Unknown market",
            platform: "unknown",
            currentProbability: null,
          },
      ),
    }));

    return NextResponse.json({
      incoherences: enriched,
      total: totalResult[0].count,
      page,
      limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
