/**
 * Cold Start System — Rebuilds generation context after a session break.
 * GHOSTLY v2.2 · Session 16
 *
 * Detects > 4 hour gaps and assembles compressed context from living state,
 * clocks, breadcrumbs, and canonical facts for continuity recovery.
 */

import { getLivingState } from "@/modules/livingState/livingState";
import { getActiveClocksForChapter } from "@/modules/dramaticArchitecture/clockRegistry";
import { getAllChapters } from "@/modules/outline/outlineSystem";

// ── Types ───────────────────────────────────────────────────────────────

export interface ColdStartContext {
  session_break_hours: number;
  last_approved_chapter: number;
  chapter_summaries: ChapterSummary[];
  character_positions: CharacterPosition[];
  active_clocks: ClockSnapshot[];
  active_breadcrumbs: BreadcrumbSnapshot[];
  last_hook_delivered: string;
  emotional_state: string;
  recent_canonical_facts: string[];
  assembled_at: string;
}

export interface ChapterSummary {
  chapter_number: number;
  scene_purpose: string;
  hook_type: string;
  hook_seed: string;
  permanent_change: string;
}

export interface CharacterPosition {
  character_id: string;
  psychological_position: string;
  trust_level: number;
  emotional_register: string;
}

export interface ClockSnapshot {
  clock_name: string;
  current_intensity: number;
}

export interface BreadcrumbSnapshot {
  breadcrumb_id: string;
  status: "planted" | "growing" | "harvested";
}

// ── Storage ─────────────────────────────────────────────────────────────

const ACTIVITY_KEY = "ghostly_last_activity";

function getLastActivityTimestamp(): number {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export function updateActivityTimestamp(): void {
  localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
}

// ── Public API ──────────────────────────────────────────────────────────

const SESSION_BREAK_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours

export function detectSessionBreak(lastActivityTimestamp?: number): boolean {
  const lastActivity = lastActivityTimestamp ?? getLastActivityTimestamp();
  if (lastActivity === 0) return false; // First session ever
  return Date.now() - lastActivity > SESSION_BREAK_THRESHOLD_MS;
}

export function getSessionBreakHours(lastActivityTimestamp?: number): number {
  const lastActivity = lastActivityTimestamp ?? getLastActivityTimestamp();
  if (lastActivity === 0) return 0;
  return Math.round((Date.now() - lastActivity) / (60 * 60 * 1000) * 10) / 10;
}

export function buildColdStartContext(
  projectId: string,
  chapterNumber: number
): ColdStartContext {
  const livingState = getLivingState(projectId);
  const allChapters = getAllChapters();

  // Last 3 approved chapter summaries
  const recentChapters = allChapters
    .filter(c => c.chapter_number < chapterNumber)
    .sort((a, b) => b.chapter_number - a.chapter_number)
    .slice(0, 3)
    .reverse();

  const chapterSummaries: ChapterSummary[] = recentChapters.map(c => ({
    chapter_number: c.chapter_number,
    scene_purpose: c.scene_purpose,
    hook_type: c.hook_type,
    hook_seed: c.hook_seed,
    permanent_change: c.permanent_change,
  }));

  // Character slider positions
  const characterPositions: CharacterPosition[] = livingState.character_sliders.map(s => ({
    character_id: s.character_id,
    psychological_position: s.psychological_position,
    trust_level: s.trust_level,
    emotional_register: s.emotional_register,
  }));

  // Active clocks
  const clocks = getActiveClocksForChapter(chapterNumber);
  const clockSnapshots: ClockSnapshot[] = clocks.map(c => ({
    clock_name: c.name,
    current_intensity: c.current_intensity,
  }));

  // Breadcrumbs
  const breadcrumbSnapshots: BreadcrumbSnapshot[] = livingState.active_breadcrumbs
    .filter(b => b.status !== "harvested")
    .map(b => ({
      breadcrumb_id: b.breadcrumb_id,
      status: b.status,
    }));

  // Last hook delivered
  const lastChapter = recentChapters[recentChapters.length - 1];
  const lastHook = lastChapter
    ? `${lastChapter.hook_type}: ${lastChapter.hook_seed}`
    : "No previous chapter";

  // Recent canonical facts (placeholder — uses chapter update log)
  const recentFacts: string[] = [];
  const recentUpdates = livingState.chapter_update_log
    .filter(e => e.chapter_number >= chapterNumber - 5)
    .slice(-5);
  for (const update of recentUpdates) {
    recentFacts.push(`Ch${update.chapter_number} state updated at ${update.updated_at}`);
  }

  return {
    session_break_hours: getSessionBreakHours(),
    last_approved_chapter: livingState.last_updated_chapter,
    chapter_summaries: chapterSummaries,
    character_positions: characterPositions,
    active_clocks: clockSnapshots,
    active_breadcrumbs: breadcrumbSnapshots,
    last_hook_delivered: lastHook,
    emotional_state: livingState.emotional_state_at_chapter_end,
    recent_canonical_facts: recentFacts,
    assembled_at: new Date().toISOString(),
  };
}
