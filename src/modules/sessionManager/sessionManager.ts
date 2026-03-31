/**
 * Session Manager — S24
 * Tracks active generation session state per project.
 */

import { githubStorage } from "@/storage/githubStorage";

// ── Types ───────────────────────────────────────────────────────────────

export interface SessionState {
  project_id: string;
  active_chapter: number | null;
  pipeline_stage: string;
  last_activity: string;
  cold_start_required: boolean;
  started_at: string;
}

// ── Paths ───────────────────────────────────────────────────────────────

function sessionPath(projectId: string): string {
  return `story-data/${projectId}/session_state.json`;
}

// ── Session break threshold (30 minutes) ────────────────────────────────

const SESSION_BREAK_MS = 30 * 60 * 1000;

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Start a session for a project. Checks for session break.
 */
export async function startSession(projectId: string): Promise<SessionState> {
  const existing = await getSessionState(projectId);
  const now = new Date().toISOString();

  let coldStartRequired = true;
  if (existing) {
    const elapsed = Date.now() - new Date(existing.last_activity).getTime();
    coldStartRequired = elapsed > SESSION_BREAK_MS;
  }

  const state: SessionState = {
    project_id: projectId,
    active_chapter: existing?.active_chapter ?? null,
    pipeline_stage: existing?.pipeline_stage ?? "IDLE",
    last_activity: now,
    cold_start_required: coldStartRequired,
    started_at: existing?.started_at ?? now,
  };

  await githubStorage.saveFile(sessionPath(projectId), JSON.stringify(state, null, 2));
  return state;
}

/**
 * End session — save final state.
 */
export async function endSession(projectId: string): Promise<void> {
  const state = await getSessionState(projectId);
  if (state) {
    state.last_activity = new Date().toISOString();
    state.pipeline_stage = "IDLE";
    await githubStorage.saveFile(sessionPath(projectId), JSON.stringify(state, null, 2));
  }
}

/**
 * Get current session state.
 */
export async function getSessionState(projectId: string): Promise<SessionState | null> {
  const raw = await githubStorage.loadFile(sessionPath(projectId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

/**
 * Update last_activity timestamp.
 */
export async function markActivity(projectId: string): Promise<void> {
  const state = await getSessionState(projectId);
  if (state) {
    state.last_activity = new Date().toISOString();
    await githubStorage.saveFile(sessionPath(projectId), JSON.stringify(state, null, 2));
  }
}

/**
 * Update active chapter and pipeline stage.
 */
export async function updateSessionChapter(
  projectId: string,
  chapterNumber: number,
  stage: string,
): Promise<void> {
  const state = await getSessionState(projectId);
  if (state) {
    state.active_chapter = chapterNumber;
    state.pipeline_stage = stage;
    state.last_activity = new Date().toISOString();
    await githubStorage.saveFile(sessionPath(projectId), JSON.stringify(state, null, 2));
  }
}
