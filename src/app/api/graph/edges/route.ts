import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ValidationError } from "@/lib/errors";
import { getNeighbors, getEdges } from "@/lib/engine/graph";

const VALID_CLASSES = ["logical", "statistical", "semantic"] as const;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const marketId = params.get("market_id");
    const depth = parseInt(params.get("depth") ?? "1", 10);
    const relationClass = params.get("relation_class") as
      | "logical"
      | "statistical"
      | "semantic"
      | null;
    const relationType = params.get("relation_type");
    const minScore = params.get("min_score");

    if (marketId) {
      if (depth < 1 || depth > 5) {
        throw ValidationError("depth", "must be between 1 and 5");
      }

      const rc = relationClass ?? undefined;
      if (rc && !VALID_CLASSES.includes(rc)) {
        throw ValidationError(
          "relation_class",
          `must be one of: ${VALID_CLASSES.join(", ")}`,
        );
      }

      const subgraph = await getNeighbors(marketId, depth, rc);
      return NextResponse.json(subgraph);
    }

    const filters: Parameters<typeof getEdges>[0] = {};
    if (relationClass) {
      if (!VALID_CLASSES.includes(relationClass)) {
        throw ValidationError(
          "relation_class",
          `must be one of: ${VALID_CLASSES.join(", ")}`,
        );
      }
      filters.relationClass = relationClass;
    }
    if (relationType) {
      filters.relationType = relationType;
    }
    if (minScore) {
      const s = parseFloat(minScore);
      if (isNaN(s) || s < -1 || s > 1) {
        throw ValidationError("min_score", "must be a number between -1 and 1");
      }
      filters.minScore = s;
    }

    const limit = parseInt(params.get("limit") ?? "100", 10);
    filters.limit = Math.min(Math.max(1, limit), 500);

    const edges = await getEdges(filters);
    return NextResponse.json({ edges, count: edges.length });
  } catch (error) {
    return handleApiError(error);
  }
}
