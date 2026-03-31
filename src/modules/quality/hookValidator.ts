/**
 * Hook Validator — R7 compliance: every chapter ends mid-breath.
 * GHOSTLY v2.2 · Session 22
 *
 * Validates hook type delivered, compulsion score, hook_seed delivery.
 * Uses Gemini Flash via callWithFallback('quality_analysis', ...) — NO Prose DNA.
 */

import { callWithFallback } from "@/api/llmRouter";

// ── Types ───────────────────────────────────────────────────────────────

export type HookType = "REVELATION" | "THREAT" | "DECISION" | "THE_LIE" | "NEW_QUESTION" | "NONE";

export interface HookValidationResult {
  chapter_number: number;
  hook_type_target: HookType;
  hook_type_delivered: HookType;
  hook_type_match: boolean;
  hook_compulsion_score: number;
  hook_seed_delivered: boolean;
  analysis: string;
  flags: HookFlag[];
}

export interface HookFlag {
  code: string;
  severity: "CRITICAL" | "WARNING" | "NOTE";
  message: string;
}

export interface HookValidatorInput {
  chapterNumber: number;
  chapterContent: string;
  hookTypeTarget: HookType;
  hookSeed?: string;
}

// ── Prompt ──────────────────────────────────────────────────────────────

function buildPrompt(
  chapterContent: string,
  chapterNumber: number,
  hookSeed?: string,
): string {
  const seedNote = hookSeed
    ? `\n\nHOOK SEED (specific image/detail that should appear at chapter end): "${hookSeed}"\nDoes this specific image/detail appear in the chapter ending? Mark hook_seed_delivered accordingly.`
    : "";

  return `You are a hook validator for a psychological thriller. The brand mandate: every chapter ends mid-breath on one of five hook types.

The five hook types:
1. REVELATION — a new fact changes the reader's understanding
2. THREAT — danger is imminent or escalated
3. DECISION — the protagonist faces an impossible choice
4. THE_LIE — the narrator's unreliability surfaces or deepens
5. NEW_QUESTION — an open loop the reader must close

Analyze the final 200 words of this chapter. Identify:
1. Which hook type (if any) is delivered. NONE if the chapter resolves/closes rather than hooks.
2. Hook compulsion score (1–10): would a reader NEED to start the next chapter?
   1 = chapter ends with resolution, no forward pull
   5 = mild curiosity but reader could put the book down
   8 = strong compulsion, reader likely to continue
   10 = impossible to stop reading${seedNote}

Return ONLY valid JSON:
{
  "hook_type_delivered": "REVELATION"|"THREAT"|"DECISION"|"THE_LIE"|"NEW_QUESTION"|"NONE",
  "hook_compulsion_score": number,
  "hook_seed_delivered": boolean,
  "analysis": string
}

--- CHAPTER ${chapterNumber} CONTENT ---

${chapterContent}`;
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
    throw new Error("No valid JSON found in hook validator response");
  }
}

// ── Main Function ───────────────────────────────────────────────────────

const MAX_RETRIES = 2;

export async function validateHook(
  input: HookValidatorInput,
): Promise<HookValidationResult> {
  const prompt = buildPrompt(input.chapterContent, input.chapterNumber, input.hookSeed);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callWithFallback("quality_analysis", prompt, {
        temperature: 0.2,
        max_tokens: 800,
      });
      const parsed = extractJSON(response.content) as Record<string, unknown>;

      const validTypes: HookType[] = ["REVELATION", "THREAT", "DECISION", "THE_LIE", "NEW_QUESTION", "NONE"];
      if (!validTypes.includes(parsed.hook_type_delivered as HookType)) {
        throw new Error(`Invalid hook_type_delivered: ${parsed.hook_type_delivered}`);
      }

      return assembleResult(parsed, input);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[HookValidator] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);
    }
  }

  throw new Error(`[HookValidator] All ${MAX_RETRIES + 1} attempts failed. Last error: ${lastError?.message}`);
}

// ── Result Assembly ─────────────────────────────────────────────────────

function assembleResult(
  parsed: Record<string, unknown>,
  input: HookValidatorInput,
): HookValidationResult {
  const hookTypeDelivered = parsed.hook_type_delivered as HookType;
  const hookCompulsionScore = Math.max(1, Math.min(10,
    Math.round(Number(parsed.hook_compulsion_score) * 10) / 10,
  ));
  const hookSeedDelivered = (parsed.hook_seed_delivered as boolean) ?? false;
  const analysis = (parsed.analysis as string) ?? "";
  const hookTypeMatch = hookTypeDelivered === input.hookTypeTarget;
  const flags: HookFlag[] = [];

  if (hookTypeDelivered === "NONE") {
    flags.push({
      code: "HOOK_MISSING",
      severity: "CRITICAL",
      message: "No hook detected at chapter end. R7 violation — every chapter must end mid-breath.",
    });
  } else if (!hookTypeMatch) {
    flags.push({
      code: "HOOK_TYPE_MISMATCH",
      severity: "WARNING",
      message: `Hook type mismatch: expected ${input.hookTypeTarget}, delivered ${hookTypeDelivered}.`,
    });
  }

  if (hookCompulsionScore < 5) {
    flags.push({
      code: "HOOK_WEAK",
      severity: "WARNING",
      message: `Hook compulsion score ${hookCompulsionScore}/10 — reader may not continue.`,
    });
  }

  if (input.hookSeed && !hookSeedDelivered) {
    flags.push({
      code: "HOOK_SEED_MISSING",
      severity: "NOTE",
      message: `Hook seed "${input.hookSeed}" not delivered in chapter ending.`,
    });
  }

  return {
    chapter_number: input.chapterNumber,
    hook_type_target: input.hookTypeTarget,
    hook_type_delivered: hookTypeDelivered,
    hook_type_match: hookTypeMatch,
    hook_compulsion_score: hookCompulsionScore,
    hook_seed_delivered: hookSeedDelivered,
    analysis,
    flags,
  };
}

// ── Console exposure ────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_hookValidator = {
    validateHook,
  };
}
