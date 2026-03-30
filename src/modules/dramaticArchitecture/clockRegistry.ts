/**
 * Clock Registry — Tracks narrative time pressure devices across the manuscript.
 * GHOSTLY v2.2 · Session 12
 *
 * Clock types: FAST (≤5 chapters), MEDIUM (5–15), SLOW (15+).
 * Every Act 2 chapter must have at least one clock visibly ticking (Prose DNA R8).
 */

import { callWithFallback } from "@/api/llmRouter";

// ── Types ───────────────────────────────────────────────────────────────

export type ClockType = "FAST" | "MEDIUM" | "SLOW";

export interface ClockRecord {
  id: string;
  name: string;
  type: ClockType;
  description: string;
  introduced_chapter: number;
  escalation_chapters: number[];
  false_release_chapter?: number;
  peak_chapter: number;
  resolution_chapter: number;
  current_intensity: number; // 1–10
}

export interface ClockEscalationResult {
  chapter: number;
  has_escalating_clock: boolean;
  active_clocks: ClockRecord[];
  escalating_clocks: ClockRecord[];
  violation: boolean;
  message: string;
}

// ── Storage ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "ghostly_clock_registry";

function loadClocks(): ClockRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveClocks(clocks: ClockRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clocks));
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Extract clocks from an outline using Gemini Flash.
 * Returns structured ClockRecord[] parsed from LLM output.
 */
export async function extractClocks(
  outline: Array<{ chapter_number: number; scene_purpose: string; hook_seed?: string }>
): Promise<ClockRecord[]> {
  const prompt = `Analyze the following chapter outline and extract all narrative clocks (time-pressure devices, deadlines, ticking bombs, countdowns, approaching events).

For each clock, determine:
- name: short identifier
- type: FAST (resolves within 5 chapters), MEDIUM (5–15 chapters), SLOW (15+ chapters)
- description: what the clock is
- introduced_chapter: when it first appears
- escalation_chapters: chapters where it visibly escalates
- false_release_chapter: chapter where tension temporarily drops (optional)
- peak_chapter: highest intensity chapter
- resolution_chapter: when it resolves
- current_intensity: starting intensity 1–10

Return ONLY a JSON array of clock objects. No explanation.

Outline:
${JSON.stringify(outline, null, 2)}`;

  try {
    const result = await callWithFallback("quality_analysis", prompt);
    const parsed = JSON.parse(result.content);
    if (!Array.isArray(parsed)) return [];

    const clocks: ClockRecord[] = parsed.map((c: Record<string, unknown>, i: number) => ({
      id: `clock_${Date.now()}_${i}`,
      name: String(c.name || `Clock ${i + 1}`),
      type: (["FAST", "MEDIUM", "SLOW"].includes(String(c.type)) ? c.type : "MEDIUM") as ClockType,
      description: String(c.description || ""),
      introduced_chapter: Number(c.introduced_chapter) || 1,
      escalation_chapters: Array.isArray(c.escalation_chapters) ? c.escalation_chapters.map(Number) : [],
      false_release_chapter: c.false_release_chapter ? Number(c.false_release_chapter) : undefined,
      peak_chapter: Number(c.peak_chapter) || 1,
      resolution_chapter: Number(c.resolution_chapter) || 1,
      current_intensity: Math.min(10, Math.max(1, Number(c.current_intensity) || 3)),
    }));

    saveClocks(clocks);
    return clocks;
  } catch (err) {
    console.error("[ClockRegistry] extractClocks failed:", err);
    return [];
  }
}

/**
 * Update a clock's intensity after chapter approval.
 */
export function updateClockIntensity(clockId: string, _chapter: number, intensity: number): void {
  const clocks = loadClocks();
  const idx = clocks.findIndex((c) => c.id === clockId);
  if (idx === -1) return;
  clocks[idx].current_intensity = Math.min(10, Math.max(1, intensity));
  saveClocks(clocks);
}

/**
 * Get all clocks active at a given chapter number.
 * A clock is active if introduced_chapter <= chapterNumber <= resolution_chapter.
 */
export function getActiveClocksForChapter(chapterNumber: number): ClockRecord[] {
  const clocks = loadClocks();
  return clocks.filter(
    (c) => c.introduced_chapter <= chapterNumber && c.resolution_chapter >= chapterNumber
  );
}

/**
 * Check that at least one clock is escalating at a given chapter.
 * A clock is escalating if the chapter is in its escalation_chapters array
 * or is between introduced_chapter and peak_chapter.
 */
export function checkClockEscalation(chapterNumber: number): ClockEscalationResult {
  const activeClocks = getActiveClocksForChapter(chapterNumber);

  const escalatingClocks = activeClocks.filter(
    (c) =>
      c.escalation_chapters.includes(chapterNumber) ||
      (chapterNumber >= c.introduced_chapter && chapterNumber <= c.peak_chapter)
  );

  const violation = activeClocks.length > 0 && escalatingClocks.length === 0;

  return {
    chapter: chapterNumber,
    has_escalating_clock: escalatingClocks.length > 0,
    active_clocks: activeClocks,
    escalating_clocks: escalatingClocks,
    violation,
    message: violation
      ? `⚠ Chapter ${chapterNumber}: No clock is escalating. Prose DNA R8 requires at least one active clock beat.`
      : `✓ Chapter ${chapterNumber}: ${escalatingClocks.length} clock(s) escalating.`,
  };
}

/**
 * Get all stored clocks.
 */
export function getAllClocks(): ClockRecord[] {
  return loadClocks();
}

/**
 * Add a manually created clock.
 */
export function addClock(clock: Omit<ClockRecord, "id">): ClockRecord {
  const clocks = loadClocks();
  const record: ClockRecord = { ...clock, id: `clock_${Date.now()}` };
  clocks.push(record);
  saveClocks(clocks);
  return record;
}

/**
 * Remove a clock by ID.
 */
export function removeClock(clockId: string): void {
  const clocks = loadClocks().filter((c) => c.id !== clockId);
  saveClocks(clocks);
}
