import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { runFullPipeline } from "@/lib/engine/orchestrator";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json(
        { error: "Unauthorized. (ERR_CRON_AUTH)" },
        { status: 401 },
      );
    }
  }

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
