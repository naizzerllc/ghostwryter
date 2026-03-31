/**
 * Post-Approval Hooks — Side effects after chapter approval.
 * Saves approved record, updates living state, proposes memory core update,
 * and records calibration anchors from anti-AI tells.
 * Extracted from chapterPipeline.ts for modularity.
 */

import { updateLivingState } from "@/modules/livingState/livingState";
import { proposeUpdate } from "@/modules/memoryCore/memoryCore";
import { githubStorage } from "@/storage/githubStorage";
import { recordAnchorsFromTells, syncAnchorsToGitHub } from "@/modules/texturePass/calibrationAnchorStore";
import type { GenerationSuccess } from "./generationCore";
import type { PipelineState } from "./pipelineTypes";

/**
 * Save the approved chapter record to GitHub storage.
 */
export async function saveApprovedRecord(
  chapterNumber: number,
  projectId: string,
  state: PipelineState,
): Promise<void> {
  if (!state.approved_record) return;

  const approvedPath = `story-data/${projectId}/chapters/${chapterNumber}/approved.json`;
  try {
    await githubStorage.saveFile(approvedPath, JSON.stringify(state.approved_record, null, 2));
    console.log(`[Pipeline] Approved record saved to ${approvedPath}`);
  } catch (error) {
    console.error(`[Pipeline] Failed to save approved record:`, error);
  }
}

/**
 * Update living state after chapter approval.
 */
export async function runLivingStateUpdate(
  content: string,
  chapterNumber: number,
  projectId: string,
): Promise<void> {
  try {
    await updateLivingState(content, chapterNumber, projectId);
    console.log(`[Pipeline] Living state updated after chapter ${chapterNumber}`);
  } catch (error) {
    console.error(`[Pipeline] Living state update failed:`, error);
  }
}

/**
 * Propose a memory core update with chapter metadata.
 */
export function runMemoryCoreProposal(
  projectId: string,
  successResult: GenerationSuccess,
  chapterNumber: number,
): void {
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
}

/**
 * Record calibration anchors from anti-AI tells for future texture passes.
 */
export function runCalibrationAnchorRecording(
  state: PipelineState,
  content: string,
  chapterNumber: number,
  projectId: string,
): void {
  if (!state.anti_ai_result || state.anti_ai_result.tells_detected.length === 0) return;

  try {
    const newAnchors = recordAnchorsFromTells(
      chapterNumber,
      state.anti_ai_result.tells_detected,
      content,
    );
    if (newAnchors.length > 0) {
      console.log(`[Pipeline] Recorded ${newAnchors.length} calibration anchors from chapter ${chapterNumber}`);
      // Sync to GitHub (non-blocking)
      syncAnchorsToGitHub(projectId).catch(err =>
        console.warn("[Pipeline] Calibration anchor GitHub sync failed:", err)
      );
    }
  } catch (error) {
    console.warn(`[Pipeline] Calibration anchor recording failed (non-blocking):`, error);
  }
}
