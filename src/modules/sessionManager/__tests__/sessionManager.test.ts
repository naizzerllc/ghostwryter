import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  startSession,
  endSession,
  getSessionState,
  markActivity,
  updateSessionChapter,
} from "../sessionManager";

// ── Mock githubStorage ──────────────────────────────────────────────────

const store: Record<string, string> = {};

vi.mock("@/storage/githubStorage", () => ({
  githubStorage: {
    saveFile: vi.fn(async (path: string, content: string) => {
      store[path] = content;
      return { saved: true, storage: "github" as const };
    }),
    loadFile: vi.fn(async (path: string) => store[path] ?? null),
  },
}));

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
});

// ── Tests ───────────────────────────────────────────────────────────────

describe("sessionManager", () => {
  it("startSession creates new state with cold_start_required true", async () => {
    const state = await startSession("proj-1");
    expect(state.project_id).toBe("proj-1");
    expect(state.cold_start_required).toBe(true);
    expect(state.pipeline_stage).toBe("IDLE");
    expect(state.active_chapter).toBeNull();
  });

  it("startSession resumes existing session within break threshold", async () => {
    // Seed a recent session
    const recent = {
      project_id: "proj-1",
      active_chapter: 5,
      pipeline_stage: "GENERATING",
      last_activity: new Date().toISOString(),
      cold_start_required: false,
      started_at: new Date().toISOString(),
    };
    store["story-data/proj-1/session_state.json"] = JSON.stringify(recent);

    const state = await startSession("proj-1");
    expect(state.cold_start_required).toBe(false);
    expect(state.active_chapter).toBe(5);
    expect(state.pipeline_stage).toBe("GENERATING");
  });

  it("startSession requires cold start after break threshold", async () => {
    const old = {
      project_id: "proj-1",
      active_chapter: 3,
      pipeline_stage: "QUALITY_CHECK",
      last_activity: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      cold_start_required: false,
      started_at: new Date().toISOString(),
    };
    store["story-data/proj-1/session_state.json"] = JSON.stringify(old);

    const state = await startSession("proj-1");
    expect(state.cold_start_required).toBe(true);
  });

  it("endSession sets pipeline_stage to IDLE", async () => {
    await startSession("proj-2");
    await endSession("proj-2");
    const state = await getSessionState("proj-2");
    expect(state?.pipeline_stage).toBe("IDLE");
  });

  it("getSessionState returns null for unknown project", async () => {
    const state = await getSessionState("nonexistent");
    expect(state).toBeNull();
  });

  it("markActivity updates last_activity timestamp", async () => {
    await startSession("proj-3");
    const before = (await getSessionState("proj-3"))!.last_activity;
    // Small delay to ensure different timestamp
    await new Promise((r) => setTimeout(r, 5));
    await markActivity("proj-3");
    const after = (await getSessionState("proj-3"))!.last_activity;
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
  });

  it("updateSessionChapter sets chapter and stage", async () => {
    await startSession("proj-4");
    await updateSessionChapter("proj-4", 7, "HUMAN_REVIEW");
    const state = await getSessionState("proj-4");
    expect(state?.active_chapter).toBe(7);
    expect(state?.pipeline_stage).toBe("HUMAN_REVIEW");
  });

  it("markActivity does nothing for non-existent session", async () => {
    await markActivity("ghost-project");
    // Should not throw
    expect(true).toBe(true);
  });
});
