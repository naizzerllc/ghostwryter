/**
 * Line Editor — Prose quality analysis module.
 * GHOSTLY v2.2 · Session 19
 *
 * Checks: cut test, sentence rhythm, backstory dumps, Prose DNA compliance,
 * forbidden words integration.
 * Uses Gemini Flash via callWithFallback('quality_analysis', ...) — NO Prose DNA.
 * Output: structured JSON (LineEditorResult).
 */

import { callWithFallback } from "@/api/llmRouter";
import type { ForbiddenWordsResult } from "@/utils/forbiddenWordsChecker";

// ── Types ───────────────────────────────────────────────────────────────

export type LineFlagSeverity = "CRITICAL" | "WARNING" | "NOTE";

export interface LineEditorFlag {
  code: string;
  severity: LineFlagSeverity;
  message: string;
  instruction?: string;
}

export interface CutTestScan {
  cuttable_percentage: number;
  cuttable_count: number;
  total_sentences: number;
  worst_offenders: string[];
  score: number;
}

export interface SentenceRhythmCheck {
  rhythm_uniformity_score: number;
  rhythm_variance_score: number;
  dominant_length_band: string;
  sentence_lengths: number[];
  score: number;
}

export interface BackstoryDumpInstance {
  location: string;
  word_count: number;
  compression_instruction: string;
  excerpt: string;
}

export interface BackstoryDumpCheck {
  backstory_dump_instances: BackstoryDumpInstance[];
  total_backstory_words: number;
}

export interface ProseDnaViolation {
  rule: string;
  description: string;
  line_reference: string;
}

export interface ProseDnaCompliance {
  r1_show_dont_tell: { compliant: boolean; violations: string[] };
  r3_rhythm_modulation: { compliant: boolean; note: string };
  r14_non_visual_senses: { compliant: boolean; senses_found: string[]; count: number };
  violations: ProseDnaViolation[];
}

export interface LineEditorResult {
  chapter_number: number;
  cut_test_scan: CutTestScan;
  sentence_rhythm_check: SentenceRhythmCheck;
  backstory_dump_check: BackstoryDumpCheck;
  prose_dna_compliance: ProseDnaCompliance;
  forbidden_words_score_impact: number;
  flags: LineEditorFlag[];
  score: number;
}

// ── System Prompt ───────────────────────────────────────────────────────

const LINE_EDITOR_SYSTEM_PROMPT = `You are a line editor for commercial psychological thrillers. Analyze the prose quality at the sentence level.

Perform ALL of these checks:

1. CUT TEST SCAN (R11):
Estimate the percentage of sentences that would NOT be missed if cut. These are filler, padding, unnecessary transitions, or sentences that restate what the reader already knows.
- Identify the worst offenders (up to 5 sentences).
- Score: 10 = perfectly lean (0% cuttable), 0 = heavily padded (50%+ cuttable).
- Flag CUT_TEST_PADDED WARNING if > 30% of sentences are cuttable.

2. SENTENCE RHYTHM CHECK (R3):
Analyze sentence lengths (word counts). Calculate:
- rhythm_uniformity_score: percentage of sentences falling within a 5-word band (e.g. all 12–17 words)
- rhythm_variance_score: standard deviation of sentence lengths
- dominant_length_band: the most common 5-word band (e.g. "12-17")
- sentence_lengths: array of word counts for each sentence
- Score: 10 = rich variance, 0 = robotic uniformity
- Flag RHYTHM_UNIFORM WARNING if > 60% of sentences fall in the same length band. This is the deepest AI writing tell in sustained prose.

3. BACKSTORY DUMP CHECK:
Identify blocks of history/exposition NOT embedded in present action.
For each instance provide:
- location: paragraph/sentence reference
- word_count: approximate length
- compression_instruction: "Compress to a single specific image that contains this history. Replace the explanation with the image."
- excerpt: first 20 words of the dump
Flag BACKSTORY_DUMP WARNING per instance.

4. PROSE DNA COMPLIANCE:
- R1 (Show don't tell): Is any emotion named directly in narration? (not dialogue)
- R3 (Rhythm modulation): Is there sentence length variation as tension changes?
- R14 (Non-visual senses): Are at least two non-visual senses present? (touch, sound, smell, taste)
Flag specific violations with line references.

Return ONLY valid JSON:
{
  "cut_test_scan": {
    "cuttable_percentage": number,
    "cuttable_count": number,
    "total_sentences": number,
    "worst_offenders": [string],
    "score": number
  },
  "sentence_rhythm_check": {
    "rhythm_uniformity_score": number,
    "rhythm_variance_score": number,
    "dominant_length_band": string,
    "sentence_lengths": [number],
    "score": number
  },
  "backstory_dump_check": {
    "backstory_dump_instances": [
      {
        "location": string,
        "word_count": number,
        "compression_instruction": string,
        "excerpt": string
      }
    ],
    "total_backstory_words": number
  },
  "prose_dna_compliance": {
    "r1_show_dont_tell": { "compliant": boolean, "violations": [string] },
    "r3_rhythm_modulation": { "compliant": boolean, "note": string },
    "r14_non_visual_senses": { "compliant": boolean, "senses_found": [string], "count": number },
    "violations": [{ "rule": string, "description": string, "line_reference": string }]
  }
}

Do NOT include any text outside the JSON object.`;

// ── Parse & Validate ────────────────────────────────────────────────────

function extractJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      return JSON.parse(braceMatch[0]);
    }
    throw new Error("No valid JSON found in response");
  }
}

function validateLineEditorResponse(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (!d.cut_test_scan || !d.sentence_rhythm_check || !d.backstory_dump_check || !d.prose_dna_compliance) {
    return false;
  }
  const cts = d.cut_test_scan as Record<string, unknown>;
  if (typeof cts.cuttable_percentage !== "number" || typeof cts.score !== "number") return false;
  const src = d.sentence_rhythm_check as Record<string, unknown>;
  if (typeof src.rhythm_uniformity_score !== "number") return false;
  return true;
}

// ── Main Function ───────────────────────────────────────────────────────

export interface LineEditorInput {
  chapterNumber: number;
  chapterContent: string;
  forbiddenWordsResult: ForbiddenWordsResult;
}

const MAX_RETRIES = 2;

export async function runLineEditor(
  input: LineEditorInput
): Promise<LineEditorResult> {
  const fullPrompt = `${LINE_EDITOR_SYSTEM_PROMPT}\n\n--- CHAPTER CONTENT ---\n\n${input.chapterContent}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callWithFallback("quality_analysis", fullPrompt, {
        temperature: 0.2,
        max_tokens: 3000,
      });

      const parsed = extractJSON(response.content);

      if (!validateLineEditorResponse(parsed)) {
        throw new Error("Schema validation failed — response does not match LineEditor schema");
      }

      const data = parsed as Record<string, unknown>;
      return assembleResult(data, input);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `[LineEditor] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`,
        lastError.message
      );
    }
  }

  throw new Error(
    `[LineEditor] All ${MAX_RETRIES + 1} attempts failed. Last error: ${lastError?.message}`
  );
}

// ── Result Assembly ─────────────────────────────────────────────────────

function assembleResult(
  data: Record<string, unknown>,
  input: LineEditorInput
): LineEditorResult {
  const flags: LineEditorFlag[] = [];
  let score = 10;

  // ── Cut Test ──
  const ctsRaw = data.cut_test_scan as Record<string, unknown>;
  const cutTestScan: CutTestScan = {
    cuttable_percentage: (ctsRaw.cuttable_percentage as number) ?? 0,
    cuttable_count: (ctsRaw.cuttable_count as number) ?? 0,
    total_sentences: (ctsRaw.total_sentences as number) ?? 0,
    worst_offenders: (ctsRaw.worst_offenders as string[]) ?? [],
    score: (ctsRaw.score as number) ?? 10,
  };

  if (cutTestScan.cuttable_percentage > 30) {
    flags.push({
      code: "CUT_TEST_PADDED",
      severity: "WARNING",
      message: `${cutTestScan.cuttable_percentage.toFixed(0)}% of sentences are cuttable. Prose is padded.`,
      instruction: "Remove or compress sentences that restate known information, provide unnecessary transitions, or serve no narrative function.",
    });
  }

  // ── Sentence Rhythm ──
  const srcRaw = data.sentence_rhythm_check as Record<string, unknown>;
  const sentenceRhythmCheck: SentenceRhythmCheck = {
    rhythm_uniformity_score: (srcRaw.rhythm_uniformity_score as number) ?? 0,
    rhythm_variance_score: (srcRaw.rhythm_variance_score as number) ?? 0,
    dominant_length_band: (srcRaw.dominant_length_band as string) ?? "",
    sentence_lengths: (srcRaw.sentence_lengths as number[]) ?? [],
    score: (srcRaw.score as number) ?? 10,
  };

  if (sentenceRhythmCheck.rhythm_uniformity_score > 60) {
    flags.push({
      code: "RHYTHM_UNIFORM",
      severity: "WARNING",
      message: `${sentenceRhythmCheck.rhythm_uniformity_score.toFixed(0)}% of sentences fall in the ${sentenceRhythmCheck.dominant_length_band} word band. This is the deepest AI writing tell in sustained prose.`,
      instruction: "Vary sentence lengths deliberately. Short sentences for tension. Long sentences for immersion. Break the pattern.",
    });
  }

  // ── Backstory Dumps ──
  const bdcRaw = data.backstory_dump_check as Record<string, unknown>;
  const backstoryInstances = (bdcRaw.backstory_dump_instances as BackstoryDumpInstance[]) ?? [];
  const backstoryDumpCheck: BackstoryDumpCheck = {
    backstory_dump_instances: backstoryInstances,
    total_backstory_words: (bdcRaw.total_backstory_words as number) ?? 0,
  };

  for (const instance of backstoryInstances) {
    flags.push({
      code: "BACKSTORY_DUMP",
      severity: "WARNING",
      message: `Backstory dump at ${instance.location} (${instance.word_count} words): "${instance.excerpt}..."`,
      instruction: instance.compression_instruction || "Compress to a single specific image that contains this history. Replace the explanation with the image.",
    });
  }

  // ── Prose DNA Compliance ──
  const pdcRaw = data.prose_dna_compliance as Record<string, unknown>;
  const r1Raw = (pdcRaw.r1_show_dont_tell as Record<string, unknown>) ?? { compliant: true, violations: [] };
  const r3Raw = (pdcRaw.r3_rhythm_modulation as Record<string, unknown>) ?? { compliant: true, note: "" };
  const r14Raw = (pdcRaw.r14_non_visual_senses as Record<string, unknown>) ?? { compliant: true, senses_found: [], count: 0 };
  const violationsRaw = (pdcRaw.violations as ProseDnaViolation[]) ?? [];

  const proseDnaCompliance: ProseDnaCompliance = {
    r1_show_dont_tell: {
      compliant: (r1Raw.compliant as boolean) ?? true,
      violations: (r1Raw.violations as string[]) ?? [],
    },
    r3_rhythm_modulation: {
      compliant: (r3Raw.compliant as boolean) ?? true,
      note: (r3Raw.note as string) ?? "",
    },
    r14_non_visual_senses: {
      compliant: (r14Raw.compliant as boolean) ?? true,
      senses_found: (r14Raw.senses_found as string[]) ?? [],
      count: (r14Raw.count as number) ?? 0,
    },
    violations: violationsRaw,
  };

  if (!proseDnaCompliance.r1_show_dont_tell.compliant) {
    flags.push({
      code: "PROSE_DNA_R1",
      severity: "WARNING",
      message: "Emotion named directly in narration (R1 Show Don't Tell violation).",
    });
  }

  if (!proseDnaCompliance.r14_non_visual_senses.compliant) {
    flags.push({
      code: "PROSE_DNA_R14",
      severity: "WARNING",
      message: `Only ${proseDnaCompliance.r14_non_visual_senses.count} non-visual sense(s) found. R14 requires minimum 2.`,
    });
  }

  // ── Forbidden Words Integration ──
  const fwResult = input.forbiddenWordsResult;
  let forbiddenWordsImpact = 0;
  if (fwResult.hardBanCount > 0) {
    forbiddenWordsImpact += fwResult.hardBanCount * 0.3;
  }
  if (fwResult.violations.length > 0) {
    forbiddenWordsImpact += Math.min(fwResult.violations.length * 0.1, 1.0);
  }

  // ── Composite Score ──
  // Weight: rhythm (0.30), cut test (0.25), backstory (0.20), prose dna (0.15), forbidden (0.10)
  const rhythmScore = sentenceRhythmCheck.score;
  const cutScore = cutTestScan.score;
  const backstoryScore = backstoryInstances.length === 0 ? 10 : Math.max(0, 10 - backstoryInstances.length * 2);
  const dnaScore = violationsRaw.length === 0 ? 10 : Math.max(0, 10 - violationsRaw.length * 1.5);
  const fwScore = Math.max(0, 10 - forbiddenWordsImpact * 10);

  score = (
    rhythmScore * 0.30 +
    cutScore * 0.25 +
    backstoryScore * 0.20 +
    dnaScore * 0.15 +
    fwScore * 0.10
  );

  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));

  return {
    chapter_number: input.chapterNumber,
    cut_test_scan: cutTestScan,
    sentence_rhythm_check: sentenceRhythmCheck,
    backstory_dump_check: backstoryDumpCheck,
    prose_dna_compliance: proseDnaCompliance,
    forbidden_words_score_impact: forbiddenWordsImpact,
    flags,
    score,
  };
}

// ── Console exposure ────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_lineEditor = {
    runLineEditor,
  };
}
