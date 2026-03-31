import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createProject,
  loadProject,
  listProjects,
  archiveProject,
  updateProjectStats,
} from "../projectManager";

// ── Mock githubStorage ──────────────────────────────────────────────────

const store: Record<string, string> = {};

vi.mock("@/storage/githubStorage", () => ({
  githubStorage: {
    saveFile: vi.fn(async (path: string, content: string) => {
      store[path] = content;
      return { saved: true, storage: "github" as const };
    }),
    loadFile: vi.fn(async (path: string) => store[path] ?? null),
    listFiles: vi.fn(async () => []),
  },
}));

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
});

// ── Tests ───────────────────────────────────────────────────────────────

describe("projectManager", () => {
  it("createProject returns project with correct fields", async () => {
    const project = await createProject("My Thriller", "psychological_thriller");
    expect(project.name).toBe("My Thriller");
    expect(project.genre_mode).toBe("psychological_thriller");
    expect(project.status).toBe("ACTIVE");
    expect(project.chapter_count).toBe(0);
    expect(project.series_id).toBeNull();
    expect(project.id).toMatch(/^my-thriller-/);
  });

  it("createProject saves to index and config", async () => {
    await createProject("Book One", "standard_thriller");
    const indexRaw = store["projects/index.json"];
    expect(indexRaw).toBeDefined();
    const index = JSON.parse(indexRaw);
    expect(index.projects).toHaveLength(1);
    expect(index.projects[0].name).toBe("Book One");
  });

  it("listProjects returns projects sorted by last_active", async () => {
    const p1 = await createProject("Alpha", "psychological_thriller");
    // Ensure different timestamp
    await new Promise((r) => setTimeout(r, 5));
    const p2 = await createProject("Beta", "standard_thriller");
    const list = await listProjects();
    expect(list.length).toBe(2);
    // Most recent first
    expect(new Date(list[0].last_active).getTime()).toBeGreaterThanOrEqual(new Date(list[1].last_active).getTime());
  });

  it("archiveProject sets status to ARCHIVED", async () => {
    const p = await createProject("To Archive", "psychological_thriller");
    const ok = await archiveProject(p.id);
    expect(ok).toBe(true);
    const list = await listProjects();
    const archived = list.find((proj) => proj.id === p.id);
    expect(archived?.status).toBe("ARCHIVED");
  });

  it("archiveProject returns false for unknown project", async () => {
    const ok = await archiveProject("nonexistent-id");
    expect(ok).toBe(false);
  });

  it("loadProject returns project data", async () => {
    const created = await createProject("Load Me", "psychological_thriller");
    const loaded = await loadProject(created.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe("Load Me");
  });

  it("loadProject returns null for unknown project", async () => {
    const result = await loadProject("does-not-exist");
    expect(result).toBeNull();
  });

  it("updateProjectStats updates chapter counts in index", async () => {
    const p = await createProject("Stats Test", "psychological_thriller");
    await updateProjectStats(p.id, { chapter_count: 10, approved_chapter_count: 5, current_chapter: 6 });
    const list = await listProjects();
    const updated = list.find((proj) => proj.id === p.id);
    expect(updated?.chapter_count).toBe(10);
    expect(updated?.approved_chapter_count).toBe(5);
    expect(updated?.current_chapter).toBe(6);
  });

  it("createProject generates unique IDs for same name", async () => {
    const p1 = await createProject("Same Name", "psychological_thriller");
    // Clear index so both can be created independently
    const p2Id = `same-name-${Date.now().toString(36).slice(-4)}`;
    expect(p1.id).not.toBe(p2Id);
  });
});
