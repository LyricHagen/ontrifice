import { NextRequest, NextResponse } from "next/server";
import { eq, desc, asc, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError, ValidationError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const sort = params.get("sort") ?? "severity";
    const order = params.get("order") ?? "desc";
    const limit = Math.min(
      Math.max(1, parseInt(params.get("limit") ?? "50", 10)),
      200,
    );

    const validSorts = ["severity", "detected_at"];
    if (!validSorts.includes(sort)) {
      throw ValidationError("sort", `must be one of: ${validSorts.join(", ")}`);
    }

    const validStatuses = ["active", "resolved", "expired"];
    if (status && !validStatuses.includes(status)) {
      throw ValidationError(
        "status",
        `must be one of: ${validStatuses.join(", ")}`,
      );
    }

    const conditions = [];
    if (status) {
      conditions.push(
        eq(
          schema.incoherences.status,
          status as "active" | "resolved" | "expired",
        ),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderFn = order === "asc" ? asc : desc;
    const sortColumn =
      sort === "severity"
        ? schema.incoherences.severity
        : schema.incoherences.detectedAt;

    const incoherences = await db
      .select()
      .from(schema.incoherences)
      .where(where)
      .orderBy(orderFn(sortColumn))
      .limit(limit);

    return NextResponse.json({
      incoherences,
      count: incoherences.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
