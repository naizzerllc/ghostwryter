/**
 * Catalogue Registry — catalogue_registry_record management + Fit Check.
 * GHOSTLY v2.2 · Prompt 02
 *
 * Persisted to catalogue/CATALOGUE_REGISTRY.json.
 * Fit Check flags self_deception_category reuse and revelation_mechanism reuse.
 */

import { githubStorage } from "@/storage/githubStorage";

// ── Types (MIC v2.1 catalogue_registry_record) ─────────────────────────

export interface CatalogueRegistryRecord {
  title_id: string;
  title_name: string;
  title: string; // alias kept for backward compat
  status: "ACTIVE" | "COMPLETE" | "ARCHIVED";
  self_deception_category: string;
  protagonist_wound_type: string;
  antagonist_type: string;
  revelation_mechanism: string;
  key_imagery_set: string[];
  genre_mode: string;
  creation_date: string;
  completion_date?: string;
  created_at: string; // legacy alias
}

export interface FitCheckIssue {
  field: string;
  message: string;
  severity: "error" | "warning" | "note";
  conflicting_title_id: string;
}

export interface CatalogueFitResult {
  title_id: string;
  fit_score: number; // 1-5
  warnings: FitCheckIssue[];
  notes: FitCheckIssue[];
  recommendation: string;
  passed: boolean;
}

// Legacy alias
export type FitCheckResult = CatalogueFitResult;

// ── State ───────────────────────────────────────────────────────────────

const registry: Map<string, CatalogueRegistryRecord> = new Map();
const listeners: Set<() => void> = new Set();
let snapshotVersion = 0;

function notify() {
  snapshotVersion++;
  listeners.forEach(fn => fn());
}

// ── Persistence ─────────────────────────────────────────────────────────

const STORAGE_PATH = "catalogue/CATALOGUE_REGISTRY.json";

async function persist(): Promise<void> {
  const data = JSON.stringify(Array.from(registry.values()), null, 2);
  await githubStorage.saveFile(STORAGE_PATH, data);
}

export async function loadRegistry(): Promise<{ loaded: number; errors: string[] }> {
  const raw = await githubStorage.loadFile(STORAGE_PATH);
  if (!raw) return { loaded: 0, errors: [] };

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { loaded: 0, errors: ["CATALOGUE_REGISTRY.json is not an array"] };

    const errors: string[] = [];
    let loaded = 0;

    for (const record of parsed) {
      if (!record.title_id || !record.title) {
        errors.push(`Invalid record: missing title_id or title`);
        continue;
      }
      registry.set(record.title_id, record as CatalogueRegistryRecord);
      loaded++;
    }

    if (loaded > 0) notify();
    return { loaded, errors };
  } catch (err) {
    return { loaded: 0, errors: [err instanceof Error ? err.message : "Parse error"] };
  }
}

// ── CRUD ────────────────────────────────────────────────────────────────

export function addTitle(record: CatalogueRegistryRecord): { ok: boolean; error?: string } {
  if (!record.title_id || !record.title) {
    return { ok: false, error: "title_id and title are required" };
  }
  if (registry.has(record.title_id)) {
    return { ok: false, error: `Title "${record.title_id}" already exists` };
  }

  registry.set(record.title_id, {
    ...record,
    created_at: record.created_at || new Date().toISOString(),
  });
  notify();
  persist();
  return { ok: true };
}

export function updateTitle(titleId: string, updates: Partial<CatalogueRegistryRecord>): { ok: boolean; error?: string } {
  const existing = registry.get(titleId);
  if (!existing) return { ok: false, error: `Title "${titleId}" not found` };

  registry.set(titleId, { ...existing, ...updates, title_id: titleId });
  notify();
  persist();
  return { ok: true };
}

export function removeTitle(titleId: string): boolean {
  const deleted = registry.delete(titleId);
  if (deleted) {
    notify();
    persist();
  }
  return deleted;
}

export function getTitle(titleId: string): CatalogueRegistryRecord | null {
  return registry.get(titleId) ?? null;
}

export function getAllTitles(): CatalogueRegistryRecord[] {
  return Array.from(registry.values());
}

// ── Catalogue Fit Check ─────────────────────────────────────────────────

/**
 * Enhanced fit check — compares incoming against existing catalogue.
 * Checks: self_deception_category, protagonist_wound_type, revelation_mechanism, key_imagery_set overlap.
 * Returns fit_score 1-5, warnings, notes, recommendation.
 */
export function runFitCheck(
  titleId: string,
  record: Pick<CatalogueRegistryRecord, "self_deception_category" | "revelation_mechanism" | "protagonist_wound_type" | "key_imagery_set">,
): CatalogueFitResult {
  const warnings: FitCheckIssue[] = [];
  const notes: FitCheckIssue[] = [];
  let deductions = 0;

  for (const [existingId, existing] of registry) {
    if (existingId === titleId) continue;
    if (existing.status === "ARCHIVED") continue;

    // Self-deception category reuse — WARNING (COMPLETE titles only)
    if (
      record.self_deception_category &&
      existing.self_deception_category &&
      record.self_deception_category.toLowerCase() === existing.self_deception_category.toLowerCase() &&
      existing.status === "COMPLETE"
    ) {
      warnings.push({
        field: "self_deception_category",
        message: `Self-deception category reused — reader familiarity risk. Consider variation. Conflicts with "${existing.title_name || existing.title}".`,
        severity: "warning",
        conflicting_title_id: existingId,
      });
      deductions += 2;
    }

    // Protagonist wound type reuse — NOTE
    if (
      record.protagonist_wound_type &&
      existing.protagonist_wound_type &&
      record.protagonist_wound_type.toLowerCase() === existing.protagonist_wound_type.toLowerCase()
    ) {
      notes.push({
        field: "protagonist_wound_type",
        message: `Protagonist wound type "${record.protagonist_wound_type}" also used in "${existing.title_name || existing.title}".`,
        severity: "note",
        conflicting_title_id: existingId,
      });
      deductions += 0.5;
    }

    // Revelation mechanism reuse — WARNING
    if (
      record.revelation_mechanism &&
      existing.revelation_mechanism &&
      record.revelation_mechanism.toLowerCase() === existing.revelation_mechanism.toLowerCase()
    ) {
      warnings.push({
        field: "revelation_mechanism",
        message: `Revelation mechanism reused — twist predictability risk. Conflicts with "${existing.title_name || existing.title}".`,
        severity: "warning",
        conflicting_title_id: existingId,
      });
      deductions += 1.5;
    }

    // Key imagery overlap > 50% — WARNING
    if (record.key_imagery_set && record.key_imagery_set.length > 0 && existing.key_imagery_set?.length > 0) {
      const incomingSet = new Set(record.key_imagery_set.map(s => s.toLowerCase().trim()));
      const overlapCount = existing.key_imagery_set.filter(s => incomingSet.has(s.toLowerCase().trim())).length;
      const overlapRatio = overlapCount / Math.max(incomingSet.size, 1);
      if (overlapRatio > 0.5) {
        warnings.push({
          field: "key_imagery_set",
          message: `>${Math.round(overlapRatio * 100)}% imagery overlap with "${existing.title_name || existing.title}" — visual identity conflict.`,
          severity: "warning",
          conflicting_title_id: existingId,
        });
        deductions += 1;
      }
    }
  }

  const rawScore = Math.max(1, Math.min(5, 5 - deductions));
  const fit_score = Math.round(rawScore) as 1 | 2 | 3 | 4 | 5;

  let recommendation = "Strong catalogue fit — no significant overlap detected.";
  if (fit_score <= 2) recommendation = "High overlap risk — significant differentiation changes needed before proceeding.";
  else if (fit_score <= 3) recommendation = "Moderate overlap — consider adjusting flagged elements for stronger catalogue differentiation.";
  else if (fit_score <= 4) recommendation = "Minor overlap notes — review before committing.";

  return {
    title_id: titleId,
    fit_score,
    warnings,
    notes,
    recommendation,
    passed: warnings.filter(w => w.field === "self_deception_category").length === 0,
  };
}

// ── React integration ───────────────────────────────────────────────────

export interface CatalogueSnapshot {
  titles: CatalogueRegistryRecord[];
  count: number;
  byStatus: { ACTIVE: number; COMPLETE: number; ARCHIVED: number };
  _v: number;
}

let cachedSnapshot: CatalogueSnapshot | null = null;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getSnapshot(): CatalogueSnapshot {
  if (cachedSnapshot && cachedSnapshot._v === snapshotVersion) return cachedSnapshot;

  const all = getAllTitles();
  cachedSnapshot = {
    titles: all,
    count: all.length,
    byStatus: {
      ACTIVE: all.filter(t => t.status === "ACTIVE").length,
      COMPLETE: all.filter(t => t.status === "COMPLETE").length,
      ARCHIVED: all.filter(t => t.status === "ARCHIVED").length,
    },
    _v: snapshotVersion,
  };
  return cachedSnapshot;
}

// ── Window registration ─────────────────────────────────────────────────
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_catalogueRegistry = {
    addTitle,
    updateTitle,
    removeTitle,
    getTitle,
    getAllTitles,
    runFitCheck,
    loadRegistry,
    getSnapshot,
  };
}
