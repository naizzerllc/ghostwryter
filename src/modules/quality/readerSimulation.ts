/**
 * Reader Simulation — Highest-weight quality module (0.32).
 * GHOSTLY v2.2 · Session 21
 *
 * Architecture: STATELESS — each call is a single user message to OpenAI GPT-4o.
 * No prior messages. No conversation history. Reader persona injected as system prompt.
 * Uses callWithFallback('reader_simulation', ...) — NO Prose DNA.
 */

import { callWithFallback } from "@/api/llmRouter";

// ── Types ───────────────────────────────────────────────────────────────

export type ReaderInformationMode = "AHEAD" | "WITH" | "BEHIND" | "MYSTERY";

export interface HookCompulsionAnalysis {
  would_continue: boolean;
  score: number;
  reasoning: string;
}

export interface ProtagonistSympathyCheck {
  engagement_maintained: boolean;
  protagonist_active: boolean;
  sympathy_score: number;
  reasoning: string;
}

export interface EntryAssessment {
  pulls_reader_in: boolean;
  entry_compulsion_score: number;
  strengths: string[];
  weaknesses: string[];
}

export interface PrologueEpilogueLoopCheck {
  loop_pays_off: boolean;
  tension_deflated: boolean;
  explanation: string;
}

export interface ReaderInformationModeCheck {
  delivered_mode: ReaderInformationMode;
  intended_mode?: ReaderInformationMode;
  mode_mismatch: boolean;
  ahead_mystery_lag: boolean;
  explanation: string;
}

export interface SympathyCurveRecord {
  chapter_number: number;
  sympathy_score: number;
  protagonist_active: boolean;
}

export interface ReaderSimulationFlag {
  code: string;
  severity: "CRITICAL" | "WARNING" | "NOTE";
  message: string;
}

export interface ReaderSimulationResult {
  chapter_number: number;
  hook_compulsion: HookCompulsionAnalysis;
  protagonist_sympathy: ProtagonistSympathyCheck;
  entry_assessment: EntryAssessment;
  prologue_epilogue_loop?: PrologueEpilogueLoopCheck;
  information_mode: ReaderInformationModeCheck;
  sympathy_curve_record: SympathyCurveRecord;
  flags: ReaderSimulationFlag[];
  score: number;
}

export interface SampleReadResult {
  acquisition_decision: "YES" | "MARGINAL" | "NO";
  reasons: string[];
  strongest_element: string;
  weakest_element: string;
  recommendation: string;
}

// ── Reader Persona (from leila_rex_default) ─────────────────────────────

const READER_PERSONA_SYSTEM_PROMPT = `You are a pacing-intolerant binge reader. You read psychological thrillers in sessions of 4–6 chapters. You abandon slow chapter openings. You have high unreliable-narrator tolerance — you enjoy not knowing who to trust. You have low protagonist-passivity tolerance. You are actively trying to spot the twist. The chapter must end mid-breath or you stop reading. Evaluate this chapter from your perspective as this reader. Do not evaluate as a literary critic — evaluate as this specific reader.`;

// ── System Prompt Builder ───────────────────────────────────────────────

function buildUserPrompt(
  chapterContent: string,
  chapterNumber: number,
  isPrologueEpilogue: boolean,
  intendedInformationMode?: ReaderInformationMode,
): string {
  const modeSection = intendedInformationMode
    ? `\nINTENDED READER INFORMATION MODE: ${intendedInformationMode}\nCheck if the chapter delivers this mode or mismatches.`
    : "";

  const loopSection = isPrologueEpilogue
    ? `\nThis is a prologue/epilogue chapter. Also evaluate the PROLOGUE_EPILOGUE_LOOP: does the loop pay off or deflate tension?`
    : "";

  return `Evaluate this chapter as the reader described in your system prompt.

CHAPTER ${chapterNumber}:
${modeSection}${loopSection}

Perform ALL checks:

1. HOOK COMPULSION: Would you continue to the next chapter? Score 1–10. Why or why not?

2. PROTAGONIST SYMPATHY: Do you maintain engagement with the protagonist? Is she active enough? Score 1–10.

3. ENTRY ASSESSMENT: Does the opening pull you in within the first 500 words? Score 1–10 (entry_compulsion_score).

4. READER INFORMATION MODE: What is your epistemic position?
   - AHEAD: you know more than protagonist
   - WITH: you and protagonist know the same
   - BEHIND: you know less than protagonist
   - MYSTERY: you don't know what protagonist knows
${intendedInformationMode ? `   Compare against intended mode: ${intendedInformationMode}` : ""}
${isPrologueEpilogue ? "\n5. PROLOGUE/EPILOGUE LOOP: Does the loop pay off or deflate tension?" : ""}

Return ONLY valid JSON:
{
  "hook_compulsion": { "would_continue": boolean, "score": number, "reasoning": string },
  "protagonist_sympathy": { "engagement_maintained": boolean, "protagonist_active": boolean, "sympathy_score": number, "reasoning": string },
  "entry_assessment": { "pulls_reader_in": boolean, "entry_compulsion_score": number, "strengths": [string], "weaknesses": [string] },
  "information_mode": { "delivered_mode": "AHEAD"|"WITH"|"BEHIND"|"MYSTERY", "mode_mismatch": boolean, "ahead_mystery_lag": boolean, "explanation": string }${isPrologueEpilogue ? ',\n  "prologue_epilogue_loop": { "loop_pays_off": boolean, "tension_deflated": boolean, "explanation": string }' : ""}
}

Do NOT include any text outside the JSON object.

--- CHAPTER CONTENT ---

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
    throw new Error("No valid JSON found in Reader Simulation response");
  }
}

function validateResponse(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return !!(d.hook_compulsion && d.protagonist_sympathy && d.entry_assessment && d.information_mode);
}

// ── Main Function ───────────────────────────────────────────────────────

export interface ReaderSimulationInput {
  chapterNumber: number;
  chapterContent: string;
  isPrologueEpilogue?: boolean;
  intendedInformationMode?: ReaderInformationMode;
  optimismOffset?: number; // reader_sim_optimism_offset from project config
}

const MAX_RETRIES = 2;

export async function runReaderSimulation(
  input: ReaderSimulationInput
): Promise<ReaderSimulationResult> {
  const userPrompt = buildUserPrompt(
    input.chapterContent,
    input.chapterNumber,
    input.isPrologueEpilogue ?? false,
    input.intendedInformationMode,
  );

  // STATELESS: Single user message only. System prompt carries reader persona.
  // No prior messages array. No conversation history.
  const fullPrompt = `${READER_PERSONA_SYSTEM_PROMPT}\n\n${userPrompt}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callWithFallback("reader_simulation", fullPrompt, {
        temperature: 0.4,
        max_tokens: 2500,
      });
      const parsed = extractJSON(response.content);
      if (!validateResponse(parsed)) {
        throw new Error("Schema validation failed — response does not match ReaderSimulation schema");
      }
      return assembleResult(parsed as Record<string, unknown>, input);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[ReaderSimulation] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);
    }
  }

  throw new Error(`[ReaderSimulation] All ${MAX_RETRIES + 1} attempts failed. Last error: ${lastError?.message}`);
}

// ── Result Assembly ─────────────────────────────────────────────────────

function assembleResult(
  data: Record<string, unknown>,
  input: ReaderSimulationInput,
): ReaderSimulationResult {
  const flags: ReaderSimulationFlag[] = [];

  // ── Hook Compulsion ──
  const hcRaw = data.hook_compulsion as Record<string, unknown>;
  const hookCompulsion: HookCompulsionAnalysis = {
    would_continue: (hcRaw.would_continue as boolean) ?? false,
    score: (hcRaw.score as number) ?? 5,
    reasoning: (hcRaw.reasoning as string) ?? "",
  };

  if (!hookCompulsion.would_continue) {
    flags.push({
      code: "HOOK_FAIL",
      severity: "CRITICAL",
      message: `Reader would NOT continue to the next chapter. Hook compulsion: ${hookCompulsion.score}/10.`,
    });
  }

  // ── Protagonist Sympathy ──
  const psRaw = data.protagonist_sympathy as Record<string, unknown>;
  const protagonistSympathy: ProtagonistSympathyCheck = {
    engagement_maintained: (psRaw.engagement_maintained as boolean) ?? true,
    protagonist_active: (psRaw.protagonist_active as boolean) ?? true,
    sympathy_score: (psRaw.sympathy_score as number) ?? 5,
    reasoning: (psRaw.reasoning as string) ?? "",
  };

  if (!protagonistSympathy.protagonist_active) {
    flags.push({
      code: "PROTAGONIST_PASSIVE",
      severity: "WARNING",
      message: `Protagonist is passive — this reader has low passivity tolerance.`,
    });
  }

  // ── Entry Assessment ──
  const eaRaw = data.entry_assessment as Record<string, unknown>;
  const entryAssessment: EntryAssessment = {
    pulls_reader_in: (eaRaw.pulls_reader_in as boolean) ?? true,
    entry_compulsion_score: (eaRaw.entry_compulsion_score as number) ?? 5,
    strengths: (eaRaw.strengths as string[]) ?? [],
    weaknesses: (eaRaw.weaknesses as string[]) ?? [],
  };

  if (entryAssessment.entry_compulsion_score < 5) {
    flags.push({
      code: "WEAK_OPENING",
      severity: "WARNING",
      message: `Chapter opening scores ${entryAssessment.entry_compulsion_score}/10 — this reader abandons slow openings.`,
    });
  }

  // ── Information Mode ──
  const imRaw = data.information_mode as Record<string, unknown>;
  const informationMode: ReaderInformationModeCheck = {
    delivered_mode: (imRaw.delivered_mode as ReaderInformationMode) ?? "WITH",
    intended_mode: input.intendedInformationMode,
    mode_mismatch: (imRaw.mode_mismatch as boolean) ?? false,
    ahead_mystery_lag: (imRaw.ahead_mystery_lag as boolean) ?? false,
    explanation: (imRaw.explanation as string) ?? "",
  };

  if (informationMode.mode_mismatch) {
    flags.push({
      code: "MODE_MISMATCH",
      severity: "WARNING",
      message: `Reader information mode mismatch: intended ${informationMode.intended_mode}, delivered ${informationMode.delivered_mode}.`,
    });
  }

  if (informationMode.ahead_mystery_lag) {
    flags.push({
      code: "AHEAD_MYSTERY_LAG",
      severity: "NOTE",
      message: `Reader is AHEAD of protagonist in a mystery chapter — collapses tension.`,
    });
  }

  // ── Prologue/Epilogue Loop ──
  let prologueEpilogueLoop: PrologueEpilogueLoopCheck | undefined;
  if (data.prologue_epilogue_loop) {
    const plRaw = data.prologue_epilogue_loop as Record<string, unknown>;
    prologueEpilogueLoop = {
      loop_pays_off: (plRaw.loop_pays_off as boolean) ?? true,
      tension_deflated: (plRaw.tension_deflated as boolean) ?? false,
      explanation: (plRaw.explanation as string) ?? "",
    };
    if (prologueEpilogueLoop.tension_deflated) {
      flags.push({
        code: "LOOP_TENSION_DEFLATED",
        severity: "WARNING",
        message: `Prologue/epilogue loop deflates tension.`,
      });
    }
  }

  // ── Sympathy Curve Record ──
  const sympathyCurveRecord: SympathyCurveRecord = {
    chapter_number: input.chapterNumber,
    sympathy_score: protagonistSympathy.sympathy_score,
    protagonist_active: protagonistSympathy.protagonist_active,
  };

  // ── Composite Score ──
  // Weight breakdown: hook (0.35), entry (0.25), sympathy (0.25), info mode (0.15)
  const hookScore = hookCompulsion.score;
  const entryScore = entryAssessment.entry_compulsion_score;
  const sympathyScore = protagonistSympathy.sympathy_score;
  const modeScore = informationMode.mode_mismatch ? 5 : (informationMode.ahead_mystery_lag ? 6 : 9);

  let rawScore = hookScore * 0.35 + entryScore * 0.25 + sympathyScore * 0.25 + modeScore * 0.15;

  // Apply optimism offset if configured
  if (input.optimismOffset) {
    rawScore -= input.optimismOffset;
    console.log(`[ReaderSimulation] Applied optimism offset: -${input.optimismOffset}`);
  }

  const score = Math.max(0, Math.min(10, Math.round(rawScore * 10) / 10));

  return {
    chapter_number: input.chapterNumber,
    hook_compulsion: hookCompulsion,
    protagonist_sympathy: protagonistSympathy,
    entry_assessment: entryAssessment,
    prologue_epilogue_loop: prologueEpilogueLoop,
    information_mode: informationMode,
    sympathy_curve_record: sympathyCurveRecord,
    flags,
    score,
  };
}

// ── Sample Read Gate ────────────────────────────────────────────────────

/**
 * Runs once after Chapters 1, 2, and 3 are all approved.
 * Sends prologue + ch1 + ch2 as a single continuous block — still stateless.
 * Editorial intelligence, not a gate — does not block generation.
 */
export async function runSampleReadGate(
  sampleContent: string,
): Promise<SampleReadResult> {
  const userPrompt = `You are about to decide whether to buy this book based on this sample. Does this sample make the Leila Rex target reader — the pacing-intolerant binge reader who actively tries to spot the twist — buy the book?

Evaluate the sample as a whole:
- Would this reader purchase and continue reading?
- What is the strongest element pulling the reader in?
- What is the weakest element that might cause hesitation?

Return ONLY valid JSON:
{
  "acquisition_decision": "YES"|"MARGINAL"|"NO",
  "reasons": [string],
  "strongest_element": string,
  "weakest_element": string,
  "recommendation": string
}

Do NOT include any text outside the JSON object.

--- SAMPLE CONTENT ---

${sampleContent}`;

  const fullPrompt = `${READER_PERSONA_SYSTEM_PROMPT}\n\n${userPrompt}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callWithFallback("reader_simulation", fullPrompt, {
        temperature: 0.3,
        max_tokens: 1500,
      });
      const parsed = extractJSON(response.content) as Record<string, unknown>;
      if (!parsed.acquisition_decision) {
        throw new Error("Missing acquisition_decision in Sample Read Gate response");
      }
      return {
        acquisition_decision: parsed.acquisition_decision as "YES" | "MARGINAL" | "NO",
        reasons: (parsed.reasons as string[]) ?? [],
        strongest_element: (parsed.strongest_element as string) ?? "",
        weakest_element: (parsed.weakest_element as string) ?? "",
        recommendation: (parsed.recommendation as string) ?? "",
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[SampleReadGate] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);
    }
  }

  throw new Error(`[SampleReadGate] All ${MAX_RETRIES + 1} attempts failed. Last error: ${lastError?.message}`);
}

// ── Console exposure ────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_readerSimulation = {
    runReaderSimulation,
    runSampleReadGate,
  };
}
