/**
 * Series Memory — cross-title context for trilogies/series.
 * GHOSTLY v2.2 · S11
 *
 * When series_memory_active: loads compressed context from previous title.
 * Injected into Tier 1 of generation context (~200T, reduces Tier 1 from 1200T to ~1000T).
 * Persisted to catalogue/series_memory/{titleId}.json.
 */

import { githubStorage } from "@/storage/githubStorage";

// ── Types ───────────────────────────────────────────────────────────────

export interface UnresolvedThread {
  thread_id: string;
  description: string;
  severity: "MAJOR" | "MINOR";
  introduced_chapter: number;
}

export interface SeriesMemoryRecord {
  title_id: string;
  title_name: string;
  sequence_number: number; // 1, 2, 3 in trilogy
  protagonist_arc_resolution: string; // ~200T compressed
  antagonist_fate: string;
  key_imagery_set: string[];
  unresolved_threads: UnresolvedThread[];
  world_state_at_end: string; // compressed world state
  tone_shift_notes: string;
  compressed_at: string;
  token_estimate: number;
}

export interface SeriesContext {
  active: boolean;
  previous_titles: SeriesMemoryRecord[];
  total_token_estimate: number;
  tier1_budget_remaining: number; // 1200 - series memory tokens
}

// ── State ───────────────────────────────────────────────────────────────

const memories: Map<string, SeriesMemoryRecord> = new Map();
const listeners: Set<() => void> = new Set();
let snapshotVersion = 0;
let seriesActive = false;

function notify() {
  snapshotVersion++;
  listeners.forEach(fn => fn());
}

// ── Persistence ─────────────────────────────────────────────────────────

function storagePath(titleId: string): string {
  return `catalogue/series_memory/${titleId}.json`;
}

export async function loadSeriesMemory(
  titleId: string,
): Promise<{ loaded: boolean; error?: string }> {
  const raw = await githubStorage.loadFile(storagePath(titleId));
  if (!raw) return { loaded: false, error: "No series memory found" };

  try {
    const record = JSON.parse(raw) as SeriesMemoryRecord;
    if (!record.title_id) return { loaded: false, error: "Invalid series memory record" };
    memories.set(record.title_id, record);
    notify();
    return { loaded: true };
  } catch (err) {
    return { loaded: false, error: err instanceof Error ? err.message : "Parse error" };
  }
}

async function persistMemory(record: SeriesMemoryRecord): Promise<void> {
  const data = JSON.stringify(record, null, 2);
  await githubStorage.saveFile(storagePath(record.title_id), data);
}

// ── Core API ────────────────────────────────────────────────────────────

/**
 * Compress approved chapters and outline into a series memory record.
 * Called at manuscript completion — creates the memory for the next book.
 */
export function compressForSeriesMemory(
  approvedChapters: Array<{
    chapter_number: number;
    content: string;
    [key: string]: unknown;
  }>,
  outline: {
    title_id: string;
    title_name: string;
    revelation_chapter?: number;
    key_imagery_set?: string[];
    [key: string]: unknown;
  },
  sequenceNumber: number,
): SeriesMemoryRecord {
  // Extract protagonist arc from final chapters (~200T budget)
  const lastChapters = approvedChapters.slice(-3);
  const protagonistArc = lastChapters
    .map(ch => `Ch${ch.chapter_number}: ${ch.content.slice(0, 200)}`)
    .join(" | ")
    .slice(0, 800); // Rough 200T equivalent

  // Extract antagonist fate from revelation and final chapters
  const revelationChapter = outline.revelation_chapter;
  let antagonistFate = "Unknown";
  if (revelationChapter) {
    const revChapter = approvedChapters.find(
      ch => ch.chapter_number === revelationChapter,
    );
    if (revChapter) {
      antagonistFate = revChapter.content.slice(0, 300);
    }
  }

  // Extract unresolved threads (placeholder — full implementation uses LLM)
  const unresolvedThreads: UnresolvedThread[] = [];

  const record: SeriesMemoryRecord = {
    title_id: outline.title_id,
    title_name: outline.title_name || outline.title_id,
    sequence_number: sequenceNumber,
    protagonist_arc_resolution: protagonistArc,
    antagonist_fate: antagonistFate,
    key_imagery_set: outline.key_imagery_set ?? [],
    unresolved_threads: unresolvedThreads,
    world_state_at_end: `End of Book ${sequenceNumber}`,
    tone_shift_notes: "",
    compressed_at: new Date().toISOString(),
    token_estimate: Math.ceil(protagonistArc.length / 4) + 50, // rough T estimate
  };

  memories.set(record.title_id, record);
  notify();
  persistMemory(record);
  return record;
}

/**
 * Get series context for generation injection.
 * Returns previous titles' compressed memory + remaining Tier 1 budget.
 */
export function getSeriesContext(currentTitleId: string): SeriesContext {
  if (!seriesActive) {
    return {
      active: false,
      previous_titles: [],
      total_token_estimate: 0,
      tier1_budget_remaining: 1200,
    };
  }

  const previousTitles = Array.from(memories.values())
    .filter(m => m.title_id !== currentTitleId)
    .sort((a, b) => a.sequence_number - b.sequence_number);

  const totalTokens = previousTitles.reduce(
    (sum, m) => sum + m.token_estimate,
    0,
  );

  return {
    active: true,
    previous_titles: previousTitles,
    total_token_estimate: totalTokens,
    tier1_budget_remaining: Math.max(0, 1200 - totalTokens),
  };
}

export function setSeriesActive(active: boolean): void {
  seriesActive = active;
  notify();
}

export function isSeriesActive(): boolean {
  return seriesActive;
}

export function getMemory(titleId: string): SeriesMemoryRecord | null {
  return memories.get(titleId) ?? null;
}

export function getAllMemories(): SeriesMemoryRecord[] {
  return Array.from(memories.values());
}

// ── React Integration ───────────────────────────────────────────────────

export interface SeriesMemorySnapshot {
  memories: SeriesMemoryRecord[];
  count: number;
  seriesActive: boolean;
  _v: number;
}

let cachedSnapshot: SeriesMemorySnapshot | null = null;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getSnapshot(): SeriesMemorySnapshot {
  if (cachedSnapshot && cachedSnapshot._v === snapshotVersion) return cachedSnapshot;

  const all = getAllMemories();
  cachedSnapshot = {
    memories: all,
    count: all.length,
    seriesActive,
    _v: snapshotVersion,
  };
  return cachedSnapshot;
}

// ── Window Registration ─────────────────────────────────────────────────
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_seriesMemory = {
    compressForSeriesMemory,
    getSeriesContext,
    loadSeriesMemory,
    setSeriesActive,
    isSeriesActive,
    getMemory,
    getAllMemories,
    getSnapshot,
  };
}
