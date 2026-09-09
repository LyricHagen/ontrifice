import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError, AuthError } from "@/lib/errors";
import { runFullPipeline } from "@/lib/engine/orchestrator";

async function validateApiKey(request: NextRequest): Promise<void> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) throw AuthError("missing_api_key");

  const key = authHeader.replace(/^Bearer\s+/i, "");
  if (!key) throw AuthError("missing_api_key");

  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.apiKey, key));

  if (!user) throw AuthError("invalid_credentials");
}

export async function POST(request: NextRequest) {
  try {
    await validateApiKey(request);
    const summary = await runFullPipeline();

    return NextResponse.json({
      status: "complete",
      summary,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
