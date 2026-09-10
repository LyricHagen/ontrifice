import { NextRequest, NextResponse } from "next/server";
import { eq, or, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError, AppError, DatabaseError } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    let market;
    try {
      [market] = await db
        .select()
        .from(schema.markets)
        .where(eq(schema.markets.id, id))
        .limit(1);
    } catch (error) {
      throw DatabaseError("select", "markets", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    if (!market) {
      throw new AppError(
        "ERR_MARKET_NOT_FOUND",
        404,
        `Market with id "${id}" was not found. It may have been removed or the id may be incorrect. Check the id and try again.`,
        { id },
      );
    }

    let edges;
    try {
      edges = await db
        .select()
        .from(schema.edges)
        .where(
          or(
            eq(schema.edges.sourceMarketId, id),
            eq(schema.edges.targetMarketId, id),
          ),
        );
    } catch (error) {
      throw DatabaseError("select", "edges", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    const neighborIds = new Set<string>();
    for (const edge of edges) {
      if (edge.sourceMarketId !== id) neighborIds.add(edge.sourceMarketId);
      if (edge.targetMarketId !== id) neighborIds.add(edge.targetMarketId);
    }

    const idsArray = Array.from(neighborIds);
    let connectedMarkets: Array<{
      id: string;
      title: string;
      platform: string;
      currentProbability: string | null;
    }> = [];

    if (idsArray.length > 0) {
      try {
        connectedMarkets = await db
          .select({
            id: schema.markets.id,
            title: schema.markets.title,
            platform: schema.markets.platform,
            currentProbability: schema.markets.currentProbability,
          })
          .from(schema.markets)
          .where(inArray(schema.markets.id, idsArray));
      } catch (error) {
        throw DatabaseError("select", "markets", {
          originalError: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({ market, edges, connectedMarkets });
  } catch (error) {
    return handleApiError(error);
  }
}
