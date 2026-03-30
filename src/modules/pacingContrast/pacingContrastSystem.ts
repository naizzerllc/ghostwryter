/**
 * Pacing Contrast System — Detects and corrects uniform chapter pacing.
 * GHOSTLY v2.2 · Session 16
 *
 * Chapter-level tempo analysis (not sentence-level rhythm — that's Line Editor).
 * Detects uniform tension, scene type monotony, missing warmth, dialogue uniformity.
 * Recommends next scene type for maximum contrast.
 */

// ── Types ───────────────────────────────────────────────────────────────

export type PacingFlagType =
  | "PACING_UNIFORM"
  | "SCENE_TYPE_MONOTONY"
  | "WARMTH_ABSENT"
  | "DIALOGUE_UNIFORM";

export interface PacingFlag {
  type: PacingFlagType;
  description: string;
  severity: "warning" | "critical";
  affected_chapters: number[];
}

export interface ApprovedChapterSummary {
  chapter_number: number;
  scene_type: string;
  tension_score_actual: number;
  word_count?: number;
  dialogue_density?: number; // 0–1 ratio
}

export interface PacingContrastResult {
  contrast_score: number; // 1–10
  flags: PacingFlag[];
  recommended_next_scene_type: string;
  analysis_timestamp: string;
}

// ── Scene Types ─────────────────────────────────────────────────────────

const ALL_SCENE_TYPES = [
  "CRISIS", "ACTION", "CONFRONTATION", "REVELATION",
  "WARMTH", "FALSE_CALM", "INTIMACY",
  "INVESTIGATION", "DISCOVERY", "INTERROGATION",
  "ESCAPE", "DECEPTION",
];

const CONTRAST_PAIRS: Record<string, string[]> = {
  CRISIS: ["WARMTH", "FALSE_CALM", "INTIMACY"],
  ACTION: ["INTIMACY", "INVESTIGATION", "WARMTH"],
  CONFRONTATION: ["FALSE_CALM", "WARMTH", "DISCOVERY"],
  REVELATION: ["FALSE_CALM", "INTIMACY", "WARMTH"],
  WARMTH: ["CRISIS", "CONFRONTATION", "REVELATION"],
  FALSE_CALM: ["CRISIS", "ACTION", "REVELATION"],
  INTIMACY: ["CONFRONTATION", "ACTION", "CRISIS"],
  INVESTIGATION: ["ACTION", "CONFRONTATION", "CRISIS"],
  DISCOVERY: ["CONFRONTATION", "CRISIS", "DECEPTION"],
  INTERROGATION: ["WARMTH", "FALSE_CALM", "ESCAPE"],
  ESCAPE: ["FALSE_CALM", "INVESTIGATION", "INTIMACY"],
  DECEPTION: ["REVELATION", "CONFRONTATION", "WARMTH"],
};

// ── Analysis ────────────────────────────────────────────────────────────

function detectUniformTension(chapters: ApprovedChapterSummary[]): PacingFlag | null {
  if (chapters.length < 5) return null;

  // Check last 5+ chapters for tension within 1.0-point band
  for (let windowEnd = chapters.length; windowEnd >= 5; windowEnd--) {
    const windowStart = windowEnd - 5;
    const window = chapters.slice(windowStart, windowEnd);
    const tensions = window.map(c => c.tension_score_actual);
    const min = Math.min(...tensions);
    const max = Math.max(...tensions);

    if (max - min <= 1.0) {
      return {
        type: "PACING_UNIFORM",
        description: `${window.length} consecutive chapters with tension scores within ${min.toFixed(1)}–${max.toFixed(1)} band. Pacing feels flat.`,
        severity: "critical",
        affected_chapters: window.map(c => c.chapter_number),
      };
    }
  }

  return null;
}

function detectSceneTypeMonotony(chapters: ApprovedChapterSummary[]): PacingFlag | null {
  if (chapters.length < 4) return null;

  for (let i = chapters.length - 1; i >= 3; i--) {
    const window = chapters.slice(i - 3, i + 1);
    const types = window.map(c => c.scene_type.toUpperCase());
    if (types.every(t => t === types[0])) {
      return {
        type: "SCENE_TYPE_MONOTONY",
        description: `${window.length} consecutive ${types[0]} chapters. Vary scene types for reader engagement.`,
        severity: "warning",
        affected_chapters: window.map(c => c.chapter_number),
      };
    }
  }

  return null;
}

function detectWarmthAbsent(chapters: ApprovedChapterSummary[]): PacingFlag | null {
  if (chapters.length < 5) return null;

  const warmthTypes = new Set(["WARMTH", "INTIMACY", "FALSE_CALM"]);
  const hasWarmth = chapters.some(c => warmthTypes.has(c.scene_type.toUpperCase()));

  if (!hasWarmth) {
    return {
      type: "WARMTH_ABSENT",
      description: `No WARMTH, INTIMACY, or FALSE_CALM chapters in ${chapters.length} approved chapters. Reader fatigue risk.`,
      severity: "warning",
      affected_chapters: chapters.map(c => c.chapter_number),
    };
  }

  return null;
}

function detectDialogueUniformity(chapters: ApprovedChapterSummary[]): PacingFlag | null {
  const withDensity = chapters.filter(c => c.dialogue_density !== undefined);
  if (withDensity.length < 6) return null;

  const densities = withDensity.map(c => c.dialogue_density!);
  const min = Math.min(...densities);
  const max = Math.max(...densities);

  if (max - min <= 0.10) {
    return {
      type: "DIALOGUE_UNIFORM",
      description: `Dialogue density within 10% band across ${withDensity.length} chapters (${(min * 100).toFixed(0)}%–${(max * 100).toFixed(0)}%). Vary dialogue/narration ratio.`,
      severity: "warning",
      affected_chapters: withDensity.map(c => c.chapter_number),
    };
  }

  return null;
}

function recommendNextSceneType(chapters: ApprovedChapterSummary[]): string {
  if (chapters.length === 0) return "CRISIS";

  // Get last 3 scene types
  const recent = chapters.slice(-3).map(c => c.scene_type.toUpperCase());
  const lastType = recent[recent.length - 1];

  // Get contrast options for last scene type
  const contrastOptions = CONTRAST_PAIRS[lastType] ?? ["WARMTH", "CRISIS", "REVELATION"];

  // Filter out any that appeared in the last 3
  const recentSet = new Set(recent);
  const available = contrastOptions.filter(t => !recentSet.has(t));

  return available[0] ?? contrastOptions[0];
}

function calculateContrastScore(chapters: ApprovedChapterSummary[], flags: PacingFlag[]): number {
  if (chapters.length < 3) return 8; // Too early to judge

  let score = 10;

  // Deduct for flags
  for (const flag of flags) {
    if (flag.type === "PACING_UNIFORM") score -= 3;
    if (flag.type === "SCENE_TYPE_MONOTONY") score -= 2;
    if (flag.type === "WARMTH_ABSENT") score -= 1.5;
    if (flag.type === "DIALOGUE_UNIFORM") score -= 1;
  }

  // Bonus for tension variance
  if (chapters.length >= 5) {
    const tensions = chapters.map(c => c.tension_score_actual);
    const variance = Math.max(...tensions) - Math.min(...tensions);
    if (variance >= 4) score += 1;
  }

  return Math.max(1, Math.min(10, Math.round(score)));
}

// ── Public API ──────────────────────────────────────────────────────────

export function analyzePacingContrast(
  approvedChapters: ApprovedChapterSummary[]
): PacingContrastResult {
  const sorted = [...approvedChapters].sort((a, b) => a.chapter_number - b.chapter_number);
  const flags: PacingFlag[] = [];

  const uniformTension = detectUniformTension(sorted);
  if (uniformTension) flags.push(uniformTension);

  const monotony = detectSceneTypeMonotony(sorted);
  if (monotony) flags.push(monotony);

  const warmthAbsent = detectWarmthAbsent(sorted);
  if (warmthAbsent) flags.push(warmthAbsent);

  const dialogueUniform = detectDialogueUniformity(sorted);
  if (dialogueUniform) flags.push(dialogueUniform);

  return {
    contrast_score: calculateContrastScore(sorted, flags),
    flags,
    recommended_next_scene_type: recommendNextSceneType(sorted),
    analysis_timestamp: new Date().toISOString(),
  };
}
