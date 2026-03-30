/**
 * Genre Calibration — Verifies manuscript maintains psychological thriller conventions.
 * GHOSTLY v2.2 · Session 16
 *
 * Runs every 5 approved chapters via Gemini Flash (quality_analysis).
 * Checks: unreliable narrator integrity, mystery maintenance, twist momentum, reader trust.
 */

import { callWithFallback } from "@/api/llmRouter";
import { ChapterOutlineRecord } from "@/modules/outline/outlineSystem";

// ── Types ───────────────────────────────────────────────────────────────

export type GenreCalibrationFlagType =
  | "NARRATOR_PASSIVE"
  | "PREMATURE_RESOLUTION"
  | "TWIST_STALLING"
  | "TRUST_ERODED"
  | "GENRE_DRIFT";

export interface GenreCalibrationFlag {
  type: GenreCalibrationFlagType;
  description: string;
  severity: "info" | "warning" | "critical";
}

export interface ApprovedChapterForCalibration {
  chapter_number: number;
  content_summary: string;
  scene_purpose: string;
  hook_type: string;
  act: 1 | 2 | 3;
}

export interface GenreCalibrationResult {
  calibration_score: number; // 1–10
  flags: GenreCalibrationFlag[];
  notes: string[];
  calibrated_at: string;
  chapter_range: string;
}

// ── Storage ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "ghostly_genre_calibration";

interface CalibrationHistory {
  last_calibrated_at_chapter: number;
  results: GenreCalibrationResult[];
}

function loadHistory(): CalibrationHistory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { last_calibrated_at_chapter: 0, results: [] };
  } catch {
    return { last_calibrated_at_chapter: 0, results: [] };
  }
}

function saveHistory(history: CalibrationHistory): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

// ── Calibration Check ──────────────────────────────────────────────────

export function isCalibrationDue(approvedChapterCount: number): boolean {
  const history = loadHistory();
  return approvedChapterCount >= 5 &&
    approvedChapterCount - history.last_calibrated_at_chapter >= 5;
}

// ── Public API ──────────────────────────────────────────────────────────

export async function runGenreCalibration(
  approvedChapters: ApprovedChapterForCalibration[],
  outline: ChapterOutlineRecord[]
): Promise<GenreCalibrationResult> {
  const sorted = [...approvedChapters].sort((a, b) => a.chapter_number - b.chapter_number);
  const lastFive = sorted.slice(-5);
  const chapterRange = `Ch${lastFive[0]?.chapter_number ?? 0}–Ch${lastFive[lastFive.length - 1]?.chapter_number ?? 0}`;

  const chapterSummaries = lastFive
    .map(c => `Ch${c.chapter_number} (Act ${c.act}): ${c.scene_purpose} | Hook: ${c.hook_type} | Summary: ${c.content_summary.slice(0, 300)}`)
    .join("\n");

  const outlineSummary = outline
    .filter(o => o.chapter_number > (lastFive[lastFive.length - 1]?.chapter_number ?? 0))
    .slice(0, 5)
    .map(o => `Ch${o.chapter_number}: ${o.scene_purpose}`)
    .join("\n");

  const prompt = `You are a genre calibration system for a psychological thriller manuscript.

Analyze the last 5 approved chapters and evaluate whether the manuscript is maintaining psychological thriller conventions.

APPROVED CHAPTERS:
${chapterSummaries}

UPCOMING OUTLINE:
${outlineSummary || "No upcoming chapters in outline."}

Evaluate these four dimensions and return ONLY a JSON object:

1. narrator_unreliability: Is the narrator ACTIVELY misleading (good) or just confused/passive (bad)? Score 1-10.
2. mystery_maintenance: Does the reader still have unresolved questions appropriate for the current act? Score 1-10. If all mystery resolved before Act 3 → flag PREMATURE_RESOLUTION.
3. twist_momentum: Is misdirection actively building or stalling? Score 1-10.
4. reader_trust: Would a careful reader still believe the false interpretation? Score 1-10. If eroded unintentionally → flag TRUST_ERODED.

Return JSON:
{
  "narrator_unreliability": { "score": number, "note": string, "passive": boolean },
  "mystery_maintenance": { "score": number, "note": string, "premature_resolution": boolean },
  "twist_momentum": { "score": number, "note": string, "stalling": boolean },
  "reader_trust": { "score": number, "note": string, "eroded": boolean },
  "overall_genre_adherence": number,
  "notes": string[]
}`;

  try {
    const result = await callWithFallback("quality_analysis", prompt);
    const parsed = JSON.parse(result.content);

    const flags: GenreCalibrationFlag[] = [];
    const notes: string[] = parsed.notes ?? [];

    if (parsed.narrator_unreliability?.passive) {
      flags.push({
        type: "NARRATOR_PASSIVE",
        description: `Narrator unreliability has gone passive. ${parsed.narrator_unreliability.note ?? ""}`,
        severity: "critical",
      });
    }

    if (parsed.mystery_maintenance?.premature_resolution) {
      flags.push({
        type: "PREMATURE_RESOLUTION",
        description: `Mystery resolved too early. ${parsed.mystery_maintenance.note ?? ""}`,
        severity: "critical",
      });
    }

    if (parsed.twist_momentum?.stalling) {
      flags.push({
        type: "TWIST_STALLING",
        description: `Twist architecture momentum stalling. ${parsed.twist_momentum.note ?? ""}`,
        severity: "warning",
      });
    }

    if (parsed.reader_trust?.eroded) {
      flags.push({
        type: "TRUST_ERODED",
        description: `Reader trust in false interpretation eroded unintentionally. ${parsed.reader_trust.note ?? ""}`,
        severity: "critical",
      });
    }

    const calibrationScore = Math.max(1, Math.min(10,
      Math.round(parsed.overall_genre_adherence ?? 5)
    ));

    if (calibrationScore < 6) {
      flags.push({
        type: "GENRE_DRIFT",
        description: `Genre calibration score ${calibrationScore}/10 — editorial attention required.`,
        severity: "warning",
      });
    }

    const calibrationResult: GenreCalibrationResult = {
      calibration_score: calibrationScore,
      flags,
      notes,
      calibrated_at: new Date().toISOString(),
      chapter_range: chapterRange,
    };

    // Save to history
    const history = loadHistory();
    history.last_calibrated_at_chapter = sorted.length;
    history.results.push(calibrationResult);
    if (history.results.length > 10) history.results = history.results.slice(-10);
    saveHistory(history);

    return calibrationResult;
  } catch (err) {
    console.error("[GenreCalibration] runGenreCalibration failed:", err);
    return {
      calibration_score: 5,
      flags: [{
        type: "GENRE_DRIFT",
        description: "Genre calibration analysis failed — manual review recommended.",
        severity: "warning",
      }],
      notes: ["Calibration LLM call failed. Defaulting to score 5."],
      calibrated_at: new Date().toISOString(),
      chapter_range: chapterRange,
    };
  }
}

export function getCalibrationHistory(): GenreCalibrationResult[] {
  return loadHistory().results;
}
