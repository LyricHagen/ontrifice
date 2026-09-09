import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { db, schema } from "@/db";
import { handleApiError, AuthError } from "@/lib/errors";
import { runIngestion } from "@/lib/ingestion/coordinator";

async function validateApiKey(authHeader: string | null): Promise<boolean> {
  if (!authHeader) return false;
  const key = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!key) return false;

  const hashedKey = crypto.createHash("sha256").update(key).digest("hex");

  const result = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.apiKey, hashedKey))
    .limit(1);

  return result.length > 0;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const valid = await validateApiKey(authHeader);
    if (!valid) {
      throw AuthError("missing_api_key");
    }

    const summary = await runIngestion();
    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
