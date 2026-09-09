import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handleApiError, AuthError } from "@/lib/errors";
import { loadGroundTruth, summarizeDataset } from "@/lib/eval/ground-truth";
import { evaluateSemantic } from "@/lib/eval/evaluate-semantic";
import { calibrateConditionals } from "@/lib/eval/calibrate-conditionals";
import { backtestCascades } from "@/lib/eval/backtest-cascades";

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

    const pairs = loadGroundTruth();
    const dataset = summarizeDataset(pairs);
    const semantic = evaluateSemantic(pairs);
    const calibration = calibrateConditionals(500, 2000, 0.15);
    const cascade = backtestCascades(200);

    return NextResponse.json({
      date: new Date().toISOString(),
      dataset: {
        totalPairs: dataset.total,
        byType: dataset.byType,
        byLabel: dataset.byLabel,
      },
      semantic: {
        precision: semantic.precision,
        recall: semantic.recall,
        f1: semantic.f1,
        accuracy: semantic.accuracy,
        falsePositiveRate: semantic.falsePositiveRate,
        threshold: semantic.threshold,
        confusionMatrix: semantic.confusionMatrix,
        byRelationType: semantic.byRelationType,
      },
      calibration: {
        ece: calibration.ece,
        brierScore: calibration.brierScore,
        meanAbsoluteError: calibration.meanAbsoluteError,
        clampRate: calibration.clampRate,
        nTrials: calibration.nTrials,
        noiseSigma: calibration.noiseSigma,
        bins: calibration.bins,
      },
      cascade: {
        precisionAt1h: cascade.precisionAt1h,
        precisionAt6h: cascade.precisionAt6h,
        mae: cascade.mae,
        falseAlarmRate: cascade.falseAlarmRate,
        nAlerts: cascade.nAlerts,
        nPredictions: cascade.nPredictions,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
