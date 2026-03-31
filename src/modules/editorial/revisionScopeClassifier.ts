/**
 * Revision Scope Classifier — DOC_E
 * GHOSTLY v2.2 · Session 25
 *
 * Classifies revision requests as PATCH / SECTION_REWRITE / FULL_REGENERATION
 * based on the revision instruction, chapter content, and forbidden word violations.
 */

// ── Types ───────────────────────────────────────────────────────────────

export type RevisionScope = "PATCH" | "SECTION_REWRITE" | "FULL_REGENERATION";

export interface RevisionScopeResult {
  scope: RevisionScope;
  reason: string;
  estimated_tokens: number;
  memory_update_required: boolean;
}

export interface RevisionRequest {
  instruction: string;
  chapter_number: number;
  chapter_content: string;
  forbidden_word_violation_count: number;
  scene_purpose_changed: boolean;
  structural_change: boolean;
}

// ── Token Estimates ─────────────────────────────────────────────────────

const TOKEN_ESTIMATES: Record<RevisionScope, number> = {
  PATCH: 800,
  SECTION_REWRITE: 3500,
  FULL_REGENERATION: 8000,
};

// ── Classifier ──────────────────────────────────────────────────────────

/**
 * Classify revision scope based on the revision request characteristics.
 *
 * Rules:
 * - PATCH: single sentence/short passage, < 5 forbidden word violations, no structural changes
 * - SECTION_REWRITE: scene-level change, 5+ concentrated violations, character behaviour change
 * - FULL_REGENERATION: scene purpose change, > 10 distributed violations, structural change
 */
export function classifyRevisionScope(request: RevisionRequest): RevisionScopeResult {
  const { instruction, forbidden_word_violation_count, scene_purpose_changed, structural_change } = request;

  // FULL_REGENERATION triggers
  if (scene_purpose_changed) {
    return {
      scope: "FULL_REGENERATION",
      reason: "Scene purpose has changed — full regeneration required to maintain narrative coherence.",
      estimated_tokens: TOKEN_ESTIMATES.FULL_REGENERATION,
      memory_update_required: true,
    };
  }

  if (structural_change) {
    return {
      scope: "FULL_REGENERATION",
      reason: "Structural change detected — full regeneration required.",
      estimated_tokens: TOKEN_ESTIMATES.FULL_REGENERATION,
      memory_update_required: true,
    };
  }

  if (forbidden_word_violation_count > 10) {
    return {
      scope: "FULL_REGENERATION",
      reason: `${forbidden_word_violation_count} distributed forbidden word violations — full regeneration recommended.`,
      estimated_tokens: TOKEN_ESTIMATES.FULL_REGENERATION,
      memory_update_required: true,
    };
  }

  // SECTION_REWRITE triggers
  const sectionKeywords = [
    "rewrite", "redo", "change the scene", "rework", "overhaul",
    "character behavio", "character should", "make them", "change how",
    "entire section", "whole passage", "restructure",
  ];

  const instructionLower = instruction.toLowerCase();
  const hasSectionKeywords = sectionKeywords.some((kw) => instructionLower.includes(kw));

  if (hasSectionKeywords || forbidden_word_violation_count >= 5) {
    return {
      scope: "SECTION_REWRITE",
      reason: hasSectionKeywords
        ? "Scene-level change requested — section rewrite required."
        : `${forbidden_word_violation_count} concentrated forbidden word violations — section rewrite recommended.`,
      estimated_tokens: TOKEN_ESTIMATES.SECTION_REWRITE,
      memory_update_required: true,
    };
  }

  // PATCH (default)
  return {
    scope: "PATCH",
    reason: "Minor change — patch edit sufficient.",
    estimated_tokens: TOKEN_ESTIMATES.PATCH,
    memory_update_required: false,
  };
}
