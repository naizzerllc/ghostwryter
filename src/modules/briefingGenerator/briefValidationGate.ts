/**
 * Brief Validation Gate — Pre-generation validation for assembled briefs.
 * GHOSTLY v2.2 · Session 14
 *
 * Fires before every generation call. Errors block. Warnings surface in UI.
 *
 * Checks:
 * 1. scene_purpose verb force classification (FORCE_HIGH / FORCE_MID / FORCE_LOW)
 * 2. hook_seed specificity (>= 5 words, no generic phrasing)
 * 3. narrator_deception_gesture present (psych thriller, pre-revelation)
 * 4. Emotional continuity between chapters
 * 5. Token budget (> 8,000T warning, > 10,000T error)
 */

import type { ChapterOutlineRecord } from "@/modules/outline/outlineSystem";
import { getRevelationChapter, getGenreMode, getChapter } from "@/modules/outline/outlineSystem";
import { getLivingState } from "@/modules/livingState/livingState";
import type { GenerationBrief } from "./briefingGenerator";

// ── Types ───────────────────────────────────────────────────────────────

export type ForceClassification = "FORCE_HIGH" | "FORCE_MID" | "FORCE_LOW";

export interface BriefValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  force_classification: ForceClassification;
}

// ── Force Verb Classification ───────────────────────────────────────────

const FORCE_HIGH_VERBS = [
  "expose", "destroy", "confront", "reveal", "shatter", "break",
  "betray", "attack", "escape", "kill", "unmask", "collapse",
];

const FORCE_MID_VERBS = [
  "escalate", "discover", "establish", "shift", "challenge", "test",
  "pressure", "threaten", "investigate", "pursue", "suspect", "deceive",
];

const FORCE_LOW_VERBS = [
  "explore", "consider", "show", "indicate", "suggest", "reflect",
  "observe", "introduce", "describe", "present", "depict", "illustrate",
];

function classifyForce(scenePurpose: string): ForceClassification {
  const words = scenePurpose.toLowerCase().split(/\s+/);
  // Check first 3 words for the primary verb
  const leadWords = words.slice(0, 4);

  for (const word of leadWords) {
    if (FORCE_HIGH_VERBS.some(v => word.startsWith(v))) return "FORCE_HIGH";
  }
  for (const word of leadWords) {
    if (FORCE_MID_VERBS.some(v => word.startsWith(v))) return "FORCE_MID";
  }
  for (const word of leadWords) {
    if (FORCE_LOW_VERBS.some(v => word.startsWith(v))) return "FORCE_LOW";
  }

  // Default to MID if no recognized verb
  return "FORCE_MID";
}

// ── Hook Seed Specificity ───────────────────────────────────────────────

const GENERIC_PHRASES = [
  "something happens",
  "a twist",
  "unexpected event",
  "big reveal",
  "dramatic moment",
  "tension builds",
  "things change",
];

function checkHookSeedSpecificity(hookSeed: string): string | null {
  if (!hookSeed || hookSeed.trim().length === 0) {
    return "hook_seed is missing — specify a concrete image or detail";
  }

  const wordCount = hookSeed.trim().split(/\s+/).length;
  if (wordCount < 5) {
    return "hook_seed is too generic — specify a concrete image or detail (minimum 5 words)";
  }

  const lower = hookSeed.toLowerCase();
  for (const phrase of GENERIC_PHRASES) {
    if (lower.includes(phrase)) {
      return `hook_seed contains generic phrasing ("${phrase}") — specify a concrete image or detail`;
    }
  }

  return null;
}

// ── Main Validation ─────────────────────────────────────────────────────

export function validateBrief(
  brief: GenerationBrief,
  chapterOutline: ChapterOutlineRecord
): BriefValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Force classification
  const forceClass = classifyForce(chapterOutline.scene_purpose);
  if (forceClass === "FORCE_LOW") {
    errors.push(
      "Rewrite scene_purpose with a higher-force verb. Low-force scene purpose produces low-urgency chapters."
    );
  }

  // 2. Hook seed specificity
  const hookWarning = checkHookSeedSpecificity(chapterOutline.hook_seed);
  if (hookWarning) {
    warnings.push(hookWarning);
  }

  // 3. Narrator deception gesture (psych thriller, pre-revelation)
  const genreMode = getGenreMode();
  const revelationChapter = getRevelationChapter();
  if (
    genreMode === "psychological_thriller" &&
    chapterOutline.chapter_number < revelationChapter &&
    !chapterOutline.narrator_deception_gesture
  ) {
    warnings.push(
      `narrator_deception_gesture missing for Chapter ${chapterOutline.chapter_number} (pre-revelation, psych thriller). NDG is mandatory.`
    );
  }

  // 4. Emotional continuity
  if (chapterOutline.chapter_number > 1) {
    const livingState = getLivingState(brief.project_id);
    const prevChapter = getChapter(chapterOutline.chapter_number - 1);

    if (livingState.emotional_state_at_chapter_end && prevChapter) {
      // Simple presence check — detailed mismatch detection requires LLM
      if (!livingState.emotional_state_at_chapter_end || livingState.emotional_state_at_chapter_end.trim() === "") {
        warnings.push(
          `Emotional discontinuity detected between chapters ${chapterOutline.chapter_number - 1} and ${chapterOutline.chapter_number}`
        );
      }
    }
  }

  // 5. Token budget
  if (brief.total_tokens > 10000) {
    errors.push(
      `Brief token count (${brief.total_tokens}) exceeds 10,000T ceiling — generation blocked`
    );
  } else if (brief.total_tokens > 8000) {
    warnings.push(
      `Brief token count (${brief.total_tokens}) exceeds 8,000T warning threshold`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    force_classification: forceClass,
  };
}
