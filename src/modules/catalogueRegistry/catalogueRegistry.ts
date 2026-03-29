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
  title: string;
  self_deception_category: string;
  protagonist_wound_type: string;
  antagonist_type: string;
  revelation_mechanism: string;
  key_imagery_set: string[];
  status: "planned" | "in_progress" | "complete";
  created_at: string;
}

export interface FitCheckIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
  conflicting_title_id: string;
}

export interface FitCheckResult {
  title_id: string;
  passed: boolean;
  issues: FitCheckIssue[];
}

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
 * Check a title (or proposed title) against the existing catalogue for:
 * 1. self_deception_category reuse — CRITICAL: erodes brand differentiation
 * 2. revelation_mechanism reuse — WARNING: reader fatigue risk
 */
export function runFitCheck(
  titleId: string,
  record: Pick<CatalogueRegistryRecord, "self_deception_category" | "revelation_mechanism">,
): FitCheckResult {
  const issues: FitCheckIssue[] = [];

  for (const [existingId, existing] of registry) {
    if (existingId === titleId) continue;

    // Self-deception category reuse — error
    if (
      record.self_deception_category &&
      existing.self_deception_category &&
      record.self_deception_category.toLowerCase() === existing.self_deception_category.toLowerCase()
    ) {
      issues.push({
        field: "self_deception_category",
        message: `Reuses self-deception category "${record.self_deception_category}" from "${existing.title}" — erodes catalogue differentiation`,
        severity: "error",
        conflicting_title_id: existingId,
      });
    }

    // Revelation mechanism reuse — warning
    if (
      record.revelation_mechanism &&
      existing.revelation_mechanism &&
      record.revelation_mechanism.toLowerCase() === existing.revelation_mechanism.toLowerCase()
    ) {
      issues.push({
        field: "revelation_mechanism",
        message: `Reuses revelation mechanism "${record.revelation_mechanism}" from "${existing.title}" — reader fatigue risk`,
        severity: "warning",
        conflicting_title_id: existingId,
      });
    }
  }

  return {
    title_id: titleId,
    passed: issues.filter(i => i.severity === "error").length === 0,
    issues,
  };
}

// ── React integration ───────────────────────────────────────────────────

export interface CatalogueSnapshot {
  titles: CatalogueRegistryRecord[];
  count: number;
  byStatus: { planned: number; in_progress: number; complete: number };
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
      planned: all.filter(t => t.status === "planned").length,
      in_progress: all.filter(t => t.status === "in_progress").length,
      complete: all.filter(t => t.status === "complete").length,
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
