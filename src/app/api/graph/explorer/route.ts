import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql, ilike, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError, ValidationError, DatabaseError } from "@/lib/errors";

const VALID_CLASSES = ["logical", "statistical", "semantic"] as const;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const search = params.get("search");
    const platform = params.get("platform");
    const category = params.get("category");
    const relationClass = params.get("relation_class") as
      | "logical"
      | "statistical"
      | "semantic"
      | null;
    const relationType = params.get("relation_type");
    const minScore = params.get("min_score");

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
      const escaped = search.replace(/[%_\\]/g, "\\$&");
      marketConditions.push(ilike(schema.markets.title, `%${escaped}%`));
    }

    const marketWhere =
      marketConditions.length > 0 ? and(...marketConditions) : undefined;

    let markets;
    try {
      markets = await db
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
    } catch (error) {
      throw DatabaseError("select", "markets", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

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
    if (relationClass) {
      if (!VALID_CLASSES.includes(relationClass)) {
        throw ValidationError(
          "relation_class",
          `must be one of: ${VALID_CLASSES.join(", ")}`,
        );
      }
      edgeConditions.push(eq(schema.edges.relationClass, relationClass));
    }
    if (relationType) {
      edgeConditions.push(eq(schema.edges.relationType, relationType));
    }
    if (minScore) {
      const s = parseFloat(minScore);
      if (isNaN(s) || s < -1 || s > 1) {
        throw ValidationError(
          "min_score",
          "must be a number between -1 and 1",
        );
      }
      edgeConditions.push(
        sql`${schema.edges.score}::numeric >= ${s}`,
      );
    }

    let edges;
    try {
      edges = await db
        .select({
          id: schema.edges.id,
          sourceMarketId: schema.edges.sourceMarketId,
          targetMarketId: schema.edges.targetMarketId,
          relationClass: schema.edges.relationClass,
          relationType: schema.edges.relationType,
          score: schema.edges.score,
          confidence: schema.edges.confidence,
          direction: schema.edges.direction,
          mathematicalSemantics: schema.edges.mathematicalSemantics,
          modelVersion: schema.edges.modelVersion,
          sampleSize: schema.edges.sampleSize,
          resolutionMatchStatus: schema.edges.resolutionMatchStatus,
        })
        .from(schema.edges)
        .where(and(...edgeConditions));
    } catch (error) {
      throw DatabaseError("select", "edges", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    return NextResponse.json({
      markets,
      edges,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
