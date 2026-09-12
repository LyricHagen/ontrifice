import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ValidationError } from "@/lib/errors";
import { suggestPositions, type PositionInput } from "@/lib/engine/collateral-solver";

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

    const positions: PositionInput[] = [];
    for (let i = 0; i < body.positions.length; i++) {
      const p = body.positions[i] as Record<string, unknown>;
      positions.push({
        marketId: String(p.market_id),
        side: p.side === "NO" ? "NO" : "YES",
        size: Number(p.size) || 100,
        avgPrice: Number(p.avg_price) || 0.5,
      });
    }

    const suggestions = await suggestPositions(positions);

    return NextResponse.json({
      suggestions: suggestions.map((s) => ({
        market_id: s.marketId,
        market_title: s.marketTitle,
        relationship_count: s.relationshipCount,
        potential_reduction: s.potentialReduction,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
