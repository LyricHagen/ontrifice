import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, count, gte, or, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError, ValidationError, DatabaseError } from "@/lib/errors";

const VALID_TYPES = ["mutually_exclusive", "implies", "temporal_precondition"] as const;
const VALID_CLASSES = ["logical", "statistical", "semantic"] as const;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const relationType = params.get("type");
    const relationClass = params.get("class");
    const platform = params.get("platform");
    const minConfidence = params.get("min_confidence");
    const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      Math.max(1, parseInt(params.get("limit") ?? "50", 10)),
      100,
    );

    if (relationType && !VALID_TYPES.includes(relationType as (typeof VALID_TYPES)[number])) {
      throw ValidationError("type", `must be one of: ${VALID_TYPES.join(", ")}`);
    }
    if (relationClass && !VALID_CLASSES.includes(relationClass as (typeof VALID_CLASSES)[number])) {
      throw ValidationError("class", `must be one of: ${VALID_CLASSES.join(", ")}`);
    }

    const conditions = [];
    if (relationType) {
      conditions.push(eq(schema.edges.relationType, relationType));
    }
    if (relationClass) {
      conditions.push(eq(schema.edges.relationClass, relationClass as "logical" | "statistical" | "semantic"));
    }
    if (minConfidence) {
      const conf = parseFloat(minConfidence);
      if (isNaN(conf) || conf < 0 || conf > 1) {
        throw ValidationError("min_confidence", "must be a number between 0 and 1");
      }
      conditions.push(gte(schema.edges.confidence, String(conf)));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    let edges;
    let totalResult;
    try {
      [edges, totalResult] = await Promise.all([
        db
          .select()
          .from(schema.edges)
          .where(where)
          .orderBy(desc(schema.edges.confidence))
          .limit(limit)
          .offset((page - 1) * limit),
        db.select({ count: count() }).from(schema.edges).where(where),
      ]);
    } catch (error) {
      throw DatabaseError("select", "edges", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    const allMarketIds = new Set<string>();
    for (const edge of edges) {
      allMarketIds.add(edge.sourceMarketId);
      allMarketIds.add(edge.targetMarketId);
    }

    const marketMap = new Map<string, { id: string; title: string; platform: string }>();
    if (allMarketIds.size > 0) {
      try {
        const marketsData = await db
          .select({
            id: schema.markets.id,
            title: schema.markets.title,
            platform: schema.markets.platform,
          })
          .from(schema.markets)
          .where(inArray(schema.markets.id, [...allMarketIds]));
        for (const m of marketsData) {
          marketMap.set(m.id, m);
        }
      } catch (error) {
        throw DatabaseError("select", "markets", {
          originalError: error instanceof Error ? error.message : String(error),
        });
      }
    }

    let filteredEdges = edges;
    if (platform) {
      filteredEdges = edges.filter((e) => {
        const src = marketMap.get(e.sourceMarketId);
        const tgt = marketMap.get(e.targetMarketId);
        if (platform === "cross-platform") {
          return src && tgt && src.platform !== tgt.platform;
        }
        return (
          (src && src.platform === platform) ||
          (tgt && tgt.platform === platform)
        );
      });
    }

    const enriched = filteredEdges.map((edge) => ({
      id: edge.id,
      market_a: marketMap.get(edge.sourceMarketId) ?? {
        id: edge.sourceMarketId,
        title: "Unknown",
        platform: "unknown",
      },
      market_b: marketMap.get(edge.targetMarketId) ?? {
        id: edge.targetMarketId,
        title: "Unknown",
        platform: "unknown",
      },
      relation_class: edge.relationClass,
      relation_type: edge.relationType,
      confidence: edge.confidence,
      score: edge.score,
      direction: edge.direction,
      mathematical_semantics: edge.mathematicalSemantics,
      evidence: edge.evidence,
      detected_at: edge.observedAt,
      model_version: edge.modelVersion,
    }));

    return NextResponse.json({
      constraints: enriched,
      total: totalResult[0]?.count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
