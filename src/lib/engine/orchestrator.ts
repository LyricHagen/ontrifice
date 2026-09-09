import { logger } from "@/lib/logger";
import { detectSemanticDependencies } from "./semantic";
import { detectTemporalCoMovement } from "./temporal";
import { detectStructuralConstraints } from "./structural";
import { buildGraph } from "./graph";
import { detectIncoherences } from "./incoherence";
import { detectCascades } from "./cascades";

export interface ComputationSummary {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  steps: {
    semantic: { edges: number; durationMs: number };
    temporal: { edges: number; durationMs: number };
    structural: { edges: number; durationMs: number };
    graph: { created: number; updated: number; durationMs: number };
    incoherences: { detected: number; stored: number; durationMs: number };
    cascades: { alertsCreated: number; alertsResolved: number; durationMs: number };
  };
}

function elapsed(start: number): number {
  return Date.now() - start;
}

export async function runFullPipeline(): Promise<ComputationSummary> {
  const pipelineStart = Date.now();
  const startedAt = new Date().toISOString();

  logger.info("=== starting full computation pipeline ===");

  logger.info("[1/6] semantic dependency detection");
  let stepStart = Date.now();
  const semanticEdges = await detectSemanticDependencies();
  const semanticDuration = elapsed(stepStart);
  logger.info("[1/6] complete", {
    edges: semanticEdges.length,
    durationMs: semanticDuration,
  });

  logger.info("[2/6] structural constraint detection");
  stepStart = Date.now();
  const structuralEdges = await detectStructuralConstraints();
  const structuralDuration = elapsed(stepStart);
  logger.info("[2/6] complete", {
    edges: structuralEdges.length,
    durationMs: structuralDuration,
  });

  const temporalCandidates = semanticEdges.map((e) => ({
    sourceId: e.sourceMarketId,
    targetId: e.targetMarketId,
  }));
  for (const e of structuralEdges) {
    const exists = temporalCandidates.some(
      (c) =>
        (c.sourceId === e.sourceMarketId && c.targetId === e.targetMarketId) ||
        (c.sourceId === e.targetMarketId && c.targetId === e.sourceMarketId),
    );
    if (!exists) {
      temporalCandidates.push({
        sourceId: e.sourceMarketId,
        targetId: e.targetMarketId,
      });
    }
  }

  logger.info("[3/6] temporal co-movement detection", {
    candidates: temporalCandidates.length,
  });
  stepStart = Date.now();
  const temporalEdges = await detectTemporalCoMovement(temporalCandidates);
  const temporalDuration = elapsed(stepStart);
  logger.info("[3/6] complete", {
    edges: temporalEdges.length,
    durationMs: temporalDuration,
  });

  logger.info("[4/6] building unified graph");
  stepStart = Date.now();
  const graphResult = await buildGraph(semanticEdges, temporalEdges, structuralEdges);
  const graphDuration = elapsed(stepStart);
  logger.info("[4/6] complete", {
    created: graphResult.created,
    updated: graphResult.updated,
    durationMs: graphDuration,
  });

  logger.info("[5/6] detecting incoherences");
  stepStart = Date.now();
  const incoherenceResult = await detectIncoherences();
  const incoherenceDuration = elapsed(stepStart);
  logger.info("[5/6] complete", {
    detected: incoherenceResult.detected,
    stored: incoherenceResult.stored,
    durationMs: incoherenceDuration,
  });

  logger.info("[6/6] detecting cascades");
  stepStart = Date.now();
  const cascadeResult = await detectCascades();
  const cascadeDuration = elapsed(stepStart);
  logger.info("[6/6] complete", {
    alertsCreated: cascadeResult.alertsCreated,
    alertsResolved: cascadeResult.alertsResolved,
    durationMs: cascadeDuration,
  });

  const totalDuration = elapsed(pipelineStart);
  const completedAt = new Date().toISOString();

  logger.info("=== computation pipeline complete ===", {
    totalDurationMs: totalDuration,
  });

  return {
    startedAt,
    completedAt,
    durationMs: totalDuration,
    steps: {
      semantic: { edges: semanticEdges.length, durationMs: semanticDuration },
      temporal: { edges: temporalEdges.length, durationMs: temporalDuration },
      structural: { edges: structuralEdges.length, durationMs: structuralDuration },
      graph: { ...graphResult, durationMs: graphDuration },
      incoherences: { ...incoherenceResult, durationMs: incoherenceDuration },
      cascades: { ...cascadeResult, durationMs: cascadeDuration },
    },
  };
}
