/**
 * Chapter Pipeline — Orchestrates generation → quality → approval.
 * GHOSTLY v2.2 · Session 17
 *
 * Stages: GENERATING → QUALITY_CHECK → HUMAN_REVIEW → APPROVED / REJECTED
 *
 * On APPROVED: creates approved_chapter_record with human_editorial_sign_off
 * defaulting to PENDING. Triggers living state update and memory core proposal.
 */

import { generateChapter, type GenerationResult, type GenerationSuccess } from "./generationCore";
import { updateLivingState } from "@/modules/livingState/livingState";
import { proposeUpdate } from "@/modules/memoryCore/memoryCore";
import { githubStorage } from "@/storage/githubStorage";
import { runMedicalFactCheck, type MedicalFactCheckResult } from "@/modules/quality/medicalFactChecker";

// ── Types ───────────────────────────────────────────────────────────────

export type PipelineStage =
  | "IDLE"
  | "GENERATING"
  | "QUALITY_CHECK"
  | "HUMAN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "BLOCKED";

export type SignOffStatus =
  | "PENDING"
  | "SIGNED_OFF"
  | "FLAGGED_FOR_REVISION"
  | "SKIPPED";

export interface HumanEditorialSignOff {
  status: SignOffStatus;
  signed_by: string | null;
  signed_at: string | null;
  notes: string | null;
}

export interface ApprovedChapterRecord {
  chapter_number: number;
  approved_draft: string;
  composite_score: number | null;
  human_editorial_override: boolean;
  override_note: string | null;
  emotional_state_at_chapter_end: string | null;
  generation_truncation_suspected: boolean;
  human_editorial_sign_off: HumanEditorialSignOff;
  model_used: string;
  tokens_used: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  approved_at: string;
}

export interface PipelineState {
  chapter_number: number;
  project_id: string;
  stage: PipelineStage;
  generation_result: GenerationResult | null;
  approved_record: ApprovedChapterRecord | null;
  quality_score: number | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface PipelineResult {
  success: boolean;
  state: PipelineState;
}

// ── Pipeline State Tracking ─────────────────────────────────────────────

const activePipelines: Map<string, PipelineState> = new Map();
const pipelineListeners: Set<(state: PipelineState) => void> = new Set();

function pipelineKey(chapterNumber: number, projectId: string): string {
  return `${projectId}:ch${chapterNumber}`;
}

function emitStateChange(state: PipelineState): void {
  pipelineListeners.forEach(listener => {
    try { listener(state); } catch (e) { console.error("[Pipeline] Listener error:", e); }
  });
}

export function subscribeToPipeline(listener: (state: PipelineState) => void): () => void {
  pipelineListeners.add(listener);
  return () => pipelineListeners.delete(listener);
}

export function getPipelineState(chapterNumber: number, projectId: string): PipelineState | null {
  return activePipelines.get(pipelineKey(chapterNumber, projectId)) ?? null;
}

// ── Approved Chapter Record Creation ────────────────────────────────────

function createApprovedRecord(
  chapterNumber: number,
  generationResult: GenerationSuccess,
): ApprovedChapterRecord {
  // INVARIANT [A16-1]: status always defaults to PENDING. No chapter born SIGNED_OFF.
  const signOff: HumanEditorialSignOff = {
    status: "PENDING",
    signed_by: null,
    signed_at: null,
    notes: null,
  };

  // If truncation suspected: SKIPPED is not permitted for sign-off
  if (generationResult.truncation_suspected) {
    signOff.notes = "TRUNCATION_SUSPECTED — mandatory human review. SKIPPED not permitted.";
  }

  return {
    chapter_number: chapterNumber,
    approved_draft: generationResult.content,
    composite_score: null, // populated by quality pipeline (Sessions 19–22)
    human_editorial_override: false,
    override_note: null,
    emotional_state_at_chapter_end: null, // populated by living state update
    generation_truncation_suspected: generationResult.truncation_suspected,
    human_editorial_sign_off: signOff,
    model_used: generationResult.model_used,
    tokens_used: generationResult.tokens_used,
    cache_read_tokens: generationResult.cache_read_tokens,
    cache_write_tokens: generationResult.cache_write_tokens,
    approved_at: new Date().toISOString(),
  };
}

// ── Main Pipeline ───────────────────────────────────────────────────────

/**
 * Run the full chapter pipeline: generate → quality check → human review → approve/reject.
 *
 * Quality modules are stubbed (Sessions 19–22 build them).
 * Human review is surfaced (Session 18 builds the UI).
 */
export async function runChapterPipeline(
  chapterNumber: number,
  projectId: string,
): Promise<PipelineResult> {
  const key = pipelineKey(chapterNumber, projectId);

  const state: PipelineState = {
    chapter_number: chapterNumber,
    project_id: projectId,
    stage: "GENERATING",
    generation_result: null,
    approved_record: null,
    quality_score: null,
    error: null,
    started_at: new Date().toISOString(),
    completed_at: null,
  };

  activePipelines.set(key, state);
  emitStateChange(state);

  // ── Stage 1: GENERATING ─────────────────────────────────────────
  console.log(`[Pipeline] Chapter ${chapterNumber}: GENERATING`);
  let generationResult: GenerationResult;

  try {
    generationResult = await generateChapter(chapterNumber, projectId);
  } catch (error) {
    state.stage = "BLOCKED";
    state.error = error instanceof Error ? error.message : String(error);
    state.completed_at = new Date().toISOString();
    emitStateChange(state);
    return { success: false, state };
  }

  state.generation_result = generationResult;

  if (generationResult.blocked) {
    state.stage = "BLOCKED";
    state.error = generationResult.message;
    state.completed_at = new Date().toISOString();
    emitStateChange(state);
    return { success: false, state };
  }

  // Narrow type after blocked check
  const successResult = generationResult as GenerationSuccess;

  // ── Stage 2: QUALITY_CHECK (stubbed — Sessions 19–22) ───────────
  state.stage = "QUALITY_CHECK";
  emitStateChange(state);
  console.log(`[Pipeline] Chapter ${chapterNumber}: QUALITY_CHECK (stub — no quality modules yet)`);

  // Quality score is null until quality pipeline modules are built
  state.quality_score = null;

  // ── Stage 3: HUMAN_REVIEW (surfaced — Session 18 builds UI) ─────
  state.stage = "HUMAN_REVIEW";
  emitStateChange(state);
  console.log(`[Pipeline] Chapter ${chapterNumber}: HUMAN_REVIEW (auto-approve for now — UI in Session 18)`);

  // For now, auto-approve. Session 18 will add the human review interface.
  // ── Stage 4: APPROVED ───────────────────────────────────────────
  const approvedRecord = createApprovedRecord(chapterNumber, successResult);
  state.approved_record = approvedRecord;
  state.stage = "APPROVED";
  state.completed_at = new Date().toISOString();
  emitStateChange(state);

  console.log(`[Pipeline] Chapter ${chapterNumber}: APPROVED (sign_off: ${approvedRecord.human_editorial_sign_off.status})`);

  // ── Post-approval: Save approved record ─────────────────────────
  const approvedPath = `story-data/${projectId}/chapters/${chapterNumber}/approved.json`;
  try {
    await githubStorage.saveFile(approvedPath, JSON.stringify(approvedRecord, null, 2));
    console.log(`[Pipeline] Approved record saved to ${approvedPath}`);
  } catch (error) {
    console.error(`[Pipeline] Failed to save approved record:`, error);
  }

  // ── Post-approval: Living state update ──────────────────────────
  try {
    await updateLivingState(successResult.content, chapterNumber, projectId);
    console.log(`[Pipeline] Living state updated after chapter ${chapterNumber}`);
  } catch (error) {
    console.error(`[Pipeline] Living state update failed:`, error);
  }

  // ── Post-approval: Memory Core propose ──────────────────────────
  try {
    proposeUpdate(projectId, {
      chapter_approved: chapterNumber,
      model_used: successResult.model_used,
      tokens_used: successResult.tokens_used,
      truncation_suspected: successResult.truncation_suspected,
      forbidden_word_count: successResult.forbidden_word_violations.violations.length,
      boundary_warning_count: successResult.boundary_violations.length,
    });
    console.log(`[Pipeline] Memory Core update proposed — awaiting human confirmation`);
  } catch (error) {
    console.error(`[Pipeline] Memory Core proposal failed:`, error);
  }

  return { success: true, state };
}

// ── Human Override ──────────────────────────────────────────────────────

/**
 * Apply a human editorial override to an approved chapter.
 * Updates the approved_chapter_record in storage.
 */
export async function applyHumanOverride(
  chapterNumber: number,
  projectId: string,
  overrideContent: string,
  overrideNote: string,
): Promise<ApprovedChapterRecord | null> {
  const key = pipelineKey(chapterNumber, projectId);
  const state = activePipelines.get(key);

  if (!state?.approved_record) {
    console.error(`[Pipeline] No approved record for chapter ${chapterNumber}`);
    return null;
  }

  state.approved_record.approved_draft = overrideContent;
  state.approved_record.human_editorial_override = true;
  state.approved_record.override_note = overrideNote;
  // Sign-off resets to PENDING on override
  state.approved_record.human_editorial_sign_off.status = "PENDING";
  state.approved_record.human_editorial_sign_off.signed_by = null;
  state.approved_record.human_editorial_sign_off.signed_at = null;

  const approvedPath = `story-data/${projectId}/chapters/${chapterNumber}/approved.json`;
  try {
    await githubStorage.saveFile(approvedPath, JSON.stringify(state.approved_record, null, 2));
  } catch (error) {
    console.error(`[Pipeline] Failed to save override:`, error);
  }

  emitStateChange(state);
  return state.approved_record;
}

// ── Sign-off Management ─────────────────────────────────────────────────

/**
 * Update sign-off status for an approved chapter.
 * SKIPPED is not permitted when truncation is suspected.
 */
export function updateSignOff(
  chapterNumber: number,
  projectId: string,
  status: SignOffStatus,
  signedBy: string,
  notes?: string,
): boolean {
  const key = pipelineKey(chapterNumber, projectId);
  const state = activePipelines.get(key);

  if (!state?.approved_record) {
    console.error(`[Pipeline] No approved record for chapter ${chapterNumber}`);
    return false;
  }

  // INVARIANT: SKIPPED not permitted when truncation suspected
  if (status === "SKIPPED" && state.approved_record.generation_truncation_suspected) {
    console.error(`[Pipeline] SKIPPED not permitted for chapter ${chapterNumber} — truncation suspected`);
    return false;
  }

  state.approved_record.human_editorial_sign_off = {
    status,
    signed_by: signedBy,
    signed_at: new Date().toISOString(),
    notes: notes ?? null,
  };

  emitStateChange(state);
  return true;
}

// ── Manuscript Lock Check ───────────────────────────────────────────────

/**
 * Check if all chapters are eligible for manuscript lock.
 * INVARIANT [A16-2]: Cannot proceed with any PENDING or FLAGGED_FOR_REVISION.
 */
export function checkManuscriptLockEligibility(projectId: string): {
  eligible: boolean;
  blocking_chapters: number[];
} {
  const blocking: number[] = [];

  activePipelines.forEach((state) => {
    if (state.project_id !== projectId) return;
    if (!state.approved_record) return;

    const signOffStatus = state.approved_record.human_editorial_sign_off.status;
    if (signOffStatus === "PENDING" || signOffStatus === "FLAGGED_FOR_REVISION") {
      blocking.push(state.chapter_number);
    }
  });

  return {
    eligible: blocking.length === 0,
    blocking_chapters: blocking.sort((a, b) => a - b),
  };
}
