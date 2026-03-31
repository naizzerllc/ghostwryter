/**
 * Tension Meter — Measures delivered tension against outline target.
 * GHOSTLY v2.2 · Session 22
 *
 * Uses Gemini Flash via callWithFallback('quality_analysis', ...) — NO Prose DNA.
 */

import { callWithFallback } from "@/api/llmRouter";

// ── Types ───────────────────────────────────────────────────────────────

export interface TensionResult {
  chapter_number: number;
  tension_score_target: number;
  tension_score_actual: number;
  tension_gap: number;
  analysis: string;
  flags: TensionFlag[];
}

export interface TensionFlag {
  code: string;
  severity: "CRITICAL" | "WARNING" | "NOTE";
  message: string;
}

export interface TensionMeterInput {
  chapterNumber: number;
  chapterContent: string;
  tensionScoreTarget: number;
}

// ── Prompt ──────────────────────────────────────────────────────────────

function buildPrompt(chapterContent: string, chapterNumber: number): string {
  return `You are a tension analyst for a psychological thriller. Evaluate the delivered tension level in this chapter on a 1–10 scale.

Consider:
- Immediate physical or psychological threat present
- Time pressure / urgency / deadline
- Interpersonal conflict actively occurring
- Information withheld from protagonist (dramatic irony)
- Stakes clarity — what the protagonist stands to lose
- Pacing — does the prose accelerate or plateau?
- Compulsion — would a reader start the next chapter?

Score 1 = no tension at all (exposition, backstory dump)
Score 5 = moderate tension (conflict present but no urgency)
Score 8 = high tension (active threat, time pressure, immediate stakes)
Score 10 = maximum tension (peak crisis, no escape, reader cannot stop)

Return ONLY valid JSON:
{
  "tension_score_actual": number,
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
    throw new Error("No valid JSON found in tension meter response");
  }
}

// ── Main Function ───────────────────────────────────────────────────────

const MAX_RETRIES = 2;

export async function measureTension(
  input: TensionMeterInput,
): Promise<TensionResult> {
  const prompt = buildPrompt(input.chapterContent, input.chapterNumber);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callWithFallback("quality_analysis", prompt, {
        temperature: 0.2,
        max_tokens: 800,
      });
      const parsed = extractJSON(response.content) as Record<string, unknown>;
      const tensionActual = Number(parsed.tension_score_actual);
      if (isNaN(tensionActual)) {
        throw new Error("tension_score_actual is not a number");
      }

      return assembleResult(tensionActual, parsed.analysis as string ?? "", input);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[TensionMeter] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);
    }
  }

  throw new Error(`[TensionMeter] All ${MAX_RETRIES + 1} attempts failed. Last error: ${lastError?.message}`);
}

// ── Result Assembly ─────────────────────────────────────────────────────

function assembleResult(
  tensionActual: number,
  analysis: string,
  input: TensionMeterInput,
): TensionResult {
  const clampedActual = Math.max(1, Math.min(10, Math.round(tensionActual * 10) / 10));
  const gap = clampedActual - input.tensionScoreTarget;
  const flags: TensionFlag[] = [];

  if (clampedActual < input.tensionScoreTarget - 2.0) {
    flags.push({
      code: "TENSION_UNDERDELIVERED",
      severity: "WARNING",
      message: `Tension underdelivered: actual ${clampedActual} vs target ${input.tensionScoreTarget} (gap: ${gap.toFixed(1)}).`,
    });
  }

  return {
    chapter_number: input.chapterNumber,
    tension_score_target: input.tensionScoreTarget,
    tension_score_actual: clampedActual,
    tension_gap: Math.round(gap * 10) / 10,
    analysis,
    flags,
  };
}

// ── Console exposure ────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_tensionMeter = {
    measureTension,
  };
}
