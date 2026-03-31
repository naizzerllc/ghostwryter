/**
 * Pipeline State Manager — In-memory state tracking and event emission.
 * Extracted from chapterPipeline.ts for modularity.
 */

import type { PipelineState } from "./pipelineTypes";

// ── Pipeline State Tracking ─────────────────────────────────────────────

const activePipelines: Map<string, PipelineState> = new Map();
const pipelineListeners: Set<(state: PipelineState) => void> = new Set();

export function pipelineKey(chapterNumber: number, projectId: string): string {
  return `${projectId}:ch${chapterNumber}`;
}

export function emitStateChange(state: PipelineState): void {
  pipelineListeners.forEach(listener => {
    try { listener(state); } catch (e) { console.error("[Pipeline] Listener error:", e); }
  });
}

export function subscribeToPipeline(listener: (state: PipelineState) => void): () => void {
  pipelineListeners.add(listener);
  return () => pipelineListeners.delete(listener);
}

export function getPipelineState(chapterNumber: number, projectId: string): PipelineState | null {
  return activePipelines.get(pipelineKey(chapterNumber, projectId)) ?? null;
}

export function setPipelineState(key: string, state: PipelineState): void {
  activePipelines.set(key, state);
}

export function getActivePipelines(): Map<string, PipelineState> {
  return activePipelines;
}
