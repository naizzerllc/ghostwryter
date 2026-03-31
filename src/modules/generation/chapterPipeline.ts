/**
 * Chapter Pipeline — Orchestrates generation → quality → approval.
 * GHOSTLY v2.2 · Session 17 (refactored S25)
 *
 * Stages: GENERATING → QUALITY_CHECK → HUMAN_REVIEW → APPROVED / REJECTED
 *
 * Types, state management, record creation, and post-approval hooks
 * extracted into focused modules for maintainability.
 */

import { generateChapter, type GenerationResult, type GenerationSuccess } from "./generationCore";
import { getLivingState } from "@/modules/livingState/livingState";
import { getChapter } from "@/modules/outline/outlineSystem";
import { runMedicalFactCheck } from "@/modules/quality/medicalFactChecker";
import { runTexturePass } from "@/modules/texturePass/texturePass";
import { loadCalibrationAnchors } from "@/modules/texturePass/calibrationAnchorStore";
import { githubStorage } from "@/storage/githubStorage";

// ── Re-exported types (preserve existing import paths) ──────────────────
export type {
  PipelineStage,
  SignOffStatus,
  HumanEditorialSignOff,
  ApprovedChapterRecord,
  PipelineState,
  PipelineResult,
} from "./pipelineTypes";

import type { PipelineState, SignOffStatus } from "./pipelineTypes";

// ── Re-exported state management ────────────────────────────────────────
export { subscribeToPipeline, getPipelineState } from "./pipelineStateManager";
import {
  pipelineKey,
  emitStateChange,
  setPipelineState,
  getActivePipelines,
} from "./pipelineStateManager";

// ── Internal imports ────────────────────────────────────────────────────
import { createApprovedRecord } from "./approvedRecordFactory";
import {
  saveApprovedRecord,
  runLivingStateUpdate,
  runMemoryCoreProposal,
  runCalibrationAnchorRecording,
} from "./postApprovalHooks";

// ── Main Pipeline ───────────────────────────────────────────────────────

/**
 * Run the full chapter pipeline: generate → quality check → human review → approve/reject.
 */
export async function runChapterPipeline(
  chapterNumber: number,
  projectId: string,
): Promise<{ success: boolean; state: PipelineState }> {
  const key = pipelineKey(chapterNumber, projectId);

  const state: PipelineState = {
    chapter_number: chapterNumber,
    project_id: projectId,
    stage: "GENERATING",
    generation_result: null,
    approved_record: null,
    quality_score: null,
    medical_fact_check_result: null,
    medical_advisory_required: false,
    texture_pass_record: null,
    anti_ai_result: null,
    error: null,
    started_at: new Date().toISOString(),
    completed_at: null,
  };

  setPipelineState(key, state);
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

  const successResult = generationResult as GenerationSuccess;

  // ── Prose Texture Pass (after forbidden words, before quality check) ──
  console.log(`[Pipeline] Chapter ${chapterNumber}: TEXTURE_PASS`);
  try {
    const forbiddenWordsLog = successResult.forbidden_word_violations.violations.map(v => v.word);
    const calibrationAnchors = loadCalibrationAnchors(projectId, chapterNumber);

    const outlineRecord = getChapter(chapterNumber);
    const livingState = getLivingState(projectId);

    const chapterType = outlineRecord?.scene_type ?? "standard";
    const emotionalArc = outlineRecord?.emotional_resonance_target ?? "escalating";
    const scenePurpose = outlineRecord?.scene_purpose ?? "unknown";
    const currentPressureState = livingState.emotional_state_at_chapter_end || "active";

    const { revisedText, texturePassRecord } = await runTexturePass({
      chapterText: successResult.content,
      chapterNumber,
      chapterType,
      emotionalArc,
      scenePurpose,
      currentPressureState,
      forbiddenWordsLog,
      calibrationAnchors,
    });
    state.texture_pass_record = texturePassRecord;

    if (texturePassRecord.pass_status === "COMPLETED") {
      successResult.content = revisedText;
      console.log(`[Pipeline] Chapter ${chapterNumber}: Texture pass COMPLETED (${texturePassRecord.token_cost} tokens)`);
    } else {
      console.warn(`[Pipeline] Chapter ${chapterNumber}: Texture pass FAILED — raw text proceeds`);
    }
  } catch (error) {
    console.warn(`[Pipeline] Texture pass error (non-blocking):`, error);
  }

  // ── Stage 2: QUALITY_CHECK ──────────────────────────────────────
  state.stage = "QUALITY_CHECK";
  emitStateChange(state);
  console.log(`[Pipeline] Chapter ${chapterNumber}: QUALITY_CHECK`);
  state.quality_score = null;

  // Medical fact check
  try {
    const medicalResult = await runMedicalFactCheck(
      successResult.content,
      { medical_fact_check_active: true },
      chapterNumber,
    );
    state.medical_fact_check_result = medicalResult;
    state.medical_advisory_required = medicalResult.advisory_required;
    console.log(`[Pipeline] Chapter ${chapterNumber}: Medical fact check — pass: ${medicalResult.pass}, advisory: ${medicalResult.advisory_required}`);
  } catch (error) {
    console.warn(`[Pipeline] Medical fact check failed (non-blocking):`, error);
  }

  // ── Stage 3: HUMAN_REVIEW ──────────────────────────────────────
  state.stage = "HUMAN_REVIEW";
  emitStateChange(state);
  console.log(`[Pipeline] Chapter ${chapterNumber}: HUMAN_REVIEW (auto-approve for now — UI in Session 18)`);

  // ── Stage 4: APPROVED ──────────────────────────────────────────
  const approvedRecord = createApprovedRecord(chapterNumber, successResult);
  state.approved_record = approvedRecord;
  state.stage = "APPROVED";
  state.completed_at = new Date().toISOString();
  emitStateChange(state);
  console.log(`[Pipeline] Chapter ${chapterNumber}: APPROVED (sign_off: ${approvedRecord.human_editorial_sign_off.status})`);

  // ── Post-approval hooks ─────────────────────────────────────────
  await saveApprovedRecord(chapterNumber, projectId, state);
  await runLivingStateUpdate(successResult.content, chapterNumber, projectId);
  runMemoryCoreProposal(projectId, successResult, chapterNumber);
  runCalibrationAnchorRecording(state, successResult.content, chapterNumber, projectId);

  return { success: true, state };
}

// ── Human Override ──────────────────────────────────────────────────────

/**
 * Apply a human editorial override to an approved chapter.
 */
export async function applyHumanOverride(
  chapterNumber: number,
  projectId: string,
  overrideContent: string,
  overrideNote: string,
): Promise<import("./pipelineTypes").ApprovedChapterRecord | null> {
  const key = pipelineKey(chapterNumber, projectId);
  const state = getActivePipelines().get(key);

  if (!state?.approved_record) {
    console.error(`[Pipeline] No approved record for chapter ${chapterNumber}`);
    return null;
  }

  state.approved_record.approved_draft = overrideContent;
  state.approved_record.human_editorial_override = true;
  state.approved_record.override_note = overrideNote;
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
  const state = getActivePipelines().get(key);

  if (!state?.approved_record) {
    console.error(`[Pipeline] No approved record for chapter ${chapterNumber}`);
    return false;
  }

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

  getActivePipelines().forEach((state) => {
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
