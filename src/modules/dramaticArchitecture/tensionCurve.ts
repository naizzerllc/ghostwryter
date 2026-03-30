/**
 * Tension Curve + Rollercoaster Enforcer + Warmth Spacing Validator
 * GHOSTLY v2.2 · Session 12
 *
 * Tracks target vs actual tension per chapter, enforces variance rules,
 * and validates warmth chapter spacing in Act 2.
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface CompulsionCurveRecord {
  chapter_number: number;
  tension_score_target: number;
  tension_score_actual: number;
  compulsion_score: number;
  hook_compulsion_score: number;
  entry_compulsion_score: number;
  act: 1 | 2 | 3;
  scene_type?: string;
  approved_at: string;
}

export interface RollercoasterViolation {
  rule: string;
  description: string;
  chapters_affected: number[];
}

export interface RollercoasterResult {
  compliant: boolean;
  violations: RollercoasterViolation[];
  checked_at: string;
  total_chapters_checked: number;
}

export interface WarmthViolation {
  block_start: number;
  block_end: number;
  chapters_in_block: number[];
  message: string;
}

export interface WarmthSpacingResult {
  compliant: boolean;
  violations: WarmthViolation[];
  next_warmth_due_by_chapter: number;
}

export interface TensionCurveAnalysis {
  act1_rising: boolean;
  inciting_incident_met: boolean;
  act2_variance_met: boolean;
  act2_peaks_met: boolean;
  all_is_lost_ranked: boolean;
  final_stretch_met: boolean;
  issues: string[];
}

// ── Storage ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "ghostly_compulsion_curve";

function loadCurve(): CompulsionCurveRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCurve(records: CompulsionCurveRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// ── Compulsion Curve CRUD ───────────────────────────────────────────────

export function addCompulsionRecord(record: CompulsionCurveRecord): void {
  const curve = loadCurve();
  const idx = curve.findIndex((r) => r.chapter_number === record.chapter_number);
  if (idx >= 0) {
    curve[idx] = record;
  } else {
    curve.push(record);
    curve.sort((a, b) => a.chapter_number - b.chapter_number);
  }
  saveCurve(curve);
}

export function getCompulsionCurve(): CompulsionCurveRecord[] {
  return loadCurve();
}

export function getCompulsionRecordForChapter(chapter: number): CompulsionCurveRecord | undefined {
  return loadCurve().find((r) => r.chapter_number === chapter);
}

// ── Tension Curve Analysis ──────────────────────────────────────────────

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
}

export function analyzeTensionCurve(
  records: CompulsionCurveRecord[],
  incitingIncidentChapter?: number,
  allIsLostChapter?: number,
  totalChapters?: number
): TensionCurveAnalysis {
  const issues: string[] = [];
  const act1 = records.filter((r) => r.act === 1).sort((a, b) => a.chapter_number - b.chapter_number);
  const act2 = records.filter((r) => r.act === 2);
  const sorted = [...records].sort((a, b) => a.chapter_number - b.chapter_number);

  // Act 1: rising trajectory, min 1.5 point increase chapter-to-chapter
  let act1Rising = true;
  for (let i = 1; i < act1.length; i++) {
    if (act1[i].tension_score_actual - act1[i - 1].tension_score_actual < 1.5) {
      act1Rising = false;
      issues.push(`Act 1: Insufficient rise between Ch${act1[i - 1].chapter_number}→Ch${act1[i].chapter_number}`);
    }
  }
  if (act1.length < 2) act1Rising = true; // not enough data

  // Inciting incident ≥ 8.0
  let incitingMet = true;
  if (incitingIncidentChapter) {
    const iiRecord = records.find((r) => r.chapter_number === incitingIncidentChapter);
    if (iiRecord && iiRecord.tension_score_actual < 8.0) {
      incitingMet = false;
      issues.push(`Inciting incident (Ch${incitingIncidentChapter}) tension ${iiRecord.tension_score_actual} < 8.0`);
    }
  }

  // Act 2: variance ≥ 1.2 SD
  const act2Scores = act2.map((r) => r.tension_score_actual);
  const act2SD = standardDeviation(act2Scores);
  const act2VarianceMet = act2Scores.length < 3 || act2SD >= 1.2;
  if (!act2VarianceMet) {
    issues.push(`Act 2 SD ${act2SD.toFixed(2)} < 1.2 — tension is too flat`);
  }

  // Act 2: 2 chapters ≥ 8.5, separated by ≥ 5 chapters
  const act2Peaks = act2.filter((r) => r.tension_score_actual >= 8.5)
    .sort((a, b) => a.chapter_number - b.chapter_number);
  let act2PeaksMet = act2Peaks.length >= 2;
  if (act2PeaksMet && act2Peaks.length >= 2) {
    const gap = act2Peaks[1].chapter_number - act2Peaks[0].chapter_number;
    if (gap < 5) {
      act2PeaksMet = false;
      issues.push(`Act 2 peaks too close: Ch${act2Peaks[0].chapter_number} and Ch${act2Peaks[1].chapter_number} (gap ${gap} < 5)`);
    }
  } else if (!act2PeaksMet && act2.length >= 10) {
    issues.push(`Act 2 needs at least 2 chapters with tension ≥ 8.5`);
  }

  // All-is-lost: ranked in top 5 compulsion scores
  let allIsLostRanked = true;
  if (allIsLostChapter && sorted.length >= 5) {
    const sortedByCompulsion = [...sorted].sort((a, b) => b.compulsion_score - a.compulsion_score);
    const top5 = sortedByCompulsion.slice(0, 5).map((r) => r.chapter_number);
    if (!top5.includes(allIsLostChapter)) {
      allIsLostRanked = false;
      issues.push(`All-is-lost (Ch${allIsLostChapter}) not in top 5 compulsion scores`);
    }
  }

  // Final 10 chapters: average exceeds Act 2 average
  let finalStretchMet = true;
  const finalCount = totalChapters ? Math.min(10, totalChapters) : 10;
  if (sorted.length >= finalCount + 5) {
    const finalChapters = sorted.slice(-finalCount);
    const finalAvg = finalChapters.reduce((s, r) => s + r.tension_score_actual, 0) / finalChapters.length;
    const act2Avg = act2Scores.length > 0 ? act2Scores.reduce((a, b) => a + b, 0) / act2Scores.length : 0;
    if (finalAvg <= act2Avg && act2Avg > 0) {
      finalStretchMet = false;
      issues.push(`Final stretch avg ${finalAvg.toFixed(1)} ≤ Act 2 avg ${act2Avg.toFixed(1)}`);
    }
  }

  return {
    act1_rising: act1Rising,
    inciting_incident_met: incitingMet,
    act2_variance_met: act2VarianceMet,
    act2_peaks_met: act2PeaksMet,
    all_is_lost_ranked: allIsLostRanked,
    final_stretch_met: finalStretchMet,
    issues,
  };
}

// ── Rollercoaster Enforcer ──────────────────────────────────────────────

/**
 * Runs every 10 approved chapters. Enforces 4 rules:
 * 1. No 4+ consecutive chapters with tension < 5
 * 2. No 3+ consecutive chapters with tension ≥ 8
 * 3. Every 8 Act 2 chapters must include 1 warmth chapter (4–6)
 * 4. Act 2 SD ≥ 1.2
 */
export function checkRollercoaster(records?: CompulsionCurveRecord[]): RollercoasterResult {
  const curve = records ?? loadCurve();
  const sorted = [...curve].sort((a, b) => a.chapter_number - b.chapter_number);
  const violations: RollercoasterViolation[] = [];

  // Rule 1: No 4+ consecutive low tension (< 5)
  let consecutiveLow: number[] = [];
  for (const r of sorted) {
    if (r.tension_score_actual < 5) {
      consecutiveLow.push(r.chapter_number);
      if (consecutiveLow.length >= 4) {
        violations.push({
          rule: "consecutive_low",
          description: `${consecutiveLow.length} consecutive chapters with tension < 5`,
          chapters_affected: [...consecutiveLow],
        });
      }
    } else {
      consecutiveLow = [];
    }
  }

  // Rule 2: No 3+ consecutive high tension (≥ 8) — prevents flatline-high
  let consecutiveHigh: number[] = [];
  for (const r of sorted) {
    if (r.tension_score_actual >= 8) {
      consecutiveHigh.push(r.chapter_number);
      if (consecutiveHigh.length >= 3) {
        violations.push({
          rule: "consecutive_high",
          description: `${consecutiveHigh.length} consecutive chapters with tension ≥ 8 — flatline-high risk`,
          chapters_affected: [...consecutiveHigh],
        });
      }
    } else {
      consecutiveHigh = [];
    }
  }

  // Rule 3: Warmth spacing — delegated to validateWarmthSpacing
  const warmthResult = validateWarmthSpacing(sorted);
  if (!warmthResult.compliant) {
    for (const wv of warmthResult.violations) {
      violations.push({
        rule: "warmth_spacing",
        description: wv.message,
        chapters_affected: wv.chapters_in_block,
      });
    }
  }

  // Rule 4: Act 2 SD ≥ 1.2
  const act2Scores = sorted.filter((r) => r.act === 2).map((r) => r.tension_score_actual);
  if (act2Scores.length >= 3) {
    const sd = standardDeviation(act2Scores);
    if (sd < 1.2) {
      violations.push({
        rule: "act2_variance",
        description: `Act 2 tension SD ${sd.toFixed(2)} < 1.2 — pacing is too flat`,
        chapters_affected: sorted.filter((r) => r.act === 2).map((r) => r.chapter_number),
      });
    }
  }

  return {
    compliant: violations.length === 0,
    violations,
    checked_at: new Date().toISOString(),
    total_chapters_checked: sorted.length,
  };
}

// ── Warmth Spacing Validator ────────────────────────────────────────────

const WARMTH_SCENE_TYPES = ["WARMTH", "FALSE_CALM", "INTIMACY"];

function isWarmthChapter(r: CompulsionCurveRecord): boolean {
  return (
    r.tension_score_actual >= 4.0 &&
    r.tension_score_actual <= 6.5 &&
    WARMTH_SCENE_TYPES.includes(r.scene_type?.toUpperCase() ?? "")
  );
}

/**
 * Groups Act 2 chapters into blocks of 8 and checks each block
 * for at least 1 warmth chapter.
 */
export function validateWarmthSpacing(
  records?: CompulsionCurveRecord[]
): WarmthSpacingResult {
  const curve = records ?? loadCurve();
  const act2 = curve
    .filter((r) => r.act === 2)
    .sort((a, b) => a.chapter_number - b.chapter_number);

  const violations: WarmthViolation[] = [];
  let nextWarmthDue = 0;

  // Group into blocks of 8
  for (let i = 0; i < act2.length; i += 8) {
    const block = act2.slice(i, i + 8);
    if (block.length < 4) continue; // partial block too small to enforce

    const hasWarmth = block.some(isWarmthChapter);
    if (!hasWarmth) {
      violations.push({
        block_start: block[0].chapter_number,
        block_end: block[block.length - 1].chapter_number,
        chapters_in_block: block.map((r) => r.chapter_number),
        message: `No warmth chapter in Act 2 block Ch${block[0].chapter_number}–Ch${block[block.length - 1].chapter_number}`,
      });
    }
  }

  // Calculate next warmth due
  if (act2.length > 0) {
    const lastWarmthIdx = [...act2].reverse().findIndex(isWarmthChapter);
    if (lastWarmthIdx === -1) {
      // No warmth at all — due immediately
      nextWarmthDue = act2[act2.length - 1].chapter_number + 1;
    } else {
      const lastWarmthChapter = act2[act2.length - 1 - lastWarmthIdx].chapter_number;
      nextWarmthDue = lastWarmthChapter + 8;
    }
  }

  return {
    compliant: violations.length === 0,
    violations,
    next_warmth_due_by_chapter: nextWarmthDue,
  };
}
