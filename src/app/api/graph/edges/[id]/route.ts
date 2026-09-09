import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError, AppError } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [edge] = await db
      .select()
      .from(schema.edges)
      .where(eq(schema.edges.id, id))
      .limit(1);

    if (!edge) {
      throw new AppError(
        "ERR_EDGE_NOT_FOUND",
        404,
        `Edge with id "${id}" was not found. It may have been removed or the id may be incorrect. Check the id and try again.`,
        { id },
      );
    }

    const [sourceMarket] = await db
      .select({
        id: schema.markets.id,
        title: schema.markets.title,
        platform: schema.markets.platform,
        currentProbability: schema.markets.currentProbability,
      })
      .from(schema.markets)
      .where(eq(schema.markets.id, edge.sourceMarketId))
      .limit(1);

    const [targetMarket] = await db
      .select({
        id: schema.markets.id,
        title: schema.markets.title,
        platform: schema.markets.platform,
        currentProbability: schema.markets.currentProbability,
      })
      .from(schema.markets)
      .where(eq(schema.markets.id, edge.targetMarketId))
      .limit(1);

    return NextResponse.json({
      edge,
      sourceMarket: sourceMarket ?? null,
      targetMarket: targetMarket ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
