import { NextRequest, NextResponse } from "next/server";
import { eq, ilike, desc, asc, and, count } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError, ValidationError } from "@/lib/errors";

const VALID_SORT_FIELDS = ["volume", "probability", "updated_at"] as const;
const VALID_ORDER = ["asc", "desc"] as const;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const platform = params.get("platform");
    const category = params.get("category");
    const status = params.get("status");
    const search = params.get("search");
    const sortParam = params.get("sort") ?? "updated_at";
    const orderParam = params.get("order") ?? "desc";
    const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(params.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    );

    if (!VALID_SORT_FIELDS.includes(sortParam as (typeof VALID_SORT_FIELDS)[number])) {
      throw ValidationError("sort", `must be one of: ${VALID_SORT_FIELDS.join(", ")}`);
    }
    if (!VALID_ORDER.includes(orderParam as (typeof VALID_ORDER)[number])) {
      throw ValidationError("order", "must be 'asc' or 'desc'");
    }

    const conditions = [];
    if (platform) {
      conditions.push(eq(schema.markets.platform, platform as "polymarket" | "kalshi" | "limitless"));
    }
    if (category) {
      conditions.push(eq(schema.markets.category, category));
    }
    if (status) {
      conditions.push(eq(schema.markets.status, status as "active" | "resolved" | "voided"));
    }
    if (search) {
      const escaped = search.replace(/[%_\\]/g, "\\$&");
      conditions.push(ilike(schema.markets.title, `%${escaped}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortColumns = {
      volume: schema.markets.volumeUsd,
      probability: schema.markets.currentProbability,
      updated_at: schema.markets.updatedAt,
    } as const;
    const sortColumn = sortColumns[sortParam as keyof typeof sortColumns];

    const orderFn = orderParam === "asc" ? asc : desc;

    const [markets, totalResult] = await Promise.all([
      db
        .select()
        .from(schema.markets)
        .where(where)
        .orderBy(orderFn(sortColumn))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: count() })
        .from(schema.markets)
        .where(where),
    ]);

    return NextResponse.json({
      markets,
      total: totalResult[0].count,
      page,
      limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
