/**
 * Continuity Editor Tests
 * GHOSTLY v2.2 · Quality Module Coverage
 *
 * Tests: claim extraction, canonical facts check, corpus baseline (every 15 chapters),
 * subplot persistence (Act 2), scoring, veto logic, error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runContinuityEditor, type ContinuityEditorInput } from "../continuityEditor";

vi.mock("@/api/llmRouter", () => ({
  callWithFallback: vi.fn(),
}));

vi.mock("@/modules/canonicalFacts/canonicalFactsDB", () => ({
  checkFact: vi.fn(),
  getAllFacts: vi.fn(() => []),
}));

vi.mock("@/modules/subplot/subplotRegistry", () => ({
  getAllSubplots: vi.fn(() => []),
}));

import { callWithFallback } from "@/api/llmRouter";
import { checkFact } from "@/modules/canonicalFacts/canonicalFactsDB";
import { getAllSubplots } from "@/modules/subplot/subplotRegistry";

const mockLLM = vi.mocked(callWithFallback);
const mockCheckFact = vi.mocked(checkFact);
const mockGetAllSubplots = vi.mocked(getAllSubplots);

function baseInput(overrides: Partial<ContinuityEditorInput> = {}): ContinuityEditorInput {
  return {
    chapterNumber: 5,
    chapterContent: "She walks into the room. The walls are blue.",
    act: 1,
    ...overrides,
  };
}

function mockClaimExtraction(claims: string[]) {
  mockLLM.mockResolvedValueOnce({
    content: JSON.stringify(claims),
    model_used: "gemini-2.0-flash",
    provider: "gemini_flash",
    tokens_used: 100,
  } as any);
}

function mockCorpusBaseline(result: { voice_drift_detected: boolean; drift_description: string }) {
  mockLLM.mockResolvedValueOnce({
    content: JSON.stringify(result),
    model_used: "gemini-2.0-flash",
    provider: "gemini_flash",
    tokens_used: 100,
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckFact.mockReturnValue({ consistent: true, conflicting_facts: [] } as any);
});

describe("ContinuityEditor", () => {
  // ── Claim extraction ──

  it("extracts claims via LLM and checks against canonical facts", async () => {
    mockClaimExtraction(["Sarah has brown eyes", "The house is on Oak Street"]);
    const result = await runContinuityEditor(baseInput());
    expect(result.canonical_facts_check.claims_checked).toBe(2);
    expect(result.canonical_facts_check.consistent).toBe(true);
    expect(result.flags).toHaveLength(0);
  });

  it("handles LLM returning claims wrapped in markdown code block", async () => {
    mockLLM.mockResolvedValueOnce({
      content: '```json\n["claim one", "claim two"]\n```',
      model_used: "gemini-2.0-flash",
      provider: "gemini_flash",
      tokens_used: 100,
    } as any);
    const result = await runContinuityEditor(baseInput());
    expect(result.canonical_facts_check.claims_checked).toBe(2);
  });

  it("returns 0 claims on LLM failure", async () => {
    mockLLM.mockRejectedValueOnce(new Error("Provider down"));
    const result = await runContinuityEditor(baseInput());
    expect(result.canonical_facts_check.claims_checked).toBe(0);
    expect(result.canonical_facts_check.consistent).toBe(true);
  });

  // ── Canonical fact violations ──

  it("flags CRITICAL on canonical fact contradiction and triggers veto", async () => {
    mockClaimExtraction(["Sarah has blue eyes"]);
    mockCheckFact.mockReturnValue({
      consistent: false,
      conflicting_facts: [{ statement: "Sarah has brown eyes", fact_id: "F001" }],
    } as any);

    const result = await runContinuityEditor(baseInput());
    expect(result.continuity_veto).toBe(true);
    expect(result.canonical_facts_check.violations).toHaveLength(1);
    expect(result.flags.some(f => f.code === "CONTINUITY_CRITICAL")).toBe(true);
    expect(result.score).toBeLessThan(7);
  });

  it("multiple violations produce multiple CRITICAL flags", async () => {
    mockClaimExtraction(["claim A", "claim B"]);
    mockCheckFact.mockReturnValue({
      consistent: false,
      conflicting_facts: [{ statement: "contradicts", fact_id: "F002" }],
    } as any);

    const result = await runContinuityEditor(baseInput());
    expect(result.flags.filter(f => f.code === "CONTINUITY_CRITICAL")).toHaveLength(2);
    expect(result.continuity_veto).toBe(true);
  });

  // ── Corpus baseline check ──

  it("skips corpus baseline for non-15th chapters", async () => {
    mockClaimExtraction([]);
    const result = await runContinuityEditor(baseInput({ chapterNumber: 7 }));
    expect(result.corpus_baseline_check.ran).toBe(false);
  });

  it("runs corpus baseline at chapter 15 and detects drift", async () => {
    mockClaimExtraction([]);
    mockCorpusBaseline({ voice_drift_detected: true, drift_description: "Warmth creeping in" });

    const result = await runContinuityEditor(baseInput({ chapterNumber: 15 }));
    expect(result.corpus_baseline_check.ran).toBe(true);
    expect(result.corpus_baseline_check.voice_drift_detected).toBe(true);
    expect(result.flags.some(f => f.code === "VOICE_DRIFT")).toBe(true);
  });

  it("runs corpus baseline at chapter 30", async () => {
    mockClaimExtraction([]);
    mockCorpusBaseline({ voice_drift_detected: false, drift_description: "" });

    const result = await runContinuityEditor(baseInput({ chapterNumber: 30 }));
    expect(result.corpus_baseline_check.ran).toBe(true);
    expect(result.corpus_baseline_check.voice_drift_detected).toBe(false);
  });

  it("handles corpus baseline LLM failure gracefully", async () => {
    mockClaimExtraction([]);
    mockLLM.mockRejectedValueOnce(new Error("timeout"));

    const result = await runContinuityEditor(baseInput({ chapterNumber: 15 }));
    expect(result.corpus_baseline_check.ran).toBe(true);
    expect(result.corpus_baseline_check.drift_description).toContain("manual review");
  });

  // ── Subplot persistence ──

  it("skips subplot check for non-Act-2", async () => {
    mockClaimExtraction([]);
    const result = await runContinuityEditor(baseInput({ act: 1 }));
    expect(result.subplot_persistence_check.ran).toBe(false);
  });

  it("detects DARK subplot in Act 2", async () => {
    mockGetAllSubplots.mockReturnValue([
      {
        subplot_id: "SP1",
        subplot_description: "Missing sister",
        introduced_chapter: 3,
        resolution_chapter: 40,
        act_2_touch_log: [],
        subplot_type: "mystery",
        act_2_touch_minimum: 3,
        touch_count_total: 1,
      },
    ]);
    mockClaimExtraction([]);

    const result = await runContinuityEditor(baseInput({ chapterNumber: 25, act: 2 }));
    expect(result.subplot_persistence_check.ran).toBe(true);
    expect(result.subplot_persistence_check.dark_count).toBe(1);
    expect(result.flags.some(f => f.code === "SUBPLOT_DARK")).toBe(true);
  });

  it("detects DORMANT subplot (11-20 chapters since touch)", async () => {
    mockGetAllSubplots.mockReturnValue([
      {
        subplot_id: "SP2",
        subplot_description: "Secret affair",
        introduced_chapter: 5,
        resolution_chapter: 40,
        act_2_touch_log: [10],
        subplot_type: "relationship",
        act_2_touch_minimum: 3,
        touch_count_total: 2,
      },
    ]);
    mockClaimExtraction([]);

    const result = await runContinuityEditor(baseInput({ chapterNumber: 22, act: 2 }));
    expect(result.subplot_persistence_check.dormant_count).toBe(1);
    expect(result.flags.some(f => f.code === "SUBPLOT_DORMANT")).toBe(true);
  });

  it("marks ACTIVE subplot with recent touch", async () => {
    mockGetAllSubplots.mockReturnValue([
      {
        subplot_id: "SP3",
        subplot_description: "Job threat",
        introduced_chapter: 5,
        resolution_chapter: 40,
        act_2_touch_log: [18],
        subplot_type: "tension",
        act_2_touch_minimum: 3,
        touch_count_total: 3,
      },
    ]);
    mockClaimExtraction([]);

    const result = await runContinuityEditor(baseInput({ chapterNumber: 22, act: 2 }));
    expect(result.subplot_persistence_check.dark_count).toBe(0);
    expect(result.subplot_persistence_check.dormant_count).toBe(0);
  });

  it("excludes subplots not yet introduced or already resolved", async () => {
    mockGetAllSubplots.mockReturnValue([
      {
        subplot_id: "SP_FUTURE",
        subplot_description: "Future subplot",
        introduced_chapter: 30,
        resolution_chapter: 40,
        act_2_touch_log: [],
        subplot_type: "mystery",
        act_2_touch_minimum: 2,
        touch_count_total: 0,
      },
      {
        subplot_id: "SP_RESOLVED",
        subplot_description: "Resolved subplot",
        introduced_chapter: 1,
        resolution_chapter: 10,
        act_2_touch_log: [5],
        subplot_type: "mystery",
        act_2_touch_minimum: 1,
        touch_count_total: 2,
      },
    ]);
    mockClaimExtraction([]);

    const result = await runContinuityEditor(baseInput({ chapterNumber: 20, act: 2 }));
    expect(result.subplot_persistence_check.entries).toHaveLength(0);
  });

  // ── Scoring ──

  it("returns perfect 10 with no issues", async () => {
    mockClaimExtraction([]);
    const result = await runContinuityEditor(baseInput());
    expect(result.score).toBe(10);
    expect(result.continuity_veto).toBe(false);
  });

  it("penalizes score for voice drift", async () => {
    mockClaimExtraction([]);
    mockCorpusBaseline({ voice_drift_detected: true, drift_description: "Drift" });

    const result = await runContinuityEditor(baseInput({ chapterNumber: 15 }));
    expect(result.score).toBe(8.5);
  });

  it("penalizes score for dark and dormant subplots", async () => {
    mockGetAllSubplots.mockReturnValue([
      {
        subplot_id: "SP_DARK",
        subplot_description: "Dark one",
        introduced_chapter: 1,
        resolution_chapter: 50,
        act_2_touch_log: [],
        subplot_type: "mystery",
        act_2_touch_minimum: 3,
        touch_count_total: 1,
      },
      {
        subplot_id: "SP_DORMANT",
        subplot_description: "Dormant one",
        introduced_chapter: 1,
        resolution_chapter: 50,
        act_2_touch_log: [14],
        subplot_type: "tension",
        act_2_touch_minimum: 3,
        touch_count_total: 2,
      },
    ]);
    mockClaimExtraction([]);

    const result = await runContinuityEditor(baseInput({ chapterNumber: 25, act: 2 }));
    // -1.0 for dark, -0.3 for dormant = 8.7
    expect(result.score).toBe(8.7);
  });
});
