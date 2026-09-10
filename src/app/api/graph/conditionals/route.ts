import { NextRequest, NextResponse } from "next/server";
import { desc, count, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError, ValidationError, DatabaseError } from "@/lib/errors";
import { computeConditional } from "@/lib/engine/conditionals";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const conditionId = params.get("condition");
    const targetId = params.get("target");

    if (conditionId && targetId) {
      let result;
      try {
        result = await computeConditional(conditionId, targetId);
      } catch (error) {
        throw DatabaseError("computeConditional", "edges", {
          originalError: error instanceof Error ? error.message : String(error),
        });
      }

      const pathMarketIds = result.derivationPath.filter(
        (id) =>
          id !== result.conditionMarket.id && id !== result.targetMarket.id,
      );
      const pathMarketMap = new Map<string, { id: string; title: string }>();

      if (pathMarketIds.length > 0) {
        try {
          const pathMarkets = await db
            .select({ id: schema.markets.id, title: schema.markets.title })
            .from(schema.markets)
            .where(inArray(schema.markets.id, pathMarketIds));

          for (const m of pathMarkets) {
            pathMarketMap.set(m.id, m);
          }
        } catch (error) {
          throw DatabaseError("select", "markets", {
            originalError: error instanceof Error ? error.message : String(error),
          });
        }
      }

      pathMarketMap.set(result.conditionMarket.id, {
        id: result.conditionMarket.id,
        title: result.conditionMarket.title,
      });
      pathMarketMap.set(result.targetMarket.id, {
        id: result.targetMarket.id,
        title: result.targetMarket.title,
      });

      return NextResponse.json({
        conditional: {
          probability: result.probability,
          confidenceLevel: result.confidenceLevel,
          confidenceBasis: result.confidenceBasis,
          assumptions: result.assumptions,
          derivationPath: result.derivationPath.map((id) => ({
            id,
            title: pathMarketMap.get(id)?.title ?? "Unknown",
          })),
          conditionMarket: result.conditionMarket,
          targetMarket: result.targetMarket,
        },
      });
    }

    if (!conditionId && !targetId) {
      const page = Math.max(
        1,
        parseInt(params.get("page") ?? "1", 10) || 1,
      );
      const limit = Math.min(
        Math.max(1, parseInt(params.get("limit") ?? "20", 10)),
        100,
      );

      let conditionals;
      let totalResult;
      try {
        [conditionals, totalResult] = await Promise.all([
          db
            .select()
            .from(schema.impliedConditionals)
            .orderBy(desc(schema.impliedConditionals.computedAt))
            .limit(limit)
            .offset((page - 1) * limit),
          db
            .select({ count: count() })
            .from(schema.impliedConditionals),
        ]);
      } catch (error) {
        throw DatabaseError("select", "implied_conditionals", {
          originalError: error instanceof Error ? error.message : String(error),
        });
      }

      if (conditionals.length === 0) {
        return NextResponse.json({
          conditionals: [],
          total: 0,
          page,
          limit,
        });
      }

      const allMarketIds = new Set<string>();
      for (const c of conditionals) {
        allMarketIds.add(c.conditionMarketId);
        allMarketIds.add(c.targetMarketId);
        for (const id of c.derivationPath) {
          allMarketIds.add(id);
        }
      }

      const marketMap = new Map<
        string,
        {
          id: string;
          title: string;
          platform: string;
          currentProbability: string | null;
        }
      >();

      if (allMarketIds.size > 0) {
        try {
          const marketsData = await db
            .select({
              id: schema.markets.id,
              title: schema.markets.title,
              platform: schema.markets.platform,
              currentProbability: schema.markets.currentProbability,
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

      const enriched = conditionals.map((c) => ({
        ...c,
        conditionMarket: marketMap.get(c.conditionMarketId) ?? {
          id: c.conditionMarketId,
          title: "Unknown",
          platform: "unknown",
          currentProbability: null,
        },
        targetMarket: marketMap.get(c.targetMarketId) ?? {
          id: c.targetMarketId,
          title: "Unknown",
          platform: "unknown",
          currentProbability: null,
        },
        derivationMarkets: c.derivationPath.map(
          (id) =>
            marketMap.get(id) ?? {
              id,
              title: "Unknown",
              platform: "unknown",
              currentProbability: null,
            },
        ),
      }));

      return NextResponse.json({
        conditionals: enriched,
        total: totalResult[0]?.count ?? 0,
        page,
        limit,
      });
    }

    throw ValidationError(
      conditionId ? "target" : "condition",
      "required. Provide both condition and target market IDs, or neither to list recent computations.",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
