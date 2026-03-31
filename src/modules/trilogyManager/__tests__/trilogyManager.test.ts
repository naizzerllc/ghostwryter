import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSeries,
  addBookToSeries,
  getSeriesContext,
  captureTrilogySeeds,
  listSeries,
  loadSeries,
} from "../trilogyManager";

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

describe("trilogyManager", () => {
  it("createSeries returns series with correct fields", async () => {
    const series = await createSeries("Dark Waters Trilogy", [
      { project_id: "book-1", title: "Book One" },
    ]);
    expect(series.series_name).toBe("Dark Waters Trilogy");
    expect(series.book_order).toHaveLength(1);
    expect(series.book_order[0].book_number).toBe(1);
    expect(series.series_status).toBe("PLANNING");
  });

  it("createSeries adds to series index", async () => {
    await createSeries("Test Series", [{ project_id: "b1", title: "B1" }]);
    const list = await listSeries();
    expect(list).toHaveLength(1);
    expect(list[0].series_name).toBe("Test Series");
  });

  it("addBookToSeries appends book and updates index", async () => {
    const series = await createSeries("Trilogy", [{ project_id: "b1", title: "One" }]);
    const ok = await addBookToSeries(series.series_id, "b2", "Two");
    expect(ok).toBe(true);

    const loaded = await loadSeries(series.series_id);
    expect(loaded?.book_order).toHaveLength(2);
    expect(loaded?.book_order[1].title).toBe("Two");
    expect(loaded?.book_order[1].book_number).toBe(2);

    const list = await listSeries();
    expect(list[0].book_count).toBe(2);
  });

  it("addBookToSeries returns false for unknown series", async () => {
    const ok = await addBookToSeries("nonexistent", "b1", "Book");
    expect(ok).toBe(false);
  });

  it("getSeriesContext returns compressed context", async () => {
    const series = await createSeries("Context Test", [
      { project_id: "c1", title: "First" },
      { project_id: "c2", title: "Second" },
    ]);
    const ctx = await getSeriesContext(series.series_id);
    expect(ctx).not.toBeNull();
    expect(ctx!.series_name).toBe("Context Test");
    expect(ctx!.book_count).toBe(2);
    expect(ctx!.prior_seeds).toHaveLength(0);
  });

  it("getSeriesContext includes prior seeds", async () => {
    const series = await createSeries("Seed Test", [{ project_id: "s1", title: "S1" }]);
    await captureTrilogySeeds(series.series_id, "s1", 1, [
      { thread_id: "t1", description: "Open thread", source_chapter: 30, seed_type: "unresolved_thread", priority: "high" },
    ]);
    const ctx = await getSeriesContext(series.series_id);
    expect(ctx!.prior_seeds).toHaveLength(1);
    expect(ctx!.prior_seeds[0].seeds[0].thread_id).toBe("t1");
  });

  it("getSeriesContext returns null for unknown series", async () => {
    const ctx = await getSeriesContext("ghost-series");
    expect(ctx).toBeNull();
  });

  it("captureTrilogySeeds saves seeds to correct path", async () => {
    const series = await createSeries("Capture Test", [{ project_id: "p1", title: "P1" }]);
    await captureTrilogySeeds(series.series_id, "p1", 1, [
      { thread_id: "x", description: "Test", source_chapter: 1, seed_type: "character_fate", priority: "medium" },
    ]);
    const key = Object.keys(store).find((k) => k.includes("seeds_1.json"));
    expect(key).toBeDefined();
    const data = JSON.parse(store[key!]);
    expect(data.seeds).toHaveLength(1);
  });

  it("loadSeries returns null for unknown series", async () => {
    const result = await loadSeries("nonexistent");
    expect(result).toBeNull();
  });
});
