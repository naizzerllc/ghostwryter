import { describe, it, expect, vi } from "vitest";
import { countTokens, assembleBrief } from "../briefingGenerator";

// ── Mock all external dependencies ──────────────────────────────────────

vi.mock("@/constants/PROSE_DNA_RUNTIME", () => ({
  PROSE_DNA_RUNTIME: "PROSE DNA MOCK CONTENT — compact runtime representation of all 17 rules.",
}));

vi.mock("@/modules/dramaticArchitecture/clockRegistry", () => ({
  getActiveClocksForChapter: (ch: number) =>
    ch === 1
      ? [{ type: "mystery", name: "Who is the caller?", current_intensity: 6 }]
      : [],
}));

vi.mock("@/modules/characterDB/characterDB", () => ({
  getAllCharacters: () => [
    {
      id: "c1",
      name: "Cara",
      role: "protagonist",
      wound: "betrayal",
      flaw: "paranoia",
      want: "truth",
      need: "trust",
      self_deception: "believes everyone lies",
      compressed_voice_dna: "clinical, flat, precise",
      external_goal: "find the killer",
      internal_desire: "feel safe",
      goal_desire_gap: "safety requires trusting others",
      corpus_approved: true,
      voice_reliability: "HIGH",
    },
  ],
}));

vi.mock("@/modules/outline/outlineSystem", () => ({
  getChapter: (n: number) =>
    n >= 1
      ? {
          chapter_number: n,
          scene_purpose: "confront the therapist",
          hook_type: "REVELATION",
          hook_seed: "the diploma on the wall has a different name",
          opening_type: "action",
          opening_seed: "she pushes through the door",
          tension_score_target: 8,
          collision_specification: "Cara vs Dr. Marsh",
          permanent_change: "trust shattered",
          protagonist_decision_type: "active",
          act: 2,
        }
      : null,
  getAllChapters: () => [],
}));

vi.mock("@/modules/livingState/livingState", () => ({
  getLivingState: () => ({
    project_id: "proj",
    emotional_state_at_chapter_end: "shaken",
    character_sliders: [],
    clock_states: [],
    breadcrumb_states: [],
  }),
}));

vi.mock("@/modules/seriesMemory/seriesMemory", () => ({
  getSeriesContext: () => ({
    active: false,
    previous_titles: [],
  }),
}));

vi.mock("./relevanceScorer", () => ({
  scoreCharacterRelevance: () => 10,
}));

// ── countTokens ─────────────────────────────────────────────────────────

describe("countTokens", () => {
  it("estimates ~1 token per 4 characters", () => {
    expect(countTokens("abcd")).toBe(1);
    expect(countTokens("abcde")).toBe(2); // ceil(5/4)
  });

  it("returns 0 for empty string", () => {
    expect(countTokens("")).toBe(0);
  });
});

// ── assembleBrief ───────────────────────────────────────────────────────

describe("assembleBrief", () => {
  it("returns 5 tiers with correct labels", () => {
    const brief = assembleBrief(1, "proj");
    expect(brief.tiers).toHaveLength(5);
    expect(brief.tiers.map(t => t.tier)).toEqual([0, 1, 2, 3, 4]);
    expect(brief.tiers[0].label).toBe("Prose DNA");
    expect(brief.tiers[4].label).toBe("Output Headroom");
  });

  it("sets total_budget to 10,000", () => {
    const brief = assembleBrief(1, "proj");
    expect(brief.total_budget).toBe(10000);
  });

  it("populates Tier 0 with Prose DNA runtime", () => {
    const brief = assembleBrief(1, "proj");
    expect(brief.tiers[0].content).toContain("PROSE DNA MOCK");
    expect(brief.tiers[0].used).toBeGreaterThan(0);
  });

  it("populates Tier 1 with clock data when clocks active", () => {
    const brief = assembleBrief(1, "proj");
    expect(brief.tiers[1].content).toContain("Who is the caller?");
  });

  it("includes emotional state in Tier 1", () => {
    const brief = assembleBrief(1, "proj");
    expect(brief.tiers[1].content).toContain("shaken");
  });

  it("populates Tier 2 with protagonist character data", () => {
    const brief = assembleBrief(1, "proj");
    expect(brief.tiers[2].content).toContain("Cara");
    expect(brief.tiers[2].content).toContain("PROTAGONIST");
  });

  it("uses 1200T Tier 1 budget when series is inactive", () => {
    const brief = assembleBrief(1, "proj");
    expect(brief.tiers[1].budget).toBe(1200);
  });

  it("flags over_budget when total exceeds 10,000", () => {
    // With our mock content the total should be well under 10k
    const brief = assembleBrief(1, "proj");
    expect(brief.over_budget).toBe(false);
    expect(brief.total_tokens).toBeLessThan(10000);
  });

  it("records assembled_at timestamp", () => {
    const brief = assembleBrief(1, "proj");
    expect(brief.assembled_at).toBeTruthy();
    expect(() => new Date(brief.assembled_at)).not.toThrow();
  });

  it("Tier 4 output headroom has 0 used tokens", () => {
    const brief = assembleBrief(1, "proj");
    expect(brief.tiers[4].used).toBe(0);
    expect(brief.tiers[4].budget).toBe(4500);
  });
});

// ── Series budget adjustment ────────────────────────────────────────────

describe("assembleBrief — series active", () => {
  it("reduces Tier 1 budget to 1000T when series is active", async () => {
    const { getSeriesContext } = await import("@/modules/seriesMemory/seriesMemory");
    vi.mocked(getSeriesContext).mockReturnValueOnce({
      active: true,
      previous_titles: [
        {
          title_id: "t1",
          title_name: "Book One",
          sequence_number: 1,
          protagonist_arc_resolution: "She survived but at a cost.",
          antagonist_fate: "imprisoned",
          key_imagery_set: [],
          unresolved_threads: [],
          world_state_at_end: "aftermath",
          tone_shift_notes: "",
          created_at: "",
          updated_at: "",
        },
      ],
    } as any);

    const brief = assembleBrief(1, "proj");
    expect(brief.tiers[1].budget).toBe(1000);
  });
});
