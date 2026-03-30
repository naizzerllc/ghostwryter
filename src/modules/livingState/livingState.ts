/**
 * Living State — Tracks changing story state after each chapter approval.
 * GHOSTLY v2.2 · Session 13
 *
 * Updated after each chapter approval via Gemini Flash (quality_analysis task).
 * Feeds emotional_state_at_chapter_end to the Briefing Generator.
 */

import { callWithFallback } from "@/api/llmRouter";

// ── Types ───────────────────────────────────────────────────────────────

export interface ClockState {
  clock_id: string;
  clock_name: string;
  current_intensity: number;
  last_updated_chapter: number;
}

export interface CharacterSlider {
  character_id: string;
  psychological_position: string;
  trust_level: number;
  emotional_register: string;
  last_updated_chapter: number;
}

export interface BreadcrumbState {
  breadcrumb_id: string;
  status: "planted" | "growing" | "harvested";
  planted_chapter: number;
  last_touched_chapter: number;
}

export interface LivingState {
  project_id: string;
  last_updated_chapter: number;
  clock_states: ClockState[];
  character_sliders: CharacterSlider[];
  active_breadcrumbs: BreadcrumbState[];
  emotional_state_at_chapter_end: string;
  chapter_update_log: ChapterUpdateEntry[];
}

export interface ChapterUpdateEntry {
  chapter_number: number;
  updated_at: string;
  memory_update_confirmed: boolean;
}

export interface LivingStateUpdate {
  success: boolean;
  chapter_number: number;
  emotional_state_at_chapter_end: string;
  clocks_updated: number;
  sliders_updated: number;
  breadcrumbs_updated: number;
}

export interface MemoryDesyncResult {
  in_sync: boolean;
  approved_count: number;
  confirmed_count: number;
  missing_chapters: number[];
}

// ── Storage ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "ghostly_living_state";

function loadState(): LivingState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(state: LivingState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getOrCreateState(projectId: string): LivingState {
  const existing = loadState();
  if (existing && existing.project_id === projectId) return existing;
  return {
    project_id: projectId,
    last_updated_chapter: 0,
    clock_states: [],
    character_sliders: [],
    active_breadcrumbs: [],
    emotional_state_at_chapter_end: "",
    chapter_update_log: [],
  };
}

// ── Public API ──────────────────────────────────────────────────────────

export function getLivingState(projectId: string): LivingState {
  return getOrCreateState(projectId);
}

/**
 * Update living state after a chapter approval.
 * Calls Gemini Flash (quality_analysis) to extract state changes.
 */
export async function updateLivingState(
  approvedChapterContent: string,
  chapterNumber: number,
  projectId: string
): Promise<LivingStateUpdate> {
  const state = getOrCreateState(projectId);

  const prompt = `Analyze the following approved chapter and extract the current story state changes.

Return ONLY a JSON object with these fields:
- emotional_state_at_chapter_end: string describing the protagonist's emotional register at chapter close (1-2 sentences)
- clock_updates: array of { clock_id: string, clock_name: string, current_intensity: number (1-10) }
- character_updates: array of { character_id: string, psychological_position: string, trust_level: number (1-10), emotional_register: string }
- breadcrumb_updates: array of { breadcrumb_id: string, status: "planted"|"growing"|"harvested" }

Chapter ${chapterNumber}:
${approvedChapterContent.slice(0, 6000)}`;

  try {
    const result = await callWithFallback("quality_analysis", prompt);
    const parsed = JSON.parse(result.content);

    // Update emotional state
    state.emotional_state_at_chapter_end =
      parsed.emotional_state_at_chapter_end ?? "";
    state.last_updated_chapter = chapterNumber;

    // Update clocks
    if (Array.isArray(parsed.clock_updates)) {
      for (const cu of parsed.clock_updates) {
        const idx = state.clock_states.findIndex(
          (c) => c.clock_id === cu.clock_id
        );
        const entry: ClockState = {
          clock_id: cu.clock_id,
          clock_name: cu.clock_name ?? cu.clock_id,
          current_intensity: Math.min(10, Math.max(1, Number(cu.current_intensity) || 5)),
          last_updated_chapter: chapterNumber,
        };
        if (idx >= 0) state.clock_states[idx] = entry;
        else state.clock_states.push(entry);
      }
    }

    // Update character sliders
    if (Array.isArray(parsed.character_updates)) {
      for (const su of parsed.character_updates) {
        const idx = state.character_sliders.findIndex(
          (s) => s.character_id === su.character_id
        );
        const entry: CharacterSlider = {
          character_id: su.character_id,
          psychological_position: su.psychological_position ?? "",
          trust_level: Math.min(10, Math.max(1, Number(su.trust_level) || 5)),
          emotional_register: su.emotional_register ?? "",
          last_updated_chapter: chapterNumber,
        };
        if (idx >= 0) state.character_sliders[idx] = entry;
        else state.character_sliders.push(entry);
      }
    }

    // Update breadcrumbs
    if (Array.isArray(parsed.breadcrumb_updates)) {
      for (const bu of parsed.breadcrumb_updates) {
        const idx = state.active_breadcrumbs.findIndex(
          (b) => b.breadcrumb_id === bu.breadcrumb_id
        );
        const entry: BreadcrumbState = {
          breadcrumb_id: bu.breadcrumb_id,
          status: bu.status ?? "planted",
          planted_chapter: idx >= 0 ? state.active_breadcrumbs[idx].planted_chapter : chapterNumber,
          last_touched_chapter: chapterNumber,
        };
        if (idx >= 0) state.active_breadcrumbs[idx] = entry;
        else state.active_breadcrumbs.push(entry);
      }
    }

    // Log update
    state.chapter_update_log.push({
      chapter_number: chapterNumber,
      updated_at: new Date().toISOString(),
      memory_update_confirmed: false,
    });

    saveState(state);

    return {
      success: true,
      chapter_number: chapterNumber,
      emotional_state_at_chapter_end: state.emotional_state_at_chapter_end,
      clocks_updated: parsed.clock_updates?.length ?? 0,
      sliders_updated: parsed.character_updates?.length ?? 0,
      breadcrumbs_updated: parsed.breadcrumb_updates?.length ?? 0,
    };
  } catch (err) {
    console.error("[LivingState] updateLivingState failed:", err);
    return {
      success: false,
      chapter_number: chapterNumber,
      emotional_state_at_chapter_end: "",
      clocks_updated: 0,
      sliders_updated: 0,
      breadcrumbs_updated: 0,
    };
  }
}

/**
 * Confirm a memory update was committed to GitHub.
 */
export function confirmMemoryUpdate(chapterNumber: number, projectId: string): void {
  const state = getOrCreateState(projectId);
  const entry = state.chapter_update_log.find(
    (e) => e.chapter_number === chapterNumber
  );
  if (entry) {
    entry.memory_update_confirmed = true;
    saveState(state);
  }
}

/**
 * Memory desync detection:
 * Compares approved chapters count vs confirmed memory updates.
 */
export function checkMemoryDesync(
  approvedChapterNumbers: number[],
  projectId: string
): MemoryDesyncResult {
  const state = getOrCreateState(projectId);
  const confirmed = state.chapter_update_log.filter(
    (e) => e.memory_update_confirmed
  );
  const confirmedChapters = new Set(confirmed.map((e) => e.chapter_number));

  const missing = approvedChapterNumbers.filter(
    (ch) => !confirmedChapters.has(ch)
  );

  return {
    in_sync: missing.length === 0,
    approved_count: approvedChapterNumbers.length,
    confirmed_count: confirmed.length,
    missing_chapters: missing,
  };
}
