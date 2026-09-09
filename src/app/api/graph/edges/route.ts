import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ValidationError } from "@/lib/errors";
import { getNeighbors, getEdges } from "@/lib/engine/graph";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const marketId = params.get("market_id");
    const depth = parseInt(params.get("depth") ?? "1", 10);
    const edgeType = params.get("edge_type") as
      | "semantic"
      | "temporal"
      | "structural"
      | "composite"
      | null;
    const minWeight = params.get("min_weight");

    if (marketId) {
      if (depth < 1 || depth > 5) {
        throw ValidationError("depth", "must be between 1 and 5");
      }

      const subgraph = await getNeighbors(marketId, depth);
      return NextResponse.json(subgraph);
    }

    const filters: Parameters<typeof getEdges>[0] = {};
    if (edgeType) {
      const valid = ["semantic", "temporal", "structural", "composite"];
      if (!valid.includes(edgeType)) {
        throw ValidationError(
          "edge_type",
          `must be one of: ${valid.join(", ")}`,
        );
      }
      filters.edgeType = edgeType;
    }
    if (minWeight) {
      const w = parseFloat(minWeight);
      if (isNaN(w) || w < 0 || w > 1) {
        throw ValidationError("min_weight", "must be a number between 0 and 1");
      }
      filters.minWeight = w;
    }

    const limit = parseInt(params.get("limit") ?? "100", 10);
    filters.limit = Math.min(Math.max(1, limit), 500);

    const edges = await getEdges(filters);
    return NextResponse.json({ edges, count: edges.length });
  } catch (error) {
    return handleApiError(error);
  }
}
