/**
 * Prose Texture Pass — Pre-detection AI tell revision.
 * GHOSTLY v2.2 · Session 25
 *
 * Runs after forbiddenWordsChecker, before antiAiDetector.
 * Provider: Gemini Pro | Prose DNA injected | Never falls back to Anthropic.
 *
 * On failure: raw text proceeds unchanged, pass_status: FAILED logged.
 * Generation is NEVER blocked by a texture pass failure.
 */

import { callWithFallback, type LLMResponse } from "@/api/llmRouter";

// ── Types ───────────────────────────────────────────────────────────────

export type TexturePassStatus = "COMPLETED" | "FAILED";

export interface TexturePassRecord {
  ran: boolean;
  provider: string;
  chapter_number: number;
  calibration_anchors_injected: boolean;
  pass_status: TexturePassStatus;
  failure_reason: string | null;
  token_cost: number;
}

export interface TexturePassResult {
  revisedText: string;
  texturePassRecord: TexturePassRecord;
}

export interface TexturePassInput {
  chapterText: string;
  chapterNumber: number;
  chapterType: string;
  emotionalArc: string;
  scenePurpose: string;
  currentPressureState: string;
  forbiddenWordsLog: string[];
  calibrationAnchors?: CalibrationAnchor[];
}

export interface CalibrationAnchor {
  tell_id: string;
  example_passage: string;
  why_flagged: string;
  revised_passage: string;
}

// ── Static Block (cached context) ───────────────────────────────────────

function buildStaticBlock(proseDnaRuntime: string): string {
  return `You are a prose texture editor for a commercial psychological thriller series.

Your task is to revise generated chapters to eliminate specific AI-generation surface tells while maintaining complete fidelity to the brand voice and Prose DNA constraints below.

You are NOT a structural editor. Do not change:
- Plot events
- Dialogue content (only dialogue distribution)
- Chapter structure or scene purpose
- Canonical facts or character names

You ARE a surface-level prose surgeon. You change:
- How interiority is rendered (never labelled — always implied through action and observation)
- How dialogue is distributed (power imbalance, not fairness)
- How chapters open (in motion, never establishing)
- Sentence rhythm (break all mirror-structure pairs)
- Scene closing emotional state (forward pressure, never resolution)
- Specific detail selection (character-filtered, never contextually inert)

PROSE DNA — FULL RUNTIME:
${proseDnaRuntime}

BRAND REGISTER: clinical_dissociative — first person present tense — unreliable female narrator.
The narrator does not know what she is hiding. She notices objects rather than feelings.
She acts rather than reflects. When she reflects, she is wrong about herself.
Her certainty is always a defence mechanism. Her specificity is always selective.

OUTPUT: Return the revised chapter in full. No preamble. No revision notes. No annotation.
Return only the revised prose, beginning with the first word of the chapter.`;
}

// ── Dynamic Block (per-call chapter context) ────────────────────────────

function buildDynamicBlock(input: TexturePassInput): string {
  const anchorsBlock = input.calibrationAnchors && input.calibrationAnchors.length > 0
    ? `CALIBRATION ANCHORS (from approved chapters — use these as revision targets):
${input.calibrationAnchors.map(e =>
  `TELL ${e.tell_id}: "${e.example_passage}" → WHY: ${e.why_flagged} → REVISED: "${e.revised_passage}"`
).join("\n")}

`
    : "";

  const forbiddenBlock = input.forbiddenWordsLog.length > 0
    ? `FORBIDDEN WORDS ALREADY REMOVED (do not reintroduce):
${input.forbiddenWordsLog.join(", ")}

`
    : "";

  return `CHAPTER: ${input.chapterNumber} | TYPE: ${input.chapterType}
EMOTIONAL ARC: ${input.emotionalArc}
SCENE PURPOSE: ${input.scenePurpose}
PROTAGONIST PRESSURE STATE: ${input.currentPressureState}

${anchorsBlock}${forbiddenBlock}REVISION TARGETS — ADDRESS IN THIS ORDER:

PRIMARY (address all that apply):

1. INTERIORITY — Find every instance where the narrator accurately names her own psychological mechanism. Replace with a physical action, object observation, or behaviour that implies the state without naming it. She does not know why. She only knows what.

2. DIALOGUE DISTRIBUTION — Find every dialogue exchange where turn length and frequency are approximately equal. Identify the power holder in this scene. Redistribute: dominant character takes more or longer turns; the other character deflects, cuts short, or goes silent. The imbalance is the emotional content.

3. CHAPTER OPENING — If the first sentence establishes scene rather than dropping into motion, rewrite the opening until the first sentence is already inside something in progress. No orientation. No scene-setting. In medias res from word one.

4. SENTENCE MIRROR PAIRS — Find consecutive sentences with parallel structure expressing complementary states. Break every pair: extend one, collapse the other, or introduce a third element that disrupts the symmetry.

5. SCENE CLOSE — If the protagonist's emotional state in the final paragraph is more resolved or certain than in the opening paragraph, introduce an unresolved pressure or new discovery in the closing lines. She must not arrive anywhere comfortable.

SECONDARY (address only if clearly present):

6. INERT SPECIFICS — If three or more consecutive environmental details are vivid but not filtered through the protagonist's emotional state, replace with a single detail that could only exist for this character at this pressure level.

7. SENSATION ATTRIBUTION — If a physical sensation is immediately followed by its cause in the same or adjacent sentence, separate them. Let the sensation stand alone first.

[CHAPTER TEXT]
${input.chapterText}
[END CHAPTER TEXT]`;
}

// ── Run Texture Pass ────────────────────────────────────────────────────

/**
 * Run the Prose Texture Pass on generated chapter text.
 *
 * On failure: returns raw chapterText unchanged with pass_status: FAILED.
 * Generation is NEVER blocked by a texture pass failure.
 */
export async function runTexturePass(input: TexturePassInput): Promise<TexturePassResult> {
  const record: TexturePassRecord = {
    ran: true,
    provider: "gemini_pro",
    chapter_number: input.chapterNumber,
    calibration_anchors_injected: false,
    pass_status: "COMPLETED",
    failure_reason: null,
    token_cost: 0,
  };

  // Load Prose DNA runtime for static block injection
  let proseDnaRuntime = "";
  try {
    const proseDnaModule = await import("@/constants/PROSE_DNA_RUNTIME.js");
    proseDnaRuntime = proseDnaModule.PROSE_DNA_COMPRESSED ?? proseDnaModule.default ?? "";
  } catch {
    console.warn("[TexturePass] Could not load Prose DNA runtime — proceeding without");
  }

  record.calibration_anchors_injected = (input.calibrationAnchors?.length ?? 0) > 0;

  const staticBlock = buildStaticBlock(proseDnaRuntime);
  const dynamicBlock = buildDynamicBlock(input);

  try {
    const response: LLMResponse = await callWithFallback(
      "prose_texture_revision",
      `${staticBlock}\n\n${dynamicBlock}`,
    );

    if (!response || !response.content || response.content.length < 100) {
      throw new Error("Empty or insufficient response from texture pass");
    }

    record.token_cost = response.tokens_used ?? 0;
    record.provider = response.fallback_used ? `${response.provider}_fallback` : response.provider;

    return {
      revisedText: response.content,
      texturePassRecord: record,
    };
  } catch (error) {
    console.error("[TexturePass] Failed:", error instanceof Error ? error.message : String(error));

    // On failure: raw text proceeds, generation never blocked
    record.pass_status = "FAILED";
    record.failure_reason = error instanceof Error ? error.message : String(error);

    return {
      revisedText: input.chapterText, // raw chapter proceeds unchanged
      texturePassRecord: record,
    };
  }
}
