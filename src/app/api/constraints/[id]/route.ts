import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError, DatabaseError, AppError } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    let edge;
    try {
      const [result] = await db
        .select()
        .from(schema.edges)
        .where(eq(schema.edges.id, id))
        .limit(1);
      edge = result;
    } catch (error) {
      throw DatabaseError("select", "edges", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    if (!edge) {
      throw new AppError(
        "ERR_NOT_FOUND",
        404,
        "Constraint not found. The relationship may have been removed or the ID is incorrect. Check the constraints list for valid IDs.",
      );
    }

    const marketIds = [edge.sourceMarketId, edge.targetMarketId];
    let marketsData;
    try {
      marketsData = await db
        .select()
        .from(schema.markets)
        .where(inArray(schema.markets.id, marketIds));
    } catch (error) {
      throw DatabaseError("select", "markets", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    const marketMap = new Map<string, (typeof marketsData)[0]>();
    for (const m of marketsData) {
      marketMap.set(m.id, m);
    }

    return NextResponse.json({
      id: edge.id,
      market_a: marketMap.get(edge.sourceMarketId) ?? null,
      market_b: marketMap.get(edge.targetMarketId) ?? null,
      relation_class: edge.relationClass,
      relation_type: edge.relationType,
      confidence: edge.confidence,
      score: edge.score,
      direction: edge.direction,
      mathematical_semantics: edge.mathematicalSemantics,
      evidence: edge.evidence,
      detected_at: edge.observedAt,
      valid_until: edge.validUntil,
      model_version: edge.modelVersion,
      algorithm_params: edge.algorithmParams,
      sample_size: edge.sampleSize,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
