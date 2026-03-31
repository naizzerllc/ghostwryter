/**
 * Scene Revision Tool — Targeted chapter rewrites with diff.
 * GHOSTLY v2.2 · Session 25
 *
 * Flow: select chapter → describe change → classify scope → confirm →
 * execute revision → diff view → accept/reject → quality check → memory update.
 */

import { callWithFallback } from "@/api/llmRouter";
import { classifyRevisionScope, type RevisionScope, type RevisionScopeResult } from "./revisionScopeClassifier";
import { proposeUpdate } from "@/modules/memoryCore/memoryCore";
import type { TaskType } from "@/api/llmRouter";

// ── Types ───────────────────────────────────────────────────────────────

export interface RevisionInput {
  chapter_number: number;
  project_id: string;
  instruction: string;
  scene_purpose_changed: boolean;
  structural_change: boolean;
}

export interface DiffLine {
  type: "unchanged" | "added" | "removed";
  content: string;
  line_number: number;
}

export interface RevisionResult {
  chapter_number: number;
  scope: RevisionScopeResult;
  original_content: string;
  revised_content: string;
  diff: DiffLine[];
  status: "PENDING_REVIEW" | "ACCEPTED" | "REJECTED";
  revised_at: string;
}

// ── Storage Helpers ─────────────────────────────────────────────────────

function loadApprovedContent(projectId: string, chapterNumber: number): string | null {
  try {
    const key = `ghostly_approved_${projectId}_ch${chapterNumber}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const record = JSON.parse(raw);
    return record.approved_draft || record.content || null;
  } catch {
    return null;
  }
}

function loadForbiddenWordCount(projectId: string, chapterNumber: number): number {
  try {
    const key = `ghostly_approved_${projectId}_ch${chapterNumber}`;
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const record = JSON.parse(raw);
    return record.forbidden_word_violations?.length || 0;
  } catch {
    return 0;
  }
}

// ── Diff Generator ──────────────────────────────────────────────────────

export function generateDiff(original: string, revised: string): DiffLine[] {
  const originalLines = original.split("\n");
  const revisedLines = revised.split("\n");
  const diff: DiffLine[] = [];
  let lineNum = 1;

  const maxLen = Math.max(originalLines.length, revisedLines.length);

  for (let i = 0; i < maxLen; i++) {
    const origLine = originalLines[i] ?? null;
    const revLine = revisedLines[i] ?? null;

    if (origLine === revLine) {
      diff.push({ type: "unchanged", content: origLine!, line_number: lineNum++ });
    } else {
      if (origLine !== null) {
        diff.push({ type: "removed", content: origLine, line_number: lineNum++ });
      }
      if (revLine !== null) {
        diff.push({ type: "added", content: revLine, line_number: lineNum++ });
      }
    }
  }

  return diff;
}

// ── Scope Assessment ────────────────────────────────────────────────────

export function assessRevisionScope(input: RevisionInput): RevisionScopeResult {
  const content = loadApprovedContent(input.project_id, input.chapter_number) || "";
  const forbiddenCount = loadForbiddenWordCount(input.project_id, input.chapter_number);

  return classifyRevisionScope({
    instruction: input.instruction,
    chapter_number: input.chapter_number,
    chapter_content: content,
    forbidden_word_violation_count: forbiddenCount,
    scene_purpose_changed: input.scene_purpose_changed,
    structural_change: input.structural_change,
  });
}

// ── Execute Revision ────────────────────────────────────────────────────

export async function executeRevision(input: RevisionInput): Promise<RevisionResult> {
  const originalContent = loadApprovedContent(input.project_id, input.chapter_number);
  if (!originalContent) {
    throw new Error(`No approved content for chapter ${input.chapter_number}`);
  }

  const scope = assessRevisionScope(input);

  let taskType: TaskType;
  let prompt: string;

  if (scope.scope === "FULL_REGENERATION") {
    // Full regeneration routes through Generation Core (simplified here)
    taskType = "generation_protagonist";
    prompt = `You are revising Chapter ${input.chapter_number} of a psychological thriller.

REVISION INSTRUCTION: ${input.instruction}

ORIGINAL CHAPTER:
${originalContent}

Write the COMPLETE revised chapter incorporating the requested changes. Maintain the established voice, tension, and narrative style. Return ONLY the revised chapter text.`;
  } else if (scope.scope === "SECTION_REWRITE") {
    taskType = "generation_protagonist";
    prompt = `You are performing a section rewrite on Chapter ${input.chapter_number} of a psychological thriller.

REVISION INSTRUCTION: ${input.instruction}

ORIGINAL CHAPTER:
${originalContent}

Rewrite the relevant section(s) as instructed. Return the COMPLETE chapter with the revised section(s) integrated seamlessly. Maintain voice and pacing. Return ONLY the full revised chapter text.`;
  } else {
    // PATCH
    taskType = "generation_protagonist";
    prompt = `You are making a minor patch edit to Chapter ${input.chapter_number} of a psychological thriller.

EDIT INSTRUCTION: ${input.instruction}

ORIGINAL CHAPTER:
${originalContent}

Apply the requested minor edit. Return the COMPLETE chapter with the patch applied. Return ONLY the full revised chapter text.`;
  }

  try {
    const response = await callWithFallback(taskType, prompt);
    const revisedContent = response.content.trim();
    const diff = generateDiff(originalContent, revisedContent);

    return {
      chapter_number: input.chapter_number,
      scope,
      original_content: originalContent,
      revised_content: revisedContent,
      diff,
      status: "PENDING_REVIEW",
      revised_at: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(`Revision failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ── Accept / Reject ─────────────────────────────────────────────────────

export function acceptRevision(
  result: RevisionResult,
  projectId: string,
): void {
  // Update the approved draft in storage
  const key = `ghostly_approved_${projectId}_ch${result.chapter_number}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const record = JSON.parse(raw);
      record.approved_draft = result.revised_content;
      record.human_editorial_override = true;
      record.override_note = `Scene revision (${result.scope.scope})`;
      record.human_editorial_sign_off = {
        status: "PENDING",
        signed_by: null,
        signed_at: null,
        notes: null,
      };
      localStorage.setItem(key, JSON.stringify(record));
    }
  } catch (error) {
    console.error("[SceneRevision] Failed to save accepted revision:", error);
  }

  result.status = "ACCEPTED";

  // Trigger memory update if required
  if (result.scope.memory_update_required) {
    proposeUpdate(projectId, {
      type: "scene_revision",
      chapter_number: result.chapter_number,
      scope: result.scope.scope,
      summary: `Chapter ${result.chapter_number} revised (${result.scope.scope}): ${result.scope.reason}`,
    });
  }
}

export function rejectRevision(result: RevisionResult): void {
  result.status = "REJECTED";
}
