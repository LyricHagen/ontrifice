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
        .select({ id: schema.markets.id, title: schema.markets.title })
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

    const marketMap = new Map<string, { id: string; title: string; platform: string }>();
    marketMap.set(market.id, { ...market, platform: "" });

    if (neighborIds.size > 0) {
      try {
        const neighbors = await db
          .select({
            id: schema.markets.id,
            title: schema.markets.title,
            platform: schema.markets.platform,
          })
          .from(schema.markets)
          .where(inArray(schema.markets.id, [...neighborIds]));
        for (const m of neighbors) {
          marketMap.set(m.id, m);
        }
      } catch (error) {
        throw DatabaseError("select", "markets", {
          originalError: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const relationships = edges.map((edge) => ({
      id: edge.id,
      market_a: marketMap.get(edge.sourceMarketId) ?? { id: edge.sourceMarketId, title: "Unknown", platform: "unknown" },
      market_b: marketMap.get(edge.targetMarketId) ?? { id: edge.targetMarketId, title: "Unknown", platform: "unknown" },
      relation_class: edge.relationClass,
      relation_type: edge.relationType,
      confidence: edge.confidence,
      mathematical_semantics: edge.mathematicalSemantics,
      evidence: edge.evidence,
    }));

    return NextResponse.json({ market, relationships });
  } catch (error) {
    return handleApiError(error);
  }
}
