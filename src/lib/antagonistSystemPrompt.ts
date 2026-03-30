/**
 * Antagonist System Prompt — Two-layer architecture.
 * GHOSTLY v2.2 · S09
 *
 * Layer 1: Invariant — hardcoded, never changes.
 * Layer 2: Per-project — assembled from character record + outline context.
 */

import type { FullCharacterRecord } from "@/lib/characterDatabase";

// ── Layer 1 — Invariant ────────────────────────────────────────────────

const LAYER_1_INVARIANT = `You are writing the antagonist in a Leila Rex psychological thriller. The antagonist is the protagonist's mirror — they pursued the same wound toward a different resolution. The protagonist is still inside the pattern; the antagonist completed it. The antagonist's authority is real: their expertise, social position, and stated motives are entirely credible. The reader must not be able to identify them as antagonist on first read. Their threat is structural — they protect a system, not just themselves. Write in a register clearly distinct from the clinical-dissociative protagonist: more composed, more certain, warmer on the surface. The antagonist believes they are right.`;

// ── Layer 2 — Per-project assembly ─────────────────────────────────────

export interface AntagonistContext {
  /** Antagonist's wound relative to protagonist */
  wound_mirror: string;
  /** Professional authority / expertise */
  antagonist_expertise: string;
  /** How they cause harm — institutional not personal */
  threat_mechanism: string;
  /** early / mid / late Act position */
  current_arc_position: "early" | "mid" | "late";
  /** From compressed_voice_dna — how their voice differs */
  voice_differentiation_note: string;
}

function buildLayer2(character: FullCharacterRecord, ctx: AntagonistContext): string {
  return [
    `=== CHARACTER-SPECIFIC LAYER ===`,
    `Character: ${character.name}`,
    `Wound mirror: ${ctx.wound_mirror}`,
    `Expertise: ${ctx.antagonist_expertise}`,
    `Threat mechanism: ${ctx.threat_mechanism}`,
    `Arc position: ${ctx.current_arc_position}`,
    `Voice differentiation: ${ctx.voice_differentiation_note}`,
    ``,
    `Psychological core:`,
    `  Wound: ${character.wound}`,
    `  Flaw: ${character.flaw}`,
    `  Self-deception: ${character.self_deception}`,
    `  External goal: ${character.external_goal}`,
    `  Internal desire: ${character.internal_desire}`,
    `  Goal-desire gap: ${character.goal_desire_gap}`,
    ``,
    `Compressed Voice DNA: ${character.compressed_voice_dna}`,
    `=== END CHARACTER-SPECIFIC LAYER ===`,
  ].join("\n");
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Assemble the complete antagonist system prompt: Layer 1 + Layer 2.
 */
export function assembleAntagonistBrief(
  character: FullCharacterRecord,
  currentChapter: number,
  outlineContext: { scene_purpose: string; tension_target: number },
  antagonistContext: AntagonistContext,
): string {
  const arcPosition: AntagonistContext["current_arc_position"] =
    currentChapter <= 8 ? "early" : currentChapter <= 20 ? "mid" : "late";

  const ctx = { ...antagonistContext, current_arc_position: arcPosition };

  return [
    LAYER_1_INVARIANT,
    "",
    buildLayer2(character, ctx),
    "",
    `=== SCENE BRIEF ===`,
    `Chapter: ${currentChapter}`,
    `Scene purpose: ${outlineContext.scene_purpose}`,
    `Tension target: ${outlineContext.tension_target}/10`,
    `=== END SCENE BRIEF ===`,
  ].join("\n");
}

/** Expose Layer 1 for testing / audit. */
export const ANTAGONIST_LAYER_1 = LAYER_1_INVARIANT;
