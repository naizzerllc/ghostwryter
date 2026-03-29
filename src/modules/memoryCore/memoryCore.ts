/**
 * Memory Core — staged propose/confirm/reject flow for memory updates.
 * GHOSTLY v2.2 · Session 5
 *
 * All memory updates are staged (PENDING_CONFIRMATION) and require
 * human confirmation before being committed to GitHub.
 */

import githubStorage from "@/storage/githubStorage";
import { MEMORY_CORE_CONFIG } from "@/constants/MEMORY_CORE_CONFIG";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type MemoryCoreStatus = "READY" | "PENDING_CONFIRMATION" | "UPDATING";

export interface MemoryState {
  projectId: string;
  data: Record<string, unknown>;
  lastUpdated: string | null;
}

export interface StagedUpdate {
  projectId: string;
  updateData: Record<string, unknown>;
  stagedAt: string;
}

interface MemoryCoreInternals {
  status: MemoryCoreStatus;
  committed: Map<string, MemoryState>;
  staged: StagedUpdate | null;
  listeners: Set<() => void>;
}

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------
const state: MemoryCoreInternals = {
  status: "READY",
  committed: new Map(),
  staged: null,
  listeners: new Set(),
};

function notify() {
  state.listeners.forEach((fn) => fn());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Subscribe to state changes (for React useSyncExternalStore). */
export function subscribe(listener: () => void): () => void {
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

/** Return a snapshot reference that changes on every notify(). */
let snapshotVersion = 0;
let cachedSnapshot: MemoryCoreSnapshot | null = null;

export interface MemoryCoreSnapshot {
  status: MemoryCoreStatus;
  staged: StagedUpdate | null;
  committedProjects: string[];
  lastUpdated: string | null;
  _v: number;
}

export function getSnapshot(): MemoryCoreSnapshot {
  if (cachedSnapshot && cachedSnapshot._v === snapshotVersion) return cachedSnapshot;

  const projects = Array.from(state.committed.keys());
  const latest = projects.reduce<string | null>((acc, id) => {
    const ts = state.committed.get(id)?.lastUpdated ?? null;
    if (!ts) return acc;
    if (!acc) return ts;
    return ts > acc ? ts : acc;
  }, null);

  cachedSnapshot = {
    status: state.status,
    staged: state.staged,
    committedProjects: projects,
    lastUpdated: latest,
    _v: snapshotVersion,
  };
  return cachedSnapshot;
}

/** Stage an update for human review. */
export function proposeUpdate(
  projectId: string,
  updateData: Record<string, unknown>
): { ok: boolean; error?: string } {
  if (state.status !== "READY") {
    return { ok: false, error: `Cannot propose while status is ${state.status}` };
  }

  state.staged = {
    projectId,
    updateData,
    stagedAt: new Date().toISOString(),
  };
  state.status = "PENDING_CONFIRMATION";
  snapshotVersion++;
  notify();
  return { ok: true };
}

/** Confirm the staged update — commits to GitHub. */
export async function confirmUpdate(
  projectId: string
): Promise<{ ok: boolean; storage?: string; error?: string }> {
  if (state.status !== "PENDING_CONFIRMATION" || !state.staged) {
    return { ok: false, error: "No pending update to confirm" };
  }
  if (state.staged.projectId !== projectId) {
    return { ok: false, error: `Staged update is for project "${state.staged.projectId}", not "${projectId}"` };
  }

  state.status = "UPDATING";
  snapshotVersion++;
  notify();

  const existing = state.committed.get(projectId);
  const mergedData = { ...(existing?.data ?? {}), ...state.staged.updateData };
  const now = new Date().toISOString();

  // Persist to GitHub (falls back to localStorage internally)
  const result = await githubStorage.saveFile(
    `memory/${projectId}.json`,
    JSON.stringify({ projectId, data: mergedData, lastUpdated: now }, null, 2),
    `Memory Core update — ${projectId}`
  );

  state.committed.set(projectId, {
    projectId,
    data: mergedData,
    lastUpdated: now,
  });

  state.staged = null;
  state.status = "READY";
  snapshotVersion++;
  notify();

  return { ok: true, storage: result.storage };
}

/** Reject the staged update — discard and return to READY. */
export function rejectUpdate(
  projectId: string
): { ok: boolean; error?: string } {
  if (state.status !== "PENDING_CONFIRMATION" || !state.staged) {
    return { ok: false, error: "No pending update to reject" };
  }
  if (state.staged.projectId !== projectId) {
    return { ok: false, error: `Staged update is for project "${state.staged.projectId}"` };
  }

  state.staged = null;
  state.status = "READY";
  snapshotVersion++;
  notify();
  return { ok: true };
}

/** Get current committed memory state for a project. */
export function getCurrentState(
  projectId: string
): MemoryState | null {
  return state.committed.get(projectId) ?? null;
}

/** Get current status. */
export function getStatus(): MemoryCoreStatus {
  return state.status;
}

/** Get the config (profiles + budgets). */
export function getConfig() {
  return MEMORY_CORE_CONFIG;
}

// ---------------------------------------------------------------------------
// Window registration for console testing
// ---------------------------------------------------------------------------
if (typeof window !== "undefined") {
  (window as Record<string, unknown>).__ghostly_memoryCore = {
    proposeUpdate,
    confirmUpdate,
    rejectUpdate,
    getCurrentState,
    getStatus,
    getConfig,
    getSnapshot,
  };
}
