import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, count, gte, or, ne, inArray, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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

    const srcMarket = alias(schema.markets, "src_market");
    const tgtMarket = alias(schema.markets, "tgt_market");

    const conditions: SQL[] = [
      eq(schema.edges.sourceMarketId, srcMarket.id),
      eq(schema.edges.targetMarketId, tgtMarket.id),
    ];

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
    if (platform) {
      if (platform === "cross-platform") {
        conditions.push(ne(srcMarket.platform, tgtMarket.platform));
      } else {
        conditions.push(
          or(
            eq(srcMarket.platform, platform as "polymarket" | "kalshi" | "limitless"),
            eq(tgtMarket.platform, platform as "polymarket" | "kalshi" | "limitless"),
          )!,
        );
      }
    }

    const where = and(...conditions);

    let rows;
    let totalResult;
    try {
      [rows, totalResult] = await Promise.all([
        db
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
            evidence: schema.edges.evidence,
            observedAt: schema.edges.observedAt,
            modelVersion: schema.edges.modelVersion,
            srcId: srcMarket.id,
            srcTitle: srcMarket.title,
            srcPlatform: srcMarket.platform,
            tgtId: tgtMarket.id,
            tgtTitle: tgtMarket.title,
            tgtPlatform: tgtMarket.platform,
          })
          .from(schema.edges)
          .innerJoin(srcMarket, eq(schema.edges.sourceMarketId, srcMarket.id))
          .innerJoin(tgtMarket, eq(schema.edges.targetMarketId, tgtMarket.id))
          .where(where)
          .orderBy(desc(schema.edges.confidence))
          .limit(limit)
          .offset((page - 1) * limit),
        db
          .select({ count: count() })
          .from(schema.edges)
          .innerJoin(srcMarket, eq(schema.edges.sourceMarketId, srcMarket.id))
          .innerJoin(tgtMarket, eq(schema.edges.targetMarketId, tgtMarket.id))
          .where(where),
      ]);
    } catch (error) {
      throw DatabaseError("select", "edges", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    const enriched = rows.map((row) => ({
      id: row.id,
      market_a: { id: row.srcId, title: row.srcTitle, platform: row.srcPlatform },
      market_b: { id: row.tgtId, title: row.tgtTitle, platform: row.tgtPlatform },
      relation_class: row.relationClass,
      relation_type: row.relationType,
      confidence: row.confidence,
      score: row.score,
      direction: row.direction,
      mathematical_semantics: row.mathematicalSemantics,
      evidence: row.evidence,
      detected_at: row.observedAt,
      model_version: row.modelVersion,
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
