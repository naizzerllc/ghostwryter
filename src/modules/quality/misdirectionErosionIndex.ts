/**
 * Misdirection Erosion Index (MEI) — Manuscript-level twist integrity monitor.
 * GHOSTLY v2.2 · Session 20
 *
 * Runs at Chapter 10 and every 10 chapters thereafter until revelation_chapter - 5.
 * Skipped for twist_architecture: none.
 * Uses Gemini Flash via callWithFallback('misdirection_erosion_check', ...) — NO Prose DNA.
 *
 * Three dimensions: Possibility Space, Suppressed Evidence Exposure, Self-Deception Coherence.
 * Composite: GREEN / AMBER / RED / CRITICAL.
 * CRITICAL blocks generation until resolved.
 */

import { callWithFallback } from "@/api/llmRouter";

// ── Types ───────────────────────────────────────────────────────────────

export type PossibilitySpace = "WIDE" | "MODERATE" | "NARROW" | "COLLAPSED";
export type SuppressedEvidenceExposure = "NONE" | "PROXIMITY_WARNING" | "EXPOSURE_RISK";
export type SelfDeceptionCoherence = "FULL_STRENGTH" | "THINNING" | "COMPROMISED";
export type MEICompositeStatus = "GREEN" | "AMBER" | "RED" | "CRITICAL";
export type TwistMode = "FULL" | "DUAL" | "EXTERNAL" | "NONE";

export interface MEIFlag {
  code: string;
  severity: "CRITICAL" | "WARNING" | "NOTE";
  message: string;
  chapter_citations?: number[];
}

export interface MEIResult {
  trigger_chapter: number;
  possibility_space: PossibilitySpace;
  suppressed_evidence_exposure: SuppressedEvidenceExposure;
  self_deception_coherence: SelfDeceptionCoherence | null;
  composite_status: MEICompositeStatus;
  action_required: boolean;
  erosion_chapters: number[];
  analysis: string;
  flags: MEIFlag[];
}

// ── Should Run Check ────────────────────────────────────────────────────

export function shouldRunMEI(
  chapterNumber: number,
  revelationChapter: number,
  twistArchitecture: string,
): boolean {
  if (twistArchitecture === "none") return false;
  if (chapterNumber < 10) return false;
  if (chapterNumber > revelationChapter - 5) return false;
  return chapterNumber % 10 === 0;
}

// ── System Prompt ───────────────────────────────────────────────────────

function buildSystemPrompt(
  twistMode: TwistMode,
  misdirectionMap: string,
): string {
  const selfDeceptionSection = (twistMode === "FULL" || twistMode === "DUAL")
    ? `3. SELF-DECEPTION COHERENCE (active for ${twistMode} mode):
Is the narrator's self-deception still structurally believable? Or has their behaviour become inconsistent with the declared self-deception?
- FULL_STRENGTH: self-deception is internally consistent, reader accepts it
- THINNING: cracks are appearing but still plausible
- COMPROMISED: narrator's behaviour no longer consistent with declared self-deception`
    : `3. SELF-DECEPTION COHERENCE: Not applicable for EXTERNAL mode. Return null.`;

  return `You are a twist integrity analyst for a psychological thriller. Evaluate whether the twist architecture is holding or eroding.

MISDIRECTION MAP:
${misdirectionMap}

Evaluate THREE dimensions:

1. POSSIBILITY SPACE:
Is the reader still capable of holding the false interpretation? Or has accumulated evidence effectively revealed the truth?
- WIDE: multiple interpretations remain equally viable
- MODERATE: false interpretation still holds but alternative is gaining strength
- NARROW: false interpretation is weakening, truth is becoming apparent
- COLLAPSED: the twist is effectively known — the false interpretation cannot be sustained

2. SUPPRESSED EVIDENCE EXPOSURE:
Are the items the narrator is suppressing/avoiding still hidden?
- NONE: all suppressed items remain safely hidden
- PROXIMITY_WARNING: a suppressed item narrowly avoided surfacing in the last 3 chapters
- EXPOSURE_RISK: a suppressed item has been partially surfaced

${selfDeceptionSection}

Also identify specific chapters where erosion accelerated (if any).

Return ONLY valid JSON:
{
  "possibility_space": "WIDE|MODERATE|NARROW|COLLAPSED",
  "suppressed_evidence_exposure": "NONE|PROXIMITY_WARNING|EXPOSURE_RISK",
  "self_deception_coherence": "FULL_STRENGTH|THINNING|COMPROMISED" or null,
  "erosion_chapters": [number],
  "analysis": "string explaining the assessment"
}

Do NOT include any text outside the JSON object.`;
}

// ── Parse & Validate ────────────────────────────────────────────────────

function extractJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1].trim());
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) return JSON.parse(braceMatch[0]);
    throw new Error("No valid JSON found in response");
  }
}

function validateResponse(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (!d.possibility_space || !d.suppressed_evidence_exposure) return false;
  const validPS: string[] = ["WIDE", "MODERATE", "NARROW", "COLLAPSED"];
  const validSEE: string[] = ["NONE", "PROXIMITY_WARNING", "EXPOSURE_RISK"];
  if (!validPS.includes(d.possibility_space as string)) return false;
  if (!validSEE.includes(d.suppressed_evidence_exposure as string)) return false;
  return true;
}

// ── Composite Status Calculation ────────────────────────────────────────

function calculateCompositeStatus(
  ps: PossibilitySpace,
  see: SuppressedEvidenceExposure,
  sdc: SelfDeceptionCoherence | null,
): MEICompositeStatus {
  // CRITICAL: possibility space COLLAPSED or self-deception COMPROMISED
  if (ps === "COLLAPSED") return "CRITICAL";
  if (sdc === "COMPROMISED") return "CRITICAL";

  // Count degraded dimensions
  let degradedCount = 0;
  if (ps === "NARROW") degradedCount++;
  if (see === "EXPOSURE_RISK") degradedCount++;
  if (sdc === "THINNING") degradedCount++;

  // Also count moderate degradations
  let warningCount = 0;
  if (ps === "MODERATE") warningCount++;
  if (see === "PROXIMITY_WARNING") warningCount++;

  if (degradedCount >= 2) return "RED";
  if (degradedCount >= 1) return "AMBER";
  if (warningCount >= 2) return "AMBER";
  return "GREEN";
}

// ── Main Function ───────────────────────────────────────────────────────

export interface MEIInput {
  triggerChapter: number;
  misdirectionMap: string;
  approvedChaptersSummary: string;
  twistMode: TwistMode;
  revelationChapter: number;
}

const MAX_RETRIES = 2;

export async function runMEI(input: MEIInput): Promise<MEIResult> {
  const systemPrompt = buildSystemPrompt(input.twistMode, input.misdirectionMap);
  const fullPrompt = `${systemPrompt}\n\n--- APPROVED CHAPTERS SUMMARY (last 10) ---\n\n${input.approvedChaptersSummary}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callWithFallback("misdirection_erosion_check", fullPrompt, {
        temperature: 0.2,
        max_tokens: 1500,
      });

      const parsed = extractJSON(response.content);
      if (!validateResponse(parsed)) {
        throw new Error("Schema validation failed — response does not match MEI schema");
      }

      return assembleResult(parsed as Record<string, unknown>, input);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[MEI] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);
    }
  }

  throw new Error(`[MEI] All ${MAX_RETRIES + 1} attempts failed. Last error: ${lastError?.message}`);
}

// ── Result Assembly ─────────────────────────────────────────────────────

function assembleResult(
  data: Record<string, unknown>,
  input: MEIInput,
): MEIResult {
  const flags: MEIFlag[] = [];

  const possibilitySpace = data.possibility_space as PossibilitySpace;
  const suppressedEvidenceExposure = data.suppressed_evidence_exposure as SuppressedEvidenceExposure;

  let selfDeceptionCoherence: SelfDeceptionCoherence | null = null;
  if ((input.twistMode === "FULL" || input.twistMode === "DUAL") && data.self_deception_coherence) {
    selfDeceptionCoherence = data.self_deception_coherence as SelfDeceptionCoherence;
  }

  const erosionChapters = (data.erosion_chapters as number[]) ?? [];
  const analysis = (data.analysis as string) ?? "";

  const compositeStatus = calculateCompositeStatus(
    possibilitySpace,
    suppressedEvidenceExposure,
    selfDeceptionCoherence,
  );

  // ── Flag generation ──

  if (possibilitySpace === "COLLAPSED") {
    flags.push({
      code: "MEI_POSSIBILITY_COLLAPSED",
      severity: "CRITICAL",
      message: "Twist architecture has collapsed. The false interpretation is no longer credible. Generation blocked until misdirection is rebuilt.",
      chapter_citations: erosionChapters,
    });
  } else if (possibilitySpace === "NARROW") {
    flags.push({
      code: "MEI_POSSIBILITY_NARROW",
      severity: "WARNING",
      message: "Possibility space is narrowing. The false interpretation is weakening.",
      chapter_citations: erosionChapters,
    });
  }

  if (suppressedEvidenceExposure === "EXPOSURE_RISK") {
    flags.push({
      code: "MEI_EVIDENCE_EXPOSED",
      severity: "WARNING",
      message: "Suppressed evidence has been partially surfaced. Risk of premature revelation.",
      chapter_citations: erosionChapters,
    });
  } else if (suppressedEvidenceExposure === "PROXIMITY_WARNING") {
    flags.push({
      code: "MEI_EVIDENCE_PROXIMITY",
      severity: "NOTE",
      message: "Suppressed evidence narrowly avoided surfacing in recent chapters.",
    });
  }

  if (selfDeceptionCoherence === "COMPROMISED") {
    flags.push({
      code: "MEI_SELF_DECEPTION_COMPROMISED",
      severity: "CRITICAL",
      message: "Narrator's self-deception is no longer structurally believable. Generation blocked until coherence is restored.",
      chapter_citations: erosionChapters,
    });
  } else if (selfDeceptionCoherence === "THINNING") {
    flags.push({
      code: "MEI_SELF_DECEPTION_THINNING",
      severity: "WARNING",
      message: "Narrator's self-deception is thinning. Cracks are appearing.",
    });
  }

  if (compositeStatus === "RED") {
    flags.push({
      code: "MEI_RED",
      severity: "WARNING",
      message: `MEI status RED — two dimensions degraded. Editorial intervention required. Erosion accelerated at chapters: ${erosionChapters.join(", ") || "unknown"}.`,
      chapter_citations: erosionChapters,
    });
  }

  const actionRequired = compositeStatus === "RED" || compositeStatus === "CRITICAL";

  return {
    trigger_chapter: input.triggerChapter,
    possibility_space: possibilitySpace,
    suppressed_evidence_exposure: suppressedEvidenceExposure,
    self_deception_coherence: selfDeceptionCoherence,
    composite_status: compositeStatus,
    action_required: actionRequired,
    erosion_chapters: erosionChapters,
    analysis,
    flags,
  };
}

// ── Generation Block Check ──────────────────────────────────────────────

/**
 * Returns true if MEI status blocks generation.
 * CRITICAL status = hard block. Generation must not proceed.
 */
export function meiBlocksGeneration(result: MEIResult): boolean {
  return result.composite_status === "CRITICAL";
}

// ── Console exposure ────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_mei = {
    runMEI,
    shouldRunMEI,
    meiBlocksGeneration,
  };
}
