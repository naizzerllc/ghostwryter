/**
 * Calibration Anchor Store — Stores and retrieves AI tell examples
 * from approved chapters for use by the Prose Texture Pass.
 * GHOSTLY v2.2 · Session 25
 *
 * Each anchor captures: a flagged passage, why it was flagged,
 * and the approved revision. The texture pass uses these as
 * concrete revision targets for future chapters.
 *
 * Storage: GitHub primary, localStorage fallback.
 */

import { githubStorage } from "@/storage/githubStorage";
import type { CalibrationAnchor } from "./texturePass";
import type { GenreTell } from "@/modules/quality/antiAIDetector";

// ── Types ───────────────────────────────────────────────────────────────

export interface StoredCalibrationAnchor extends CalibrationAnchor {
  source_chapter: number;
  created_at: string;
  category: string;
}

interface CalibrationAnchorStore {
  anchors: StoredCalibrationAnchor[];
  last_updated: string;
}

// ── Storage ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "ghostly_calibration_anchors";
const MAX_ANCHORS = 30; // cap to control prompt size

function loadStore(): CalibrationAnchorStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { anchors: [], last_updated: "" };
  } catch {
    return { anchors: [], last_updated: "" };
  }
}

function saveStore(store: CalibrationAnchorStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Record calibration anchors from a chapter's anti-AI detection results.
 * Called after a chapter passes quality review with human-approved revisions.
 *
 * @param chapterNumber - source chapter
 * @param tells - GenreTell[] from anti-AI detector
 * @param revisedText - the human-approved/texture-revised final text
 */
export function recordAnchorsFromTells(
  chapterNumber: number,
  tells: GenreTell[],
  revisedText: string,
): StoredCalibrationAnchor[] {
  const store = loadStore();
  const newAnchors: StoredCalibrationAnchor[] = [];

  for (const tell of tells) {
    if (!tell.excerpt || tell.severity === "NOTE") continue;

    // Try to find the revised version in the approved text
    // by looking for content near the same location
    const revisedPassage = extractRevisedPassage(tell, revisedText);

    const anchor: StoredCalibrationAnchor = {
      tell_id: `${chapterNumber}_${tell.tell_id}`,
      example_passage: tell.excerpt,
      why_flagged: `[${tell.category}] ${tell.description}`,
      revised_passage: revisedPassage ?? tell.excerpt, // fallback to original if no revision found
      source_chapter: chapterNumber,
      created_at: new Date().toISOString(),
      category: tell.category,
    };

    // Skip duplicates by tell_id
    if (!store.anchors.some(a => a.tell_id === anchor.tell_id)) {
      newAnchors.push(anchor);
      store.anchors.push(anchor);
    }
  }

  // Cap total anchors — keep newest, most diverse by category
  if (store.anchors.length > MAX_ANCHORS) {
    store.anchors = pruneAnchors(store.anchors, MAX_ANCHORS);
  }

  store.last_updated = new Date().toISOString();
  saveStore(store);

  return newAnchors;
}

/**
 * Record a manual calibration anchor (operator-created).
 */
export function addManualAnchor(
  anchor: Omit<StoredCalibrationAnchor, "created_at">,
): void {
  const store = loadStore();

  if (store.anchors.some(a => a.tell_id === anchor.tell_id)) return;

  store.anchors.push({
    ...anchor,
    created_at: new Date().toISOString(),
  });

  if (store.anchors.length > MAX_ANCHORS) {
    store.anchors = pruneAnchors(store.anchors, MAX_ANCHORS);
  }

  store.last_updated = new Date().toISOString();
  saveStore(store);
}

/**
 * Load calibration anchors for injection into the texture pass.
 * Returns the most relevant anchors, prioritising CRITICAL tells
 * and diverse categories.
 */
export function loadCalibrationAnchors(
  _projectId: string,
  _chapterNumber: number,
  maxAnchors: number = 10,
): CalibrationAnchor[] {
  const store = loadStore();
  if (store.anchors.length === 0) return [];

  // Prioritise: CRITICAL excerpts first, then diverse categories
  const sorted = [...store.anchors].sort((a, b) => {
    // Newer anchors slightly preferred
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Ensure category diversity: pick at most 2 per category
  const selected: CalibrationAnchor[] = [];
  const categoryCounts: Record<string, number> = {};

  for (const anchor of sorted) {
    if (selected.length >= maxAnchors) break;
    const count = categoryCounts[anchor.category] ?? 0;
    if (count >= 2) continue;

    selected.push({
      tell_id: anchor.tell_id,
      example_passage: anchor.example_passage,
      why_flagged: anchor.why_flagged,
      revised_passage: anchor.revised_passage,
    });
    categoryCounts[anchor.category] = count + 1;
  }

  return selected;
}

/**
 * Get all stored anchors (for UI display).
 */
export function getAllAnchors(): StoredCalibrationAnchor[] {
  return loadStore().anchors;
}

/**
 * Remove a specific anchor by tell_id.
 */
export function removeAnchor(tellId: string): void {
  const store = loadStore();
  store.anchors = store.anchors.filter(a => a.tell_id !== tellId);
  store.last_updated = new Date().toISOString();
  saveStore(store);
}

/**
 * Sync anchors to GitHub storage.
 */
export async function syncAnchorsToGitHub(projectId: string): Promise<void> {
  const store = loadStore();
  try {
    await githubStorage.saveFile(
      `story-data/${projectId}/calibration_anchors.json`,
      JSON.stringify(store, null, 2),
    );
  } catch (error) {
    console.error("[CalibrationAnchors] GitHub sync failed:", error);
  }
}

/**
 * Load anchors from GitHub into localStorage.
 */
export async function loadAnchorsFromGitHub(projectId: string): Promise<boolean> {
  try {
    const raw = await githubStorage.loadFile(
      `story-data/${projectId}/calibration_anchors.json`,
    );
    if (raw) {
      const parsed = JSON.parse(raw);
      saveStore(parsed);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ── Internal Helpers ────────────────────────────────────────────────────

/**
 * Attempt to extract the revised version of a flagged passage
 * from the approved text. Uses simple proximity matching.
 */
function extractRevisedPassage(
  tell: GenreTell,
  revisedText: string,
): string | null {
  if (!tell.excerpt) return null;

  // If the exact excerpt still exists in the revised text,
  // it wasn't actually revised — return null
  if (revisedText.includes(tell.excerpt)) return null;

  // Try to find nearby content using the first few words as anchor
  const words = tell.excerpt.split(/\s+/).slice(0, 4).join(" ");
  const idx = revisedText.indexOf(words);
  if (idx !== -1) {
    // Extract a passage of similar length around the match
    const start = Math.max(0, idx - 20);
    const end = Math.min(revisedText.length, idx + tell.excerpt.length + 40);
    return revisedText.slice(start, end).trim();
  }

  return null;
}

/**
 * Prune anchors to max count, maintaining category diversity.
 */
function pruneAnchors(
  anchors: StoredCalibrationAnchor[],
  max: number,
): StoredCalibrationAnchor[] {
  // Sort by recency
  const sorted = [...anchors].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const result: StoredCalibrationAnchor[] = [];
  const categoryCounts: Record<string, number> = {};

  for (const anchor of sorted) {
    if (result.length >= max) break;
    const count = categoryCounts[anchor.category] ?? 0;
    if (count >= 5) continue; // max 5 per category
    result.push(anchor);
    categoryCounts[anchor.category] = count + 1;
  }

  return result;
}
