/**
 * Genre-Specific AI Tell Detection — Second layer within Anti-AI Detector.
 * GHOSTLY v2.2 · Session 22
 *
 * 5 per-chapter tells + 2 manuscript-interval tells (every 10 chapters).
 * All tells are score modifiers within combined Anti-AI score — not separate weights.
 * Uses Gemini Flash via callWithFallback('anti_ai_detection', ...) — NO Prose DNA.
 */

import { callWithFallback } from "@/api/llmRouter";
import type { GenreTell } from "./antiAIDetector";

// ── Types ───────────────────────────────────────────────────────────────

export interface GenreTellResult {
  per_chapter_tells: PerChapterTellResult;
  manuscript_interval_tells: ManuscriptIntervalTellResult;
  tells: GenreTell[];
  genre_tell_score_modifier: number; // negative modifier to apply to combined score
}

export interface PerChapterTellResult {
  medical_procedure_accuracy: { detected: boolean; description: string };
  pacing_tell: { detected: boolean; description: string };
  unreliable_narrator_flatness: { detected: boolean; description: string };
  institutional_detail_vagueness: { detected: boolean; description: string };
  revelation_architecture_pattern: { detected: boolean; description: string };
}

export interface ManuscriptIntervalTellResult {
  ran: boolean;
  register_plateau: { detected: boolean; description: string } | null;
  subtext_erosion: { detected: boolean; description: string } | null;
}

export interface GenreTellDetectionInput {
  chapterNumber: number;
  chapterContent: string;
  /** For manuscript-interval tells: summaries of earlier chapters */
  earlierChaptersSummary?: string;
}

// ── Per-Chapter Tell Prompt ─────────────────────────────────────────────

function buildPerChapterPrompt(chapterContent: string, chapterNumber: number): string {
  return `You are a genre-specific AI tell detector for psychological thrillers. Analyze this chapter for 5 genre tells that indicate AI-generated prose:

1. MEDICAL PROCEDURE ACCURACY: Is medical detail specific enough to be authentic, or generic enough to be fabricated? Generic = tell. Look for vague descriptions of procedures, medications, or clinical settings that lack specificity.

2. PSYCHOLOGICAL THRILLER PACING TELL: Does the chapter end with an explicit summary of stakes instead of a mid-breath hook? AI tendency to close loops rather than open them. A proper chapter ending leaves the reader mid-breath.

3. UNRELIABLE NARRATOR FLATNESS: Is the narrator's unreliability described rather than performed? AI tells the reader the narrator is unreliable instead of showing it operating. The narrator should demonstrate unreliability through selective attention and contradiction, not announce it.

4. INSTITUTIONAL DETAIL VAGUENESS: Are hospital/police/legal settings described in generic terms that could apply to any institution in any country? Specific institutions have specific procedures, layouts, terminology.

5. REVELATION ARCHITECTURE AI PATTERNS: Do revelation scenes explain the twist rather than letting it land? Over-explicit "and that's when she realised" pattern. (R1 + R17 violation)

For each tell, mark detected: true/false and explain.

Return ONLY valid JSON:
{
  "medical_procedure_accuracy": { "detected": boolean, "description": string },
  "pacing_tell": { "detected": boolean, "description": string },
  "unreliable_narrator_flatness": { "detected": boolean, "description": string },
  "institutional_detail_vagueness": { "detected": boolean, "description": string },
  "revelation_architecture_pattern": { "detected": boolean, "description": string }
}

--- CHAPTER ${chapterNumber} CONTENT ---

${chapterContent}`;
}

// ── Manuscript-Interval Tell Prompt ─────────────────────────────────────

function buildManuscriptIntervalPrompt(
  chapterContent: string,
  chapterNumber: number,
  earlierChaptersSummary: string,
): string {
  return `You are a manuscript-level AI tell detector for psychological thrillers. Analyze voice consistency across the manuscript at chapter ${chapterNumber}.

1. REGISTER PLATEAU: Has the protagonist's clinical-dissociative register remained static across 30+ chapters? Early manuscript register should evolve — gaining cracks, shifts under pressure, moments of breakthrough — while maintaining the core voice. If the register at chapter ${chapterNumber} is indistinguishable from chapter 1, that's an AI tell.

2. SUBTEXT EROSION: Has dialogue become progressively more on-the-nose across the manuscript? Early chapters should have real subtext; if later chapters explain it instead, that's an AI tell. Compare dialogue indirection in early vs recent chapters.

Return ONLY valid JSON:
{
  "register_plateau": { "detected": boolean, "description": string },
  "subtext_erosion": { "detected": boolean, "description": string }
}

--- EARLIER CHAPTERS SUMMARY ---

${earlierChaptersSummary}

--- CURRENT CHAPTER ${chapterNumber} CONTENT ---

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
    throw new Error("No valid JSON found in genre tell response");
  }
}

// ── Main Function ───────────────────────────────────────────────────────

const MAX_RETRIES = 2;

export async function runGenreTellDetection(
  input: GenreTellDetectionInput,
): Promise<GenreTellResult> {
  const tells: GenreTell[] = [];

  // 1. Per-chapter tells (always run)
  const perChapter = await runPerChapterTells(input);

  // 2. Manuscript-interval tells (every 10 chapters, starting at 30)
  const shouldRunInterval = input.chapterNumber >= 30 && input.chapterNumber % 10 === 0;
  const intervalResult = shouldRunInterval && input.earlierChaptersSummary
    ? await runManuscriptIntervalTells(input)
    : { ran: false, register_plateau: null, subtext_erosion: null };

  // ── Build tells array ──
  const perChapterFields: Array<{ key: keyof PerChapterTellResult; tellId: string; category: string }> = [
    { key: "medical_procedure_accuracy", tellId: "GENRE_MEDICAL_GENERIC", category: "Medical procedure accuracy" },
    { key: "pacing_tell", tellId: "GENRE_PACING_CLOSED", category: "Pacing tell — loop closure" },
    { key: "unreliable_narrator_flatness", tellId: "GENRE_NARRATOR_FLAT", category: "Unreliable narrator flatness" },
    { key: "institutional_detail_vagueness", tellId: "GENRE_INSTITUTIONAL_VAGUE", category: "Institutional detail vagueness" },
    { key: "revelation_architecture_pattern", tellId: "GENRE_REVELATION_EXPLICIT", category: "Revelation architecture AI pattern" },
  ];

  for (const { key, tellId, category } of perChapterFields) {
    const field = perChapter[key];
    if (field.detected) {
      tells.push({
        tell_id: tellId,
        category,
        description: field.description,
        severity: "WARNING",
      });
    }
  }

  if (intervalResult.ran) {
    if (intervalResult.register_plateau?.detected) {
      tells.push({
        tell_id: "GENRE_REGISTER_PLATEAU",
        category: "Register plateau",
        description: intervalResult.register_plateau.description,
        severity: "WARNING",
      });
    }
    if (intervalResult.subtext_erosion?.detected) {
      tells.push({
        tell_id: "GENRE_SUBTEXT_EROSION",
        category: "Subtext erosion",
        description: intervalResult.subtext_erosion.description,
        severity: "WARNING",
      });
    }
  }

  // Score modifier: -0.5 per tell detected
  const genreTellScoreModifier = tells.length * -0.5;

  return {
    per_chapter_tells: perChapter,
    manuscript_interval_tells: intervalResult,
    tells,
    genre_tell_score_modifier: genreTellScoreModifier,
  };
}

// ── Per-Chapter Pass ────────────────────────────────────────────────────

async function runPerChapterTells(
  input: GenreTellDetectionInput,
): Promise<PerChapterTellResult> {
  const prompt = buildPerChapterPrompt(input.chapterContent, input.chapterNumber);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callWithFallback("anti_ai_detection", prompt, {
        temperature: 0.2,
        max_tokens: 1500,
      });
      const parsed = extractJSON(response.content) as Record<string, unknown>;
      if (!parsed.medical_procedure_accuracy) {
        throw new Error("Genre tell per-chapter schema validation failed");
      }
      return parsed as unknown as PerChapterTellResult;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[GenreTell-PerChapter] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);
    }
  }

  // Graceful fallback — return no detections
  console.warn(`[GenreTell-PerChapter] All attempts failed, returning clean result. Last error: ${lastError?.message}`);
  return {
    medical_procedure_accuracy: { detected: false, description: "Check failed" },
    pacing_tell: { detected: false, description: "Check failed" },
    unreliable_narrator_flatness: { detected: false, description: "Check failed" },
    institutional_detail_vagueness: { detected: false, description: "Check failed" },
    revelation_architecture_pattern: { detected: false, description: "Check failed" },
  };
}

// ── Manuscript-Interval Pass ────────────────────────────────────────────

async function runManuscriptIntervalTells(
  input: GenreTellDetectionInput,
): Promise<ManuscriptIntervalTellResult> {
  const prompt = buildManuscriptIntervalPrompt(
    input.chapterContent,
    input.chapterNumber,
    input.earlierChaptersSummary ?? "",
  );
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callWithFallback("anti_ai_detection", prompt, {
        temperature: 0.2,
        max_tokens: 1000,
      });
      const parsed = extractJSON(response.content) as Record<string, unknown>;
      return {
        ran: true,
        register_plateau: parsed.register_plateau as ManuscriptIntervalTellResult["register_plateau"],
        subtext_erosion: parsed.subtext_erosion as ManuscriptIntervalTellResult["subtext_erosion"],
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[GenreTell-Interval] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);
    }
  }

  console.warn(`[GenreTell-Interval] All attempts failed. Last error: ${lastError?.message}`);
  return { ran: true, register_plateau: null, subtext_erosion: null };
}

// ── Console exposure ────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_genreTellDetection = {
    runGenreTellDetection,
  };
}
