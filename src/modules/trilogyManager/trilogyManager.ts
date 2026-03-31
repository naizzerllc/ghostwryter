/**
 * Trilogy Manager — S24
 * Groups projects into series, captures trilogy seeds, manages world packs.
 */

import { githubStorage } from "@/storage/githubStorage";

// ── Types ───────────────────────────────────────────────────────────────

export type SeriesStatus = "PLANNING" | "ACTIVE" | "COMPLETE";

export interface SeriesBook {
  project_id: string;
  book_number: number;
  title: string;
  status: string;
}

export interface Series {
  series_id: string;
  series_name: string;
  book_order: SeriesBook[];
  shared_world_elements: string[];
  series_status: SeriesStatus;
  created_at: string;
  updated_at: string;
}

export interface TrilogySeed {
  thread_id: string;
  description: string;
  source_chapter: number;
  seed_type: "unresolved_thread" | "character_fate" | "world_detail" | "open_question";
  priority: "high" | "medium" | "low";
}

export interface TrilogySeeds {
  project_id: string;
  book_number: number;
  seeds: TrilogySeed[];
  captured_at: string;
}

export interface SeriesContext {
  series_id: string;
  series_name: string;
  book_count: number;
  current_book: number;
  shared_world_elements: string[];
  prior_seeds: TrilogySeeds[];
}

export interface WorldPack {
  series_id: string;
  book_number: number;
  canonical_facts: string[];
  character_carry_forwards: string[];
  loaded_at: string;
}

// ── Paths ───────────────────────────────────────────────────────────────

const SERIES_INDEX_PATH = "series/index.json";

function seriesPath(seriesId: string): string {
  return `series/${seriesId}/series.json`;
}

function seedsPath(seriesId: string, bookNumber: number): string {
  return `series/${seriesId}/seeds_${bookNumber}.json`;
}

function worldPackPath(seriesId: string, bookNumber: number): string {
  return `series/${seriesId}/world_pack_${bookNumber}.json`;
}

// ── Index ───────────────────────────────────────────────────────────────

interface SeriesIndex {
  series: Array<{ series_id: string; series_name: string; book_count: number }>;
  updated_at: string;
}

async function loadSeriesIndex(): Promise<SeriesIndex> {
  const raw = await githubStorage.loadFile(SERIES_INDEX_PATH);
  if (!raw) return { series: [], updated_at: new Date().toISOString() };
  try {
    return JSON.parse(raw) as SeriesIndex;
  } catch {
    return { series: [], updated_at: new Date().toISOString() };
  }
}

async function saveSeriesIndex(index: SeriesIndex): Promise<void> {
  index.updated_at = new Date().toISOString();
  await githubStorage.saveFile(SERIES_INDEX_PATH, JSON.stringify(index, null, 2));
}

// ── Helpers ─────────────────────────────────────────────────────────────

function generateSeriesId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20);
  return `series-${slug}-${Date.now().toString(36).slice(-4)}`;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Create a new series.
 */
export async function createSeries(
  name: string,
  books: Array<{ project_id: string; title: string }>,
): Promise<Series> {
  const id = generateSeriesId(name);
  const now = new Date().toISOString();

  const series: Series = {
    series_id: id,
    series_name: name,
    book_order: books.map((b, i) => ({
      project_id: b.project_id,
      book_number: i + 1,
      title: b.title,
      status: "ACTIVE",
    })),
    shared_world_elements: [],
    series_status: "PLANNING",
    created_at: now,
    updated_at: now,
  };

  await githubStorage.saveFile(seriesPath(id), JSON.stringify(series, null, 2));

  // Update index
  const index = await loadSeriesIndex();
  index.series.push({ series_id: id, series_name: name, book_count: books.length });
  await saveSeriesIndex(index);

  return series;
}

/**
 * Add a book to an existing series.
 */
export async function addBookToSeries(
  seriesId: string,
  projectId: string,
  title: string,
  position?: number,
): Promise<boolean> {
  const raw = await githubStorage.loadFile(seriesPath(seriesId));
  if (!raw) return false;

  try {
    const series = JSON.parse(raw) as Series;
    const bookNumber = position ?? series.book_order.length + 1;
    series.book_order.push({
      project_id: projectId,
      book_number: bookNumber,
      title,
      status: "ACTIVE",
    });
    series.book_order.sort((a, b) => a.book_number - b.book_number);
    series.updated_at = new Date().toISOString();
    await githubStorage.saveFile(seriesPath(seriesId), JSON.stringify(series, null, 2));

    // Update index
    const index = await loadSeriesIndex();
    const entry = index.series.find((s) => s.series_id === seriesId);
    if (entry) entry.book_count = series.book_order.length;
    await saveSeriesIndex(index);

    return true;
  } catch {
    return false;
  }
}

/**
 * Get series context for memory injection.
 */
export async function getSeriesContext(seriesId: string): Promise<SeriesContext | null> {
  const raw = await githubStorage.loadFile(seriesPath(seriesId));
  if (!raw) return null;

  try {
    const series = JSON.parse(raw) as Series;
    const priorSeeds: TrilogySeeds[] = [];

    for (const book of series.book_order) {
      const seedRaw = await githubStorage.loadFile(seedsPath(seriesId, book.book_number));
      if (seedRaw) {
        try {
          priorSeeds.push(JSON.parse(seedRaw) as TrilogySeeds);
        } catch { /* skip */ }
      }
    }

    return {
      series_id: series.series_id,
      series_name: series.series_name,
      book_count: series.book_order.length,
      current_book: series.book_order.length,
      shared_world_elements: series.shared_world_elements,
      prior_seeds: priorSeeds,
    };
  } catch {
    return null;
  }
}

/**
 * Capture trilogy seeds from a completed book.
 */
export async function captureTrilogySeeds(
  seriesId: string,
  projectId: string,
  bookNumber: number,
  seeds: TrilogySeed[],
): Promise<void> {
  const record: TrilogySeeds = {
    project_id: projectId,
    book_number: bookNumber,
    seeds,
    captured_at: new Date().toISOString(),
  };
  await githubStorage.saveFile(seedsPath(seriesId, bookNumber), JSON.stringify(record, null, 2));
}

/**
 * Load world pack for a specific book in a series.
 */
export async function loadWorldPack(seriesId: string, bookNumber: number): Promise<WorldPack | null> {
  const raw = await githubStorage.loadFile(worldPackPath(seriesId, bookNumber));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorldPack;
  } catch {
    return null;
  }
}

/**
 * Save world pack.
 */
export async function saveWorldPack(pack: WorldPack): Promise<void> {
  await githubStorage.saveFile(worldPackPath(pack.series_id, pack.book_number), JSON.stringify(pack, null, 2));
}

/**
 * List all series.
 */
export async function listSeries(): Promise<SeriesIndex["series"]> {
  const index = await loadSeriesIndex();
  return index.series;
}

/**
 * Load full series record.
 */
export async function loadSeries(seriesId: string): Promise<Series | null> {
  const raw = await githubStorage.loadFile(seriesPath(seriesId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Series;
  } catch {
    return null;
  }
}
