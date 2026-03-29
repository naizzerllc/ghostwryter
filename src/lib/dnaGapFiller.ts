/**
 * DNA Gap Filler — adaptive conversation engine for filling extraction gaps.
 * GHOSTLY v2.2 · Session 7
 */

import { callAnthropic } from "@/api/llmRouter";
import type { DnaGap, GapType } from "@/types/dna";

// ── Generate options for CANDIDATE_OPTIONS gaps ─────────────────────────

export async function generateGapOptions(
  question: DnaGap,
  braindumpContext: string,
): Promise<string[]> {
  const prompt = `You are helping a psychological thriller writer fill gaps in their book DNA.

The writer has described their book idea:
"""
${braindumpContext}
"""

They haven't specified: ${question.label}
Question: Based on the braindump above, generate 3 concrete, specific options for this DNA element. Each option should be one sentence, distinct from the others, and grounded in the Leila Rex brand (clinical-dissociative psychological thriller, medical settings, unreliable narrator).

Respond as a JSON array of 3 strings:
["option 1", "option 2", "option 3"]`;

  const response = await callAnthropic(
    "dna_gap_options",
    "You generate concise creative options for fiction DNA elements. Respond only with a JSON array of 3 strings.",
    prompt,
    { max_tokens: 500, temperature: 0.8 },
  );

  try {
    const match = response.content.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No array found");
    return JSON.parse(match[0]) as string[];
  } catch {
    console.error("[Gap Filler] Failed to parse options response");
    return [
      "Option generation failed — please type your answer below",
    ];
  }
}

// ── Generate forced choice options (trope pairs, narrator frames) ───────

export async function generateForcedChoiceOptions(
  question: DnaGap,
  braindumpContext: string,
): Promise<string[]> {
  if (question.question_id === "active_tropes") {
    return [
      "A + B — Medication as Unreliable Witness + Complicit Witness",
      "A + C — Medication as Unreliable Witness + Retrospective Confession",
      "B + C — Complicit Witness + Retrospective Confession",
      "A + B + C — All three active tropes",
    ];
  }

  if (question.question_id === "narrator_frame") {
    return [
      "Confession — the narrator is confessing to someone (therapist, detective, jury)",
      "Testimony — the narrator is giving testimony, constrained by what they claim to remember",
      "Reconstruction — the narrator is reconstructing events, filling gaps they acknowledge",
      "Real-time — first person present tense, no retrospective frame",
    ];
  }

  // Fallback: generate via LLM
  const response = await callAnthropic(
    "dna_gap_options",
    "Generate 4 distinct forced-choice options for a fiction DNA element. Respond only as a JSON array of 4 strings.",
    `Question: ${question.label}\nContext: ${braindumpContext}`,
    { max_tokens: 500, temperature: 0.7 },
  );

  try {
    const match = response.content.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No array found");
    return JSON.parse(match[0]) as string[];
  } catch {
    return ["Option 1", "Option 2", "Option 3", "Option 4"];
  }
}
