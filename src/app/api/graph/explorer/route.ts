import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql, ilike, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError, ValidationError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const search = params.get("search");
    const platform = params.get("platform");
    const category = params.get("category");
    const edgeType = params.get("edge_type") as
      | "semantic"
      | "temporal"
      | "structural"
      | "composite"
      | null;
    const minWeight = params.get("min_weight");

    const marketConditions = [];
    if (platform) {
      const platforms = platform.split(",") as Array<"polymarket" | "kalshi" | "limitless">;
      if (platforms.length === 1) {
        marketConditions.push(eq(schema.markets.platform, platforms[0]));
      } else {
        marketConditions.push(inArray(schema.markets.platform, platforms));
      }
    }
    if (category) {
      const categories = category.split(",");
      if (categories.length === 1) {
        marketConditions.push(eq(schema.markets.category, categories[0]));
      } else {
        marketConditions.push(inArray(schema.markets.category, categories));
      }
    }
    if (search) {
      marketConditions.push(ilike(schema.markets.title, `%${search}%`));
    }

    const marketWhere =
      marketConditions.length > 0 ? and(...marketConditions) : undefined;

    const markets = await db
      .select({
        id: schema.markets.id,
        platform: schema.markets.platform,
        platformMarketId: schema.markets.platformMarketId,
        title: schema.markets.title,
        category: schema.markets.category,
        currentProbability: schema.markets.currentProbability,
        volumeUsd: schema.markets.volumeUsd,
        status: schema.markets.status,
        metadata: schema.markets.metadata,
      })
      .from(schema.markets)
      .where(marketWhere);

    const marketIds = markets.map((m) => m.id);

    if (marketIds.length === 0) {
      return NextResponse.json({ markets: [], edges: [] });
    }

    const edgeConditions = [
      and(
        inArray(schema.edges.sourceMarketId, marketIds),
        inArray(schema.edges.targetMarketId, marketIds),
      )!,
    ];
    if (edgeType) {
      const valid = ["semantic", "temporal", "structural", "composite"];
      if (!valid.includes(edgeType)) {
        throw ValidationError(
          "edge_type",
          `must be one of: ${valid.join(", ")}`,
        );
      }
      edgeConditions.push(eq(schema.edges.edgeType, edgeType));
    }
    if (minWeight) {
      const w = parseFloat(minWeight);
      if (isNaN(w) || w < 0 || w > 1) {
        throw ValidationError(
          "min_weight",
          "must be a number between 0 and 1",
        );
      }
      edgeConditions.push(
        sql`${schema.edges.weight}::numeric >= ${w}`,
      );
    }

    const edges = await db
      .select({
        id: schema.edges.id,
        sourceMarketId: schema.edges.sourceMarketId,
        targetMarketId: schema.edges.targetMarketId,
        edgeType: schema.edges.edgeType,
        weight: schema.edges.weight,
        direction: schema.edges.direction,
      })
      .from(schema.edges)
      .where(and(...edgeConditions));

    return NextResponse.json({
      markets,
      edges,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
