/**
 * Anti-AI Detector — Two-pass cross-model AI tell detection.
 * GHOSTLY v2.2 · Session 21
 *
 * Primary: Gemini Flash (anti_ai_detection) — 5 per-chapter tells · weight 0.12
 * Secondary: Claude Sonnet (anti_ai_detection_secondary) — self-detection · Prose DNA injected · weight 0.06
 * Combined weight: 0.18 in quality gate composite.
 *
 * NO Prose DNA on primary pass. Prose DNA on secondary pass only.
 */

import { callWithFallback } from "@/api/llmRouter";
import { TELL_SUPPRESSION_BLOCK } from "@/constants/PROSE_DNA_RUNTIME";

// ── Types ───────────────────────────────────────────────────────────────

export type TellSeverity = "CRITICAL" | "WARNING" | "NOTE";

export interface GenreTell {
  tell_id: string;
  category: string;
  description: string;
  severity: TellSeverity;
  line_reference?: string;
  excerpt?: string;
}

export interface PrimaryPassResult {
  rhythm_uniformity: { detected: boolean; score: number; details: string };
  lexical_overreach: { detected: boolean; score: number; details: string };
  structural_completeness: { detected: boolean; score: number; details: string };
  hedging_constructions: { detected: boolean; count: number; details: string };
  emotional_explanation: { detected: boolean; score: number; details: string };
  tells: GenreTell[];
  primary_score: number;
}

export interface SecondaryPassResult {
  prose_dna_compliance_feels_manufactured: boolean;
  ai_sentence_openings: { detected: boolean; count: number; examples: string[] };
  register_manufactured: boolean;
  tells: GenreTell[];
  secondary_score: number;
}

export interface AntiAIDetectorResult {
  chapter_number: number;
  primary: PrimaryPassResult;
  secondary: SecondaryPassResult;
  primary_score: number;
  secondary_score: number;
  combined_score: number;
  tells_detected: GenreTell[];
  systematic_tell_flag: boolean;
  flags: AntiAIFlag[];
}

export interface AntiAIFlag {
  code: string;
  severity: TellSeverity;
  message: string;
}

// ── Primary Pass Prompt (Gemini Flash) ──────────────────────────────────

function buildPrimaryPrompt(
  chapterContent: string,
  chapterNumber: number,
  rhythmUniformFlagged?: boolean,
): string {
  const rhythmNote = rhythmUniformFlagged
    ? "\nNOTE: The Line Editor has already flagged RHYTHM_UNIFORM on this chapter. Factor this into your rhythm uniformity assessment."
    : "";

  return `You are an AI-text detection specialist for commercial fiction. Analyze this chapter for 5 AI tells:

1. RHYTHM UNIFORMITY: Do sentences follow predictable length patterns? Human prose varies dramatically. AI prose tends toward uniform mid-length sentences.${rhythmNote}

2. LEXICAL OVER-REACH: Does vocabulary exceed the narrator's established register? First-person unreliable narrators use limited, consistent vocabulary. AI inflates register.

3. STRUCTURAL COMPLETENESS: Does the chapter resolve every tension it opens? AI tends toward artificial tidiness — real chapters leave threads open.

4. HEDGING CONSTRUCTIONS: Count "seemed to", "appeared to", "as if", "almost as though" patterns. AI hedges to avoid committing to concrete action.

5. EMOTIONAL EXPLANATION: Does the narrator explain their emotional state rather than rendering it physically? (e.g. "I felt anxious" vs "My fingers wouldn't stop tapping")

Score each tell 0–10 (10 = fully human, no AI tell detected).

Return ONLY valid JSON:
{
  "rhythm_uniformity": { "detected": boolean, "score": number, "details": string },
  "lexical_overreach": { "detected": boolean, "score": number, "details": string },
  "structural_completeness": { "detected": boolean, "score": number, "details": string },
  "hedging_constructions": { "detected": boolean, "count": number, "details": string },
  "emotional_explanation": { "detected": boolean, "score": number, "details": string },
  "tells": [{ "tell_id": string, "category": string, "description": string, "severity": "CRITICAL"|"WARNING"|"NOTE", "line_reference": string, "excerpt": string }],
  "primary_score": number
}

Do NOT include any text outside the JSON object.

--- CHAPTER ${chapterNumber} CONTENT ---

${chapterContent}`;
}

// ── Secondary Pass Prompt (Claude Sonnet — Prose DNA injected by router) ──

function buildSecondaryPrompt(
  chapterContent: string,
  chapterNumber: number,
): string {
  return `You are performing AI self-detection on this chapter. You are Claude — evaluate whether this prose feels generated-to-spec rather than inhabited by a human voice.

Check for:

1. PROSE DNA COMPLIANCE FEELS MANUFACTURED: Does the prose feel like it was written to satisfy a checklist of rules rather than flowing naturally? Mark true if compliance feels mechanical.

2. AI SENTENCE OPENINGS: Check for AI-typical patterns:
   - Starting sentences with gerunds ("Walking to the door, she...")
   - Starting with "She/He/They" in identical syntactic structures
   - Repetitive sentence construction patterns
   Count instances and provide examples.

3. REGISTER MANUFACTURED: Does the prose voice feel calibrated and synthetic rather than natural and specific? A human writer has idiosyncratic habits; AI prose is conspicuously well-balanced.

Return ONLY valid JSON:
{
  "prose_dna_compliance_feels_manufactured": boolean,
  "ai_sentence_openings": { "detected": boolean, "count": number, "examples": [string] },
  "register_manufactured": boolean,
  "tells": [{ "tell_id": string, "category": string, "description": string, "severity": "CRITICAL"|"WARNING"|"NOTE" }],
  "secondary_score": number
}

Score 0–10 (10 = fully human, no AI tells detected).

Do NOT include any text outside the JSON object.

--- CHAPTER ${chapterNumber} CONTENT ---

${chapterContent}`;
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
    throw new Error("No valid JSON found in Anti-AI Detector response");
  }
}

// ── Main Function ───────────────────────────────────────────────────────

export interface AntiAIDetectorInput {
  chapterNumber: number;
  chapterContent: string;
  rhythmUniformFlagged?: boolean;
  /** Previous chapter tell IDs for systematic detection */
  previousChapterTells?: string[][];
}

const MAX_RETRIES = 2;

export async function runAntiAIDetector(
  input: AntiAIDetectorInput,
): Promise<AntiAIDetectorResult> {
  // Run both passes in parallel — they are independent
  const [primaryResult, secondaryResult] = await Promise.all([
    runPrimaryPass(input),
    runSecondaryPass(input),
  ]);

  // Merge tells
  const allTells = [...primaryResult.tells, ...secondaryResult.tells];

  // Systematic tell detection: same tell firing 3+ consecutive chapters
  const systematicTellFlag = detectSystematicTells(allTells, input.previousChapterTells);

  // Combined score: primary weight 0.12/0.18 ≈ 0.667, secondary 0.06/0.18 ≈ 0.333
  const combinedScore = Math.max(0, Math.min(10,
    Math.round((primaryResult.primary_score * 0.667 + secondaryResult.secondary_score * 0.333) * 10) / 10
  ));

  const flags: AntiAIFlag[] = [];

  if (combinedScore < 5) {
    flags.push({
      code: "AI_DETECTION_HIGH",
      severity: "CRITICAL",
      message: `Anti-AI combined score ${combinedScore}/10 — prose reads as AI-generated.`,
    });
  }

  if (systematicTellFlag) {
    flags.push({
      code: "SYSTEMATIC_TELL_PATTERN",
      severity: "WARNING",
      message: `Same AI tell detected across 3+ consecutive chapters — systematic pattern requires intervention.`,
    });
  }

  if (secondaryResult.register_manufactured) {
    flags.push({
      code: "REGISTER_MANUFACTURED",
      severity: "WARNING",
      message: `Prose voice feels calibrated/synthetic rather than natural — register manufactured.`,
    });
  }

  return {
    chapter_number: input.chapterNumber,
    primary: primaryResult,
    secondary: secondaryResult,
    primary_score: primaryResult.primary_score,
    secondary_score: secondaryResult.secondary_score,
    combined_score: combinedScore,
    tells_detected: allTells,
    systematic_tell_flag: systematicTellFlag,
    flags,
  };
}

// ── Primary Pass (Gemini Flash) ─────────────────────────────────────────

async function runPrimaryPass(input: AntiAIDetectorInput): Promise<PrimaryPassResult> {
  const prompt = buildPrimaryPrompt(input.chapterContent, input.chapterNumber, input.rhythmUniformFlagged);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callWithFallback("anti_ai_detection", prompt, {
        temperature: 0.2,
        max_tokens: 2500,
      });
      const parsed = extractJSON(response.content) as Record<string, unknown>;
      if (!parsed.rhythm_uniformity || !parsed.primary_score === undefined) {
        throw new Error("Primary pass schema validation failed");
      }
      return parsed as unknown as PrimaryPassResult;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[AntiAI-Primary] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);
    }
  }

  throw new Error(`[AntiAI-Primary] All attempts failed. Last error: ${lastError?.message}`);
}

// ── Secondary Pass (Claude Sonnet — Prose DNA injected by router) ───────

async function runSecondaryPass(input: AntiAIDetectorInput): Promise<SecondaryPassResult> {
  const prompt = buildSecondaryPrompt(input.chapterContent, input.chapterNumber);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callWithFallback("anti_ai_detection_secondary", prompt, {
        temperature: 0.2,
        max_tokens: 2000,
      });
      const parsed = extractJSON(response.content) as Record<string, unknown>;
      if (parsed.secondary_score === undefined) {
        throw new Error("Secondary pass schema validation failed");
      }
      return parsed as unknown as SecondaryPassResult;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[AntiAI-Secondary] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);
    }
  }

  throw new Error(`[AntiAI-Secondary] All attempts failed. Last error: ${lastError?.message}`);
}

// ── Systematic Tell Detection ───────────────────────────────────────────

function detectSystematicTells(
  currentTells: GenreTell[],
  previousChapterTells?: string[][],
): boolean {
  if (!previousChapterTells || previousChapterTells.length < 2) return false;

  const currentTellIds = new Set(currentTells.map(t => t.tell_id));

  // Check the last 2 chapters — if the same tell appears in all 3 (current + 2 prev), systematic
  const prev1 = new Set(previousChapterTells[previousChapterTells.length - 1] ?? []);
  const prev2 = new Set(previousChapterTells[previousChapterTells.length - 2] ?? []);

  for (const tellId of currentTellIds) {
    if (prev1.has(tellId) && prev2.has(tellId)) {
      console.warn(`[AntiAI] Systematic tell detected: "${tellId}" across 3 consecutive chapters`);
      return true;
    }
  }

  return false;
}

// ── Console exposure ────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_antiAIDetector = {
    runAntiAIDetector,
  };
}
