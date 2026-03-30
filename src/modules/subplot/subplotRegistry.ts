/**
 * Subplot Registry — Imports and tracks subplot threads from outline.
 * GHOSTLY v2.2 · Session 13
 */

import { githubStorage } from "@/storage/githubStorage";

// ── Types ───────────────────────────────────────────────────────────────

export interface SubplotRecord {
  subplot_id: string;
  subplot_description: string;
  introduced_chapter: number;
  subplot_type: string;
  resolution_chapter: number;
  act_2_touch_minimum: number;
  act_2_touch_log: number[];
  touch_count_total: number;
}

export type SubplotStatus = "active" | "dormant" | "dark" | "resolved";

export interface SubplotStatusEntry {
  subplot_id: string;
  subplot_description: string;
  status: SubplotStatus;
  touches_in_act_2: number;
  minimum_required: number;
  compliant: boolean;
}

// ── Storage ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "ghostly_subplot_registry";

function loadSubplots(): SubplotRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSubplots(subplots: SubplotRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subplots));
}

// ── Public API ──────────────────────────────────────────────────────────

export function getAllSubplots(): SubplotRecord[] {
  return loadSubplots();
}

/**
 * Import subplot registry from parsed outline data.
 */
export function importSubplots(
  subplotData: Array<Record<string, unknown>>
): SubplotRecord[] {
  const subplots: SubplotRecord[] = subplotData.map((s, i) => ({
    subplot_id: String(s.subplot_id ?? `subplot_${i + 1}`),
    subplot_description: String(s.subplot_description ?? s.description ?? ""),
    introduced_chapter: Number(s.introduced_chapter) || 1,
    subplot_type: String(s.subplot_type ?? s.type ?? "secondary"),
    resolution_chapter: Number(s.resolution_chapter) || 30,
    act_2_touch_minimum: Number(s.act_2_touch_minimum) || 2,
    act_2_touch_log: Array.isArray(s.act_2_touch_log)
      ? s.act_2_touch_log.map(Number)
      : [],
    touch_count_total: Number(s.touch_count_total) || 0,
  }));

  saveSubplots(subplots);
  return subplots;
}

/**
 * Log a subplot touch at a given chapter.
 */
export function logSubplotTouch(
  subplotId: string,
  chapterNumber: number,
  act: 1 | 2 | 3
): void {
  const subplots = loadSubplots();
  const sp = subplots.find((s) => s.subplot_id === subplotId);
  if (!sp) return;

  sp.touch_count_total += 1;
  if (act === 2 && !sp.act_2_touch_log.includes(chapterNumber)) {
    sp.act_2_touch_log.push(chapterNumber);
  }
  saveSubplots(subplots);
}

/**
 * Get subplot status at a given chapter for Manuscript Health Dashboard.
 */
export function getSubplotStatuses(currentChapter: number): SubplotStatusEntry[] {
  const subplots = loadSubplots();

  return subplots.map((sp) => {
    let status: SubplotStatus;
    if (currentChapter >= sp.resolution_chapter) {
      status = "resolved";
    } else if (currentChapter < sp.introduced_chapter) {
      status = "dark";
    } else {
      // Active if touched in last 5 chapters, dormant otherwise
      const recentTouch = sp.act_2_touch_log.some(
        (ch) => currentChapter - ch <= 5
      );
      status = recentTouch || sp.touch_count_total === 0 ? "active" : "dormant";
    }

    const compliant =
      status === "resolved" ||
      status === "dark" ||
      sp.act_2_touch_log.length >= sp.act_2_touch_minimum;

    return {
      subplot_id: sp.subplot_id,
      subplot_description: sp.subplot_description,
      status,
      touches_in_act_2: sp.act_2_touch_log.length,
      minimum_required: sp.act_2_touch_minimum,
      compliant,
    };
  });
}

/**
 * Save subplot registry to GitHub.
 */
export async function saveSubplotsToGitHub(
  projectId: string
): Promise<void> {
  const subplots = loadSubplots();
  await githubStorage.saveFile(
    `story-data/${projectId}/subplot_registry.json`,
    JSON.stringify(subplots, null, 2)
  );
}
