import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { runFullPipeline } from "@/lib/engine/orchestrator";

export async function GET() {
  try {
    const summary = await runFullPipeline();

    return NextResponse.json({
      status: "complete",
      summary,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
