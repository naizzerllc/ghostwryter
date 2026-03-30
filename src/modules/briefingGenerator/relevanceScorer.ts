/**
 * Relevance Scorer — Ranks characters by chapter relevance for Tier 2 budget allocation.
 * GHOSTLY v2.2 · Session 14
 *
 * Scoring (0–10):
 * - Protagonist: always 10
 * - Named in scene_purpose: 8–9
 * - Active karma consequence: 7–8
 * - Introduced this chapter: 7
 * - Last mentioned ≤ 3 chapters ago: 5–6
 * - Not mentioned 10+ chapters: 2–3
 */

import type { CharacterRecord } from "@/modules/characterDB/types";
import type { ChapterOutlineRecord } from "@/modules/outline/outlineSystem";
import type { LivingState } from "@/modules/livingState/livingState";

// ── Types ───────────────────────────────────────────────────────────────

export interface SceneBriefOutput {
  generation_brief: string;
  active_clocks: Array<{ clock_id: string; clock_name: string; current_intensity: number }>;
  character_context: Array<{ character_id: string; name: string; relevance_score: number; compressed_context: string }>;
  subtext_targets: string[];
  tension_target: number;
  hook_required: { hook_type: string; hook_seed: string };
  opening_required: { opening_type: string; opening_seed: string };
  hook_continuity_bridge: string;
  token_budget_used: Record<string, number>;
}

// ── Relevance Scoring ───────────────────────────────────────────────────

export function scoreCharacterRelevance(
  character: CharacterRecord,
  chapterOutline: ChapterOutlineRecord,
  livingState: LivingState
): number {
  // Protagonist always 10
  if (character.role === "protagonist") return 10;

  let score = 3; // base score for any character
  const scenePurpose = (chapterOutline.scene_purpose ?? "").toLowerCase();
  const charName = character.name.toLowerCase();

  // Named in scene_purpose: 8–9
  if (scenePurpose.includes(charName)) {
    score = Math.max(score, 8);
    // Boost to 9 if also in collision_specification
    if ((chapterOutline.collision_specification ?? "").toLowerCase().includes(charName)) {
      score = 9;
    }
  }

  // Named in hook_seed or opening_seed
  const hookSeed = (chapterOutline.hook_seed ?? "").toLowerCase();
  const openingSeed = (chapterOutline.opening_seed ?? "").toLowerCase();
  if (hookSeed.includes(charName) || openingSeed.includes(charName)) {
    score = Math.max(score, 7);
  }

  // Check living state for recency
  const slider = livingState.character_sliders.find(
    s => s.character_id === character.id
  );
  if (slider) {
    const chapterGap = chapterOutline.chapter_number - slider.last_updated_chapter;
    if (chapterGap <= 3) {
      score = Math.max(score, 5 + Math.min(1, 3 - chapterGap)); // 5–6
    } else if (chapterGap >= 10) {
      score = Math.min(score, 3); // Cap at 2–3 for long-absent characters
    }
  }

  // Antagonist gets a base boost
  if (character.role === "antagonist") {
    score = Math.max(score, 5);
  }

  return Math.min(10, Math.max(0, score));
}

// ── Scene Brief Builder ─────────────────────────────────────────────────

export function buildSceneBrief(
  chapterOutline: ChapterOutlineRecord,
  activeClocks: Array<{ id: string; name: string; current_intensity: number }>,
  activeCharacters: Array<{ character: CharacterRecord; score: number }>,
  livingState: LivingState,
  previousChapterHook?: { hook_type: string; hook_seed: string }
): SceneBriefOutput {
  const characterContext = activeCharacters.map(({ character, score }) => ({
    character_id: character.id,
    name: character.name,
    relevance_score: score,
    compressed_context: `${character.compressed_voice_dna.slice(0, 150)} | Wound: ${character.wound} | Flaw: ${character.flaw}`,
  }));

  const clockContext = activeClocks.map(c => ({
    clock_id: c.id,
    clock_name: c.name,
    current_intensity: c.current_intensity,
  }));

  // Build subtext targets from character context
  const subtextTargets: string[] = [];
  for (const { character } of activeCharacters) {
    if (character.self_deception) {
      subtextTargets.push(`${character.name}: self-deception — ${character.self_deception}`);
    }
  }

  // Hook continuity bridge
  const hookBridge = previousChapterHook
    ? `Previous chapter ended on ${previousChapterHook.hook_type}: "${previousChapterHook.hook_seed}" — must be addressed in opening.`
    : "";

  // Assemble generation brief text
  const briefParts = [
    `CHAPTER ${chapterOutline.chapter_number} — ACT ${chapterOutline.act}`,
    `SCENE PURPOSE: ${chapterOutline.scene_purpose}`,
    `TENSION TARGET: ${chapterOutline.tension_score_target}/10`,
    `OPENING: ${chapterOutline.opening_type} — ${chapterOutline.opening_seed}`,
    `HOOK: ${chapterOutline.hook_type} — ${chapterOutline.hook_seed}`,
    `COLLISION: ${chapterOutline.collision_specification}`,
    `PERMANENT CHANGE: ${chapterOutline.permanent_change}`,
    chapterOutline.narrator_deception_gesture
      ? `NDG: ${chapterOutline.narrator_deception_gesture}`
      : "",
    hookBridge,
  ].filter(Boolean);

  return {
    generation_brief: briefParts.join("\n"),
    active_clocks: clockContext,
    character_context: characterContext,
    subtext_targets: subtextTargets,
    tension_target: chapterOutline.tension_score_target,
    hook_required: {
      hook_type: chapterOutline.hook_type,
      hook_seed: chapterOutline.hook_seed,
    },
    opening_required: {
      opening_type: chapterOutline.opening_type,
      opening_seed: chapterOutline.opening_seed,
    },
    hook_continuity_bridge: hookBridge,
    token_budget_used: {},
  };
}
