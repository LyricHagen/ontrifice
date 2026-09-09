import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ValidationError } from "@/lib/errors";
import { computeConditional } from "@/lib/engine/conditionals";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const conditionId = params.get("condition");
    const targetId = params.get("target");

    if (!conditionId) {
      throw ValidationError(
        "condition",
        "required. Provide the market ID to condition on",
      );
    }
    if (!targetId) {
      throw ValidationError(
        "target",
        "required. Provide the target market ID",
      );
    }

    const result = await computeConditional(conditionId, targetId);

    return NextResponse.json({
      conditional: {
        probability: result.conditionalProbability,
        confidence: result.confidence,
        derivationPath: result.derivationPath,
        conditionMarket: result.conditionMarket,
        targetMarket: result.targetMarket,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
