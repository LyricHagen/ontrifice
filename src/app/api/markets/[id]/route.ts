import { NextRequest, NextResponse } from "next/server";
import { eq, or, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError, AppError } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [market] = await db
      .select()
      .from(schema.markets)
      .where(eq(schema.markets.id, id))
      .limit(1);

    if (!market) {
      throw new AppError(
        "ERR_MARKET_NOT_FOUND",
        404,
        `Market with id "${id}" was not found. It may have been removed or the id may be incorrect. Check the id and try again.`,
        { id },
      );
    }

    const edges = await db
      .select()
      .from(schema.edges)
      .where(
        or(
          eq(schema.edges.sourceMarketId, id),
          eq(schema.edges.targetMarketId, id),
        ),
      );

    const neighborIds = new Set<string>();
    for (const edge of edges) {
      if (edge.sourceMarketId !== id) neighborIds.add(edge.sourceMarketId);
      if (edge.targetMarketId !== id) neighborIds.add(edge.targetMarketId);
    }

    const idsArray = Array.from(neighborIds);
    const connectedMarkets =
      idsArray.length > 0
        ? await db
            .select({
              id: schema.markets.id,
              title: schema.markets.title,
              platform: schema.markets.platform,
              currentProbability: schema.markets.currentProbability,
            })
            .from(schema.markets)
            .where(inArray(schema.markets.id, idsArray))
        : [];

    return NextResponse.json({ market, edges, connectedMarkets });
  } catch (error) {
    return handleApiError(error);
  }
}
