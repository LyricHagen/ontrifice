import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ValidationError } from "@/lib/errors";
import { analyzePortfolio, type PositionInput } from "@/lib/engine/collateral-solver";

export async function POST(request: NextRequest) {
  try {
    let body: { positions?: unknown };
    try {
      body = await request.json();
    } catch {
      throw ValidationError("body", "request body must be valid JSON");
    }

    if (!Array.isArray(body.positions) || body.positions.length === 0) {
      throw ValidationError(
        "positions",
        "must be a non-empty array of position objects ({ market_id, side, size, avg_price })",
      );
    }

    if (body.positions.length > 50) {
      throw ValidationError("positions", "maximum 50 positions per analysis");
    }

    const positions: PositionInput[] = [];
    for (let i = 0; i < body.positions.length; i++) {
      const p = body.positions[i] as Record<string, unknown>;
      const marketId = p.market_id;
      const side = p.side;
      const size = Number(p.size);
      const avgPrice = Number(p.avg_price);

      if (typeof marketId !== "string" || !marketId) {
        throw ValidationError(`positions[${i}].market_id`, "must be a non-empty string");
      }
      if (side !== "YES" && side !== "NO") {
        throw ValidationError(`positions[${i}].side`, "must be 'YES' or 'NO'");
      }
      if (!Number.isFinite(size) || size <= 0) {
        throw ValidationError(`positions[${i}].size`, "must be a positive number");
      }
      if (!Number.isFinite(avgPrice) || avgPrice <= 0 || avgPrice >= 1) {
        throw ValidationError(`positions[${i}].avg_price`, "must be between 0 and 1 (exclusive)");
      }

      positions.push({ marketId, side, size, avgPrice });
    }

    const result = await analyzePortfolio(positions);

    return NextResponse.json({
      naive_collateral: result.naiveCollateral,
      optimized_collateral: result.optimizedCollateral,
      savings: result.savings,
      savings_pct: result.savingsPct,
      constraint_count: result.constraintCount,
      binding_constraints: result.bindingConstraints.map((bc) => ({
        market_id_a: bc.marketIdA,
        market_id_b: bc.marketIdB,
        market_title_a: bc.marketTitleA,
        market_title_b: bc.marketTitleB,
        relationship_type: bc.relationshipType,
        collateral_saved: bc.collateralSaved,
        edge_id: bc.edgeId,
        confidence: bc.confidence,
      })),
      worst_case: {
        resolutions: result.worstCase.resolutions,
        position_pnls: result.worstCase.positionPnls.map((p) => ({
          market_id: p.marketId,
          market_title: p.marketTitle,
          side: p.side,
          size: p.size,
          avg_price: p.avgPrice,
          resolution: p.resolution ? "YES" : "NO",
          pnl: p.pnl,
        })),
        total_loss: result.worstCase.totalLoss,
      },
      warnings: result.warnings,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
