/**
 * Quality Gate — Full weighted composite scoring with 4 hard vetoes.
 * GHOSTLY v2.2 · Session 22
 *
 * Weights: reader_simulation 0.32 · dev_editor 0.20 · anti_ai 0.18 ·
 *          line_editor 0.15 · dialogue_editor 0.10 · continuity_editor 0.05
 *
 * Four hard vetoes (fire regardless of composite):
 * 1. Continuity CRITICAL violation
 * 2. Scene purpose not delivered (dev editor)
 * 3. Twist integrity BREACHED pre-revelation
 * 4. Compulsion < 5 with no compulsion_floor_note
 *
 * Generation floor: first generation < 4.0 → full regeneration (skip revision).
 * Revision loop: max 7 total attempts before escalation.
 */

import { githubStorage } from "@/storage/githubStorage";

// ── Types ───────────────────────────────────────────────────────────────

export type QualityGateResult = "APPROVED" | "REVIEW" | "REJECTED";
export type QualityGateAction = "APPROVED" | "REVIEW" | "REJECTED" | "FULL_REGENERATION" | "ESCALATION";

export interface ModuleScores {
  reader_simulation: number;
  developmental_editor: number;
  anti_ai_detector: number;
  line_editor: number;
  dialogue_editor: number;
  continuity_editor: number;
}

export interface VetoStatus {
  continuity_veto: boolean;
  scene_purpose_veto: boolean;
  twist_integrity_veto: boolean;
  compulsion_veto: boolean;
}

export interface QualityGateOutput {
  chapter_number: number;
  module_scores: ModuleScores;
  reader_sim_optimism_offset: number;
  adjusted_reader_sim_score: number;
  weighted_score: number;
  compulsion_rating: number;
  twist_integrity_verdict: string;
  vetoes: VetoStatus;
  any_veto_fired: boolean;
  result: QualityGateResult;
  action: QualityGateAction;
  revision_count: number;
  max_revisions_reached: boolean;
  flags: QualityGateFlag[];
}

export interface QualityGateFlag {
  code: string;
  severity: "CRITICAL" | "WARNING" | "NOTE";
  message: string;
}

export interface CompulsionCurveRecord {
  chapter_number: number;
  tension_score_target: number;
  tension_score_actual: number;
  compulsion_score: number;
  hook_compulsion_score: number;
  entry_compulsion_score: number;
  act: number;
  approved_at: string;
}

export interface QualityGateInput {
  chapterNumber: number;
  projectId: string;
  moduleScores: ModuleScores;
  readerSimOptimismOffset: number;
  compulsionRating: number;
  hookCompulsionScore: number;
  entryCompulsionScore: number;
  tensionScoreTarget: number;
  tensionScoreActual: number;
  act: number;
  twistIntegrityVerdict: string; // "PROTECTED" | "AT_RISK" | "BREACHED"
  continuityVeto: boolean;
  scenePurposeVeto: boolean;
  compulsionFloorNote?: string;
  revisionCount: number;
  isFirstGeneration: boolean;
}

// ── Weights ─────────────────────────────────────────────────────────────

const WEIGHTS = {
  reader_simulation: 0.32,
  developmental_editor: 0.20,
  anti_ai_detector: 0.18,
  line_editor: 0.15,
  dialogue_editor: 0.10,
  continuity_editor: 0.05,
} as const;

const THRESHOLD_APPROVE = 8.0;
const THRESHOLD_REVIEW = 7.0;
const GENERATION_FLOOR = 4.0;
const MAX_REVISIONS = 7;

// ── Main Function ───────────────────────────────────────────────────────

export function runQualityGate(input: QualityGateInput): QualityGateOutput {
  const flags: QualityGateFlag[] = [];

  // 1. Apply reader sim optimism offset
  const adjustedReaderSim = Math.max(0, Math.min(10,
    input.moduleScores.reader_simulation + input.readerSimOptimismOffset,
  ));

  // 2. Calculate weighted composite
  const adjustedScores: ModuleScores = {
    ...input.moduleScores,
    reader_simulation: adjustedReaderSim,
  };

  const weightedScore = Math.round((
    adjustedScores.reader_simulation * WEIGHTS.reader_simulation +
    adjustedScores.developmental_editor * WEIGHTS.developmental_editor +
    adjustedScores.anti_ai_detector * WEIGHTS.anti_ai_detector +
    adjustedScores.line_editor * WEIGHTS.line_editor +
    adjustedScores.dialogue_editor * WEIGHTS.dialogue_editor +
    adjustedScores.continuity_editor * WEIGHTS.continuity_editor
  ) * 10) / 10;

  // 3. Check hard vetoes
  const compulsionVeto = input.compulsionRating < 5 && !input.compulsionFloorNote;
  const twistVeto = input.twistIntegrityVerdict === "BREACHED";

  const vetoes: VetoStatus = {
    continuity_veto: input.continuityVeto,
    scene_purpose_veto: input.scenePurposeVeto,
    twist_integrity_veto: twistVeto,
    compulsion_veto: compulsionVeto,
  };

  const anyVetoFired = vetoes.continuity_veto || vetoes.scene_purpose_veto ||
    vetoes.twist_integrity_veto || vetoes.compulsion_veto;

  // Flag vetoes
  if (vetoes.continuity_veto) {
    flags.push({
      code: "VETO_CONTINUITY",
      severity: "CRITICAL",
      message: "Hard veto: CRITICAL canonical fact contradiction.",
    });
  }
  if (vetoes.scene_purpose_veto) {
    flags.push({
      code: "VETO_SCENE_PURPOSE",
      severity: "CRITICAL",
      message: "Hard veto: scene_purpose_delivered = false → FULL_REGENERATION required.",
    });
  }
  if (vetoes.twist_integrity_veto) {
    flags.push({
      code: "VETO_TWIST_BREACHED",
      severity: "CRITICAL",
      message: "Hard veto: Twist integrity BREACHED pre-revelation.",
    });
  }
  if (vetoes.compulsion_veto) {
    flags.push({
      code: "VETO_COMPULSION",
      severity: "CRITICAL",
      message: `Hard veto: compulsion_score ${input.compulsionRating} < 5 with no compulsion_floor_note.`,
    });
  }

  // 4. Determine result
  let result: QualityGateResult;
  let action: QualityGateAction;

  if (anyVetoFired) {
    result = "REJECTED";
    action = vetoes.scene_purpose_veto ? "FULL_REGENERATION" : "REJECTED";
  } else if (weightedScore >= THRESHOLD_APPROVE) {
    result = "APPROVED";
    action = "APPROVED";
  } else if (weightedScore >= THRESHOLD_REVIEW) {
    result = "REVIEW";
    action = "REVIEW";
  } else {
    result = "REJECTED";
    action = "REJECTED";
  }

  // 5. Generation floor — first generation below 4.0 → skip revision, full regenerate
  if (input.isFirstGeneration && weightedScore < GENERATION_FLOOR && !anyVetoFired) {
    action = "FULL_REGENERATION";
    flags.push({
      code: "GENERATION_FLOOR",
      severity: "CRITICAL",
      message: `First generation scored ${weightedScore} (below floor ${GENERATION_FLOOR}). Full regeneration with rebuilt brief.`,
    });
  }

  // 6. Revision escalation
  const maxRevisionsReached = input.revisionCount >= MAX_REVISIONS;
  if (maxRevisionsReached && result === "REJECTED") {
    action = "ESCALATION";
    flags.push({
      code: "REVISION_ESCALATION",
      severity: "CRITICAL",
      message: `${input.revisionCount} revision attempts exhausted (max ${MAX_REVISIONS}). Escalation required.`,
    });
  }

  // Score warnings
  if (weightedScore < THRESHOLD_REVIEW && !anyVetoFired) {
    flags.push({
      code: "SCORE_BELOW_REVIEW",
      severity: "WARNING",
      message: `Weighted composite ${weightedScore} below review threshold ${THRESHOLD_REVIEW}.`,
    });
  }

  return {
    chapter_number: input.chapterNumber,
    module_scores: input.moduleScores,
    reader_sim_optimism_offset: input.readerSimOptimismOffset,
    adjusted_reader_sim_score: adjustedReaderSim,
    weighted_score: weightedScore,
    compulsion_rating: input.compulsionRating,
    twist_integrity_verdict: input.twistIntegrityVerdict,
    vetoes,
    any_veto_fired: anyVetoFired,
    result,
    action,
    revision_count: input.revisionCount,
    max_revisions_reached: maxRevisionsReached,
    flags,
  };
}

// ── Compulsion Curve Record Builder ─────────────────────────────────────

export function buildCompulsionCurveRecord(
  input: QualityGateInput,
): CompulsionCurveRecord {
  return {
    chapter_number: input.chapterNumber,
    tension_score_target: input.tensionScoreTarget,
    tension_score_actual: input.tensionScoreActual,
    compulsion_score: input.compulsionRating,
    hook_compulsion_score: input.hookCompulsionScore,
    entry_compulsion_score: input.entryCompulsionScore,
    act: input.act,
    approved_at: new Date().toISOString(),
  };
}

// ── Save Quality Gate Result ────────────────────────────────────────────

export async function saveQualityGateResult(
  projectId: string,
  chapterNumber: number,
  result: QualityGateOutput,
): Promise<void> {
  try {
    const path = `story-data/${projectId}/chapters/${chapterNumber}/quality.json`;
    await githubStorage.saveFile(path, JSON.stringify(result, null, 2));
    console.log(`[QualityGate] Result saved to ${path}`);
  } catch (err) {
    console.warn("[QualityGate] Failed to save result:", err);
  }
}

// ── Save Compulsion Curve Record ────────────────────────────────────────

export async function saveCompulsionCurveRecord(
  projectId: string,
  record: CompulsionCurveRecord,
): Promise<void> {
  try {
    const path = `story-data/${projectId}/compulsion_curve.json`;
    let existing: CompulsionCurveRecord[] = [];
    try {
      const raw = await githubStorage.loadFile(path);
      if (raw) existing = JSON.parse(raw);
    } catch { /* file doesn't exist yet */ }

    // Replace existing record for same chapter or append
    const idx = existing.findIndex(r => r.chapter_number === record.chapter_number);
    if (idx >= 0) {
      existing[idx] = record;
    } else {
      existing.push(record);
      existing.sort((a, b) => a.chapter_number - b.chapter_number);
    }

    await githubStorage.saveFile(path, JSON.stringify(existing, null, 2));
    console.log(`[QualityGate] Compulsion curve record saved for chapter ${record.chapter_number}`);
  } catch (err) {
    console.warn("[QualityGate] Failed to save compulsion curve record:", err);
  }
}

// ── Revision Brief Builder ──────────────────────────────────────────────

export interface RevisionBriefModule {
  module_name: string;
  score: number;
  weight: number;
  is_primary: boolean;
  notes: string[];
}

export function buildRevisionBrief(
  output: QualityGateOutput,
): RevisionBriefModule[] {
  const modules: Array<{ name: keyof ModuleScores; weight: number }> = [
    { name: "reader_simulation", weight: WEIGHTS.reader_simulation },
    { name: "developmental_editor", weight: WEIGHTS.developmental_editor },
    { name: "anti_ai_detector", weight: WEIGHTS.anti_ai_detector },
    { name: "line_editor", weight: WEIGHTS.line_editor },
    { name: "dialogue_editor", weight: WEIGHTS.dialogue_editor },
    { name: "continuity_editor", weight: WEIGHTS.continuity_editor },
  ];

  // Sort by weighted impact (lowest score × highest weight = biggest drag)
  const scored = modules.map(m => ({
    ...m,
    score: output.module_scores[m.name],
    impact: (10 - output.module_scores[m.name]) * m.weight,
  })).sort((a, b) => b.impact - a.impact);

  // Primary = highest impact failing module
  const result: RevisionBriefModule[] = scored.map((m, i) => ({
    module_name: m.name,
    score: m.score,
    weight: m.weight,
    is_primary: i === 0,
    notes: i === 0
      ? [`Primary revision target. Score: ${m.score}/10. Weight: ${m.weight}.`]
      : m.score < 7
        ? [`Secondary concern. Score: ${m.score}/10.`]
        : [],
  }));

  return result.filter(m => m.is_primary || m.notes.length > 0);
}

// ── Console exposure ────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_qualityGate = {
    runQualityGate,
    buildCompulsionCurveRecord,
    buildRevisionBrief,
  };
}
