/**
 * Twist Integrity Tracker — Protects twist architecture pre-revelation.
 * GHOSTLY v2.2 · Session 22
 *
 * Runs every chapter where chapter_number < revelation_chapter.
 * Skipped for twist_architecture: none.
 * FULL mode: unreliable narrator (external + self-deception checks).
 * EXTERNAL mode: reliable narrator with active misdirection (external checks only).
 *
 * Uses Gemini Flash via callWithFallback('quality_analysis', ...) — NO Prose DNA.
 */

import { callWithFallback } from "@/api/llmRouter";

// ── Types ───────────────────────────────────────────────────────────────

export type TwistMode = "FULL" | "EXTERNAL" | "DUAL";
export type TwistVerdict = "PROTECTED" | "AT_RISK" | "BREACHED";
export type ExternalMisdirectionStatus = "HOLDING" | "WEAKENING" | "COLLAPSED";
export type SelfDeceptionStatus = "ACTIVE" | "PASSIVE" | "SURFACED" | "NOT_APPLICABLE";

export interface TwistViolation {
  type: string;
  severity: "CRITICAL" | "WARNING";
  text_excerpt: string;
  revision_instruction: string;
}

export interface RevelationArchitecture {
  active: boolean;
  clean_truth_sentence_present: boolean;
  backward_flash_count: number;
  backward_flash_chapter_refs: number[];
  immediate_emotional_cost: boolean;
  thematic_coherence: boolean;
}

export interface TwistIntegrityResult {
  active: boolean;
  chapter_number: number;
  mode: TwistMode;
  verdict: TwistVerdict;
  external_misdirection_status: ExternalMisdirectionStatus;
  self_deception_status: SelfDeceptionStatus;
  twist_dimension_delivered: boolean;
  violations: TwistViolation[];
  revelation_architecture: RevelationArchitecture;
  analysis: string;
  flags: TwistIntegrityFlag[];
}

export interface TwistIntegrityFlag {
  code: string;
  severity: "CRITICAL" | "WARNING" | "NOTE";
  message: string;
}

export interface TwistIntegrityInput {
  chapterNumber: number;
  chapterContent: string;
  misdirectionMap: string;
  mode: TwistMode;
  revelationChapter: number;
  twistArchitecture: string; // "active" | "none"
}

// ── Should Run Check ────────────────────────────────────────────────────

export function shouldRunTwistIntegrity(input: TwistIntegrityInput): boolean {
  if (input.twistArchitecture === "none") return false;
  return true; // runs on every chapter — pre-revelation and revelation
}

// ── Pre-Revelation Prompt ───────────────────────────────────────────────

function buildPreRevelationPrompt(input: TwistIntegrityInput): string {
  const selfDeceptionSection = (input.mode === "FULL" || input.mode === "DUAL")
    ? `SELF-DECEPTION CHECKS (FULL mode):
7. Is the narrator maintaining self_deception_active — believing their own false interpretation?
8. Is the narrator successfully deflecting from suppressed_evidence — actively not-looking at key information?
9. No accidental truth surfacing — the narrator doesn't accidentally reveal what they're suppressing?
10. Is narrator_deception_gesture present and specific — a visible, concrete behaviour that demonstrates the self-deception operating?

self_deception_status:
- ACTIVE: self-deception operating as designed
- PASSIVE: self-deception present but not actively demonstrated
- SURFACED: truth has accidentally leaked through self-deception`
    : `SELF-DECEPTION: Not applicable for EXTERNAL mode. Return self_deception_status: "NOT_APPLICABLE".`;

  return `You are a twist integrity analyst for a psychological thriller. Evaluate whether the twist architecture is protected in this chapter.

MISDIRECTION MAP:
${input.misdirectionMap}

EXTERNAL MISDIRECTION CHECKS (all modes):
1. Does any event, dialogue, or behaviour point at TWIST_TRUTH rather than FALSE_INTERPRETATION?
2. Does any character react in a way only logical if they know TWIST_TRUTH?
3. Can a careful reader reconstruct TWIST_TRUTH from information in this chapter alone?
4. Is sustaining_evidence for the current act's reader belief being reinforced or inadvertently eroded?
5. Is the declared MISDIRECTION_TYPE mechanism actively operating or passive?
6. Is misdirection operating on the declared TWIST_DIMENSION?

external_misdirection_status:
- HOLDING: misdirection intact, false interpretation sustained
- WEAKENING: cracks visible, but false interpretation still plausible
- COLLAPSED: truth is effectively known or strongly implied

${selfDeceptionSection}

Identify violations as specific excerpts with revision instructions.

Return ONLY valid JSON:
{
  "external_misdirection_status": "HOLDING"|"WEAKENING"|"COLLAPSED",
  "self_deception_status": "ACTIVE"|"PASSIVE"|"SURFACED"|"NOT_APPLICABLE",
  "violations": [{ "type": string, "severity": "CRITICAL"|"WARNING", "text_excerpt": string, "revision_instruction": string }],
  "analysis": string
}

--- CHAPTER ${input.chapterNumber} CONTENT ---

${input.chapterContent}`;
}

// ── Revelation Chapter Prompt ───────────────────────────────────────────

function buildRevelationPrompt(input: TwistIntegrityInput): string {
  return `You are a revelation architecture analyst for a psychological thriller. This is the REVELATION CHAPTER (Chapter ${input.chapterNumber}).

MISDIRECTION MAP:
${input.misdirectionMap}

Evaluate the revelation architecture:
1. CLEAN TRUTH SENTENCE: Is there a single, clear sentence that states the truth without ambiguity or hedging? Not explanation — just the truth, landing clean.
2. BACKWARD FLASH SEQUENCE: Are there minimum 2 moments where the reader is pulled back to earlier scenes that now mean something different? Each should reference a specific earlier chapter or scene.
3. IMMEDIATE EMOTIONAL COST: Does the revelation produce immediate physical/emotional impact rendered through body/sensation (R1 compliant — show don't tell)? Not "she felt devastated" but physical rendering.
4. THEMATIC COHERENCE: Does the revelation deliver the THEMATIC_CORE meaning, not just a plot fact? The twist should mean something beyond surprise.

Also check if the TWIST_DIMENSION (IDENTITY/MOTIVE/METHOD/TEMPORAL) is actually delivered.

Return ONLY valid JSON:
{
  "clean_truth_sentence_present": boolean,
  "backward_flash_count": number,
  "backward_flash_chapter_refs": [number],
  "immediate_emotional_cost": boolean,
  "thematic_coherence": boolean,
  "twist_dimension_delivered": boolean,
  "violations": [{ "type": string, "severity": "CRITICAL"|"WARNING", "text_excerpt": string, "revision_instruction": string }],
  "analysis": string
}

--- CHAPTER ${input.chapterNumber} CONTENT ---

${input.chapterContent}`;
}

// ── Parse ───────────────────────────────────────────────────────────────

function extractJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1].trim());
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) return JSON.parse(braceMatch[0]);
    throw new Error("No valid JSON found in twist integrity response");
  }
}

// ── Main Function ───────────────────────────────────────────────────────

const MAX_RETRIES = 2;

export async function runTwistIntegrityCheck(
  input: TwistIntegrityInput,
): Promise<TwistIntegrityResult> {
  if (!shouldRunTwistIntegrity(input)) {
    return inactiveResult(input);
  }

  const isRevelationChapter = input.chapterNumber === input.revelationChapter;

  if (isRevelationChapter) {
    return runRevelationCheck(input);
  }

  // Pre-revelation check
  if (input.chapterNumber > input.revelationChapter) {
    // Post-revelation — no twist integrity needed
    return inactiveResult(input);
  }

  return runPreRevelationCheck(input);
}

// ── Pre-Revelation Check ────────────────────────────────────────────────

async function runPreRevelationCheck(
  input: TwistIntegrityInput,
): Promise<TwistIntegrityResult> {
  const prompt = buildPreRevelationPrompt(input);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callWithFallback("quality_analysis", prompt, {
        temperature: 0.2,
        max_tokens: 2000,
      });
      const parsed = extractJSON(response.content) as Record<string, unknown>;
      return assemblePreRevelationResult(parsed, input);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[TwistIntegrity] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);
    }
  }

  throw new Error(`[TwistIntegrity] All ${MAX_RETRIES + 1} attempts failed. Last error: ${lastError?.message}`);
}

// ── Revelation Check ────────────────────────────────────────────────────

async function runRevelationCheck(
  input: TwistIntegrityInput,
): Promise<TwistIntegrityResult> {
  const prompt = buildRevelationPrompt(input);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callWithFallback("quality_analysis", prompt, {
        temperature: 0.2,
        max_tokens: 2000,
      });
      const parsed = extractJSON(response.content) as Record<string, unknown>;
      return assembleRevelationResult(parsed, input);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[TwistIntegrity-Revelation] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);
    }
  }

  throw new Error(`[TwistIntegrity-Revelation] All ${MAX_RETRIES + 1} attempts failed. Last error: ${lastError?.message}`);
}

// ── Result Assembly ─────────────────────────────────────────────────────

function assemblePreRevelationResult(
  parsed: Record<string, unknown>,
  input: TwistIntegrityInput,
): TwistIntegrityResult {
  const externalStatus = (parsed.external_misdirection_status as ExternalMisdirectionStatus) ?? "HOLDING";
  const selfDeceptionStatus = (parsed.self_deception_status as SelfDeceptionStatus) ?? "NOT_APPLICABLE";
  const violations = (parsed.violations as TwistViolation[]) ?? [];
  const analysis = (parsed.analysis as string) ?? "";
  const flags: TwistIntegrityFlag[] = [];

  // Determine verdict
  let verdict: TwistVerdict = "PROTECTED";

  if (externalStatus === "COLLAPSED" || selfDeceptionStatus === "SURFACED") {
    verdict = "BREACHED";
  } else if (externalStatus === "WEAKENING" || selfDeceptionStatus === "PASSIVE") {
    verdict = "AT_RISK";
  }

  // Check for CRITICAL violations
  const hasCritical = violations.some(v => v.severity === "CRITICAL");
  if (hasCritical) verdict = "BREACHED";

  // Flags
  if (verdict === "BREACHED") {
    flags.push({
      code: "TWIST_INTEGRITY_BREACHED",
      severity: "CRITICAL",
      message: `Twist integrity BREACHED at Chapter ${input.chapterNumber}. Generation must not proceed — misdirection has failed.`,
    });
  } else if (verdict === "AT_RISK") {
    flags.push({
      code: "TWIST_INTEGRITY_AT_RISK",
      severity: "WARNING",
      message: `Twist integrity AT RISK at Chapter ${input.chapterNumber}. ${externalStatus === "WEAKENING" ? "External misdirection weakening." : ""} ${selfDeceptionStatus === "PASSIVE" ? "Self-deception passive." : ""}`.trim(),
    });
  }

  return {
    active: true,
    chapter_number: input.chapterNumber,
    mode: input.mode,
    verdict,
    external_misdirection_status: externalStatus,
    self_deception_status: selfDeceptionStatus,
    twist_dimension_delivered: false, // only relevant for revelation chapter
    violations,
    revelation_architecture: {
      active: false,
      clean_truth_sentence_present: false,
      backward_flash_count: 0,
      backward_flash_chapter_refs: [],
      immediate_emotional_cost: false,
      thematic_coherence: false,
    },
    analysis,
    flags,
  };
}

function assembleRevelationResult(
  parsed: Record<string, unknown>,
  input: TwistIntegrityInput,
): TwistIntegrityResult {
  const violations = (parsed.violations as TwistViolation[]) ?? [];
  const analysis = (parsed.analysis as string) ?? "";
  const cleanTruth = (parsed.clean_truth_sentence_present as boolean) ?? false;
  const backwardFlashCount = (parsed.backward_flash_count as number) ?? 0;
  const backwardFlashRefs = (parsed.backward_flash_chapter_refs as number[]) ?? [];
  const emotionalCost = (parsed.immediate_emotional_cost as boolean) ?? false;
  const thematicCoherence = (parsed.thematic_coherence as boolean) ?? false;
  const twistDimensionDelivered = (parsed.twist_dimension_delivered as boolean) ?? false;
  const flags: TwistIntegrityFlag[] = [];

  // Revelation verdict
  let verdict: TwistVerdict = "PROTECTED";
  const hasCritical = violations.some(v => v.severity === "CRITICAL");

  if (!cleanTruth) {
    flags.push({
      code: "REVELATION_NO_CLEAN_TRUTH",
      severity: "CRITICAL",
      message: "Revelation chapter missing clean truth sentence (R17).",
    });
    verdict = "BREACHED";
  }

  if (backwardFlashCount < 2) {
    flags.push({
      code: "REVELATION_INSUFFICIENT_BACKWARD_FLASH",
      severity: "CRITICAL",
      message: `Revelation chapter has ${backwardFlashCount} backward flashes (minimum 2 required by R17).`,
    });
    verdict = "BREACHED";
  }

  if (!emotionalCost) {
    flags.push({
      code: "REVELATION_NO_EMOTIONAL_COST",
      severity: "WARNING",
      message: "Revelation chapter lacks immediate emotional cost rendered physically (R1 + R17).",
    });
    if (verdict === "PROTECTED") verdict = "AT_RISK";
  }

  if (!thematicCoherence) {
    flags.push({
      code: "REVELATION_NO_THEMATIC_COHERENCE",
      severity: "WARNING",
      message: "Revelation delivers plot fact but misses THEMATIC_CORE meaning.",
    });
  }

  if (hasCritical) verdict = "BREACHED";

  return {
    active: true,
    chapter_number: input.chapterNumber,
    mode: input.mode,
    verdict,
    external_misdirection_status: "HOLDING", // not assessed at revelation
    self_deception_status: "NOT_APPLICABLE", // self-deception should resolve at revelation
    twist_dimension_delivered: twistDimensionDelivered,
    violations,
    revelation_architecture: {
      active: true,
      clean_truth_sentence_present: cleanTruth,
      backward_flash_count: backwardFlashCount,
      backward_flash_chapter_refs: backwardFlashRefs,
      immediate_emotional_cost: emotionalCost,
      thematic_coherence: thematicCoherence,
    },
    analysis,
    flags,
  };
}

function inactiveResult(input: TwistIntegrityInput): TwistIntegrityResult {
  return {
    active: false,
    chapter_number: input.chapterNumber,
    mode: input.mode,
    verdict: "PROTECTED",
    external_misdirection_status: "HOLDING",
    self_deception_status: "NOT_APPLICABLE",
    twist_dimension_delivered: false,
    violations: [],
    revelation_architecture: {
      active: false,
      clean_truth_sentence_present: false,
      backward_flash_count: 0,
      backward_flash_chapter_refs: [],
      immediate_emotional_cost: false,
      thematic_coherence: false,
    },
    analysis: "",
    flags: [],
  };
}

// ── Console exposure ────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_twistIntegrityTracker = {
    runTwistIntegrityCheck,
    shouldRunTwistIntegrity,
  };
}
