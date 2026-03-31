/**
 * Data loaders for the Manuscript Health dashboard.
 * All read from localStorage — no blocking API calls.
 * GHOSTLY v2.2 · Session 27
 */

import { useMemo } from "react";
import { getProjectAnalytics, getVelocityData } from "@/modules/analytics/analyticsEngine";
import { getSessionSummary } from "@/api/sessionCostTracker";

// ── Individual loaders ──────────────────────────────────────────────────

export function loadMEIStatus(): { status: string; last_chapter: number | null } {
  try {
    const raw = localStorage.getItem("ghostly_mei_latest");
    if (raw) {
      const parsed = JSON.parse(raw);
      return { status: parsed.composite_status ?? "—", last_chapter: parsed.trigger_chapter ?? null };
    }
  } catch { /* ignore */ }
  return { status: "—", last_chapter: null };
}

export function loadSubplotStatus(): { id: string; description: string; status: string }[] {
  try {
    const raw = localStorage.getItem("ghostly_subplot_registry");
    if (raw) {
      const subplots = JSON.parse(raw);
      return Array.isArray(subplots) ? subplots.map((s: { subplot_id: string; subplot_description: string; status?: string }) => ({
        id: s.subplot_id,
        description: s.subplot_description,
        status: s.status ?? "active",
      })) : [];
    }
  } catch { /* ignore */ }
  return [];
}

export function loadRollercoasterStatus(): { compliant: boolean; checked_at: string | null; next_check: number | null } {
  try {
    const raw = localStorage.getItem("ghostly_rollercoaster_result");
    if (raw) {
      const parsed = JSON.parse(raw);
      return { compliant: parsed.compliant ?? true, checked_at: parsed.checked_at ?? null, next_check: null };
    }
  } catch { /* ignore */ }
  return { compliant: true, checked_at: null, next_check: null };
}

export function loadAntiAITrend(): { average: number; count: number } {
  try {
    const raw = localStorage.getItem("ghostly_anti_ai_scores");
    if (raw) {
      const scores = JSON.parse(raw) as number[];
      if (scores.length > 0) {
        const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
        return { average: Math.round(avg * 100) / 100, count: scores.length };
      }
    }
  } catch { /* ignore */ }
  return { average: 0, count: 0 };
}

export function loadSystematicTells(): number {
  try {
    const raw = localStorage.getItem("ghostly_systematic_tells");
    if (raw) {
      const tells = JSON.parse(raw);
      return Array.isArray(tells) ? tells.length : 0;
    }
  } catch { /* ignore */ }
  return 0;
}

export function loadWarmthSpacing(): { next_warmth_due: number | null } {
  try {
    const raw = localStorage.getItem("ghostly_warmth_spacing");
    if (raw) {
      const parsed = JSON.parse(raw);
      return { next_warmth_due: parsed.next_warmth_due ?? null };
    }
  } catch { /* ignore */ }
  return { next_warmth_due: null };
}

export function loadFailureLog(): { type: string; chapter: number | null; description: string; timestamp: string }[] {
  try {
    const raw = localStorage.getItem("ghostly_failure_records");
    if (raw) {
      const records = JSON.parse(raw);
      if (Array.isArray(records)) {
        return records.slice(-5).reverse().map((r: { failure_type: string; chapter_number: number | null; description: string; detected_at: string }) => ({
          type: r.failure_type,
          chapter: r.chapter_number,
          description: r.description,
          timestamp: r.detected_at,
        }));
      }
    }
  } catch { /* ignore */ }
  return [];
}

export function loadMemoryCoreStatus(): { status: string; last_updated: string | null } {
  try {
    const status = localStorage.getItem("ghostly_memory_core_status") ?? "READY";
    const updated = localStorage.getItem("ghostly_memory_core_last_updated") ?? null;
    return { status, last_updated: updated };
  } catch { /* ignore */ }
  return { status: "READY", last_updated: null };
}

export function loadGitHubStatus(): { connected: boolean; last_sync: string | null } {
  try {
    const token = localStorage.getItem("github_token");
    const lastSync = localStorage.getItem("ghostly_github_last_sync") ?? null;
    return { connected: !!token, last_sync: lastSync };
  } catch { /* ignore */ }
  return { connected: false, last_sync: null };
}

// ── Aggregated hook ─────────────────────────────────────────────────────

export function useManuscriptHealthData() {
  const analytics = useMemo(() => getProjectAnalytics(), []);
  const velocity = useMemo(() => getVelocityData(), []);
  const costSummary = useMemo(() => getSessionSummary(), []);
  const mei = useMemo(() => loadMEIStatus(), []);
  const subplots = useMemo(() => loadSubplotStatus(), []);
  const rollercoaster = useMemo(() => loadRollercoasterStatus(), []);
  const antiAI = useMemo(() => loadAntiAITrend(), []);
  const tells = useMemo(() => loadSystematicTells(), []);
  const warmth = useMemo(() => loadWarmthSpacing(), []);
  const failures = useMemo(() => loadFailureLog(), []);
  const memoryCore = useMemo(() => loadMemoryCoreStatus(), []);
  const github = useMemo(() => loadGitHubStatus(), []);

  return { analytics, velocity, costSummary, mei, subplots, rollercoaster, antiAI, tells, warmth, failures, memoryCore, github };
}
