/**
 * Contradiction Injection Tests — briefingGenerator
 * GHOSTLY v2.2 · S24
 *
 * Tests that contradiction matrix data is correctly injected into
 * Tier 1 (protagonist/antagonist core) and Tier 2 (supporting notes).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────

vi.mock("@/constants/PROSE_DNA_RUNTIME", () => ({
  PROSE_DNA_RUNTIME: "PROSE_DNA_MOCK",
}));

vi.mock("@/modules/dramaticArchitecture/clockRegistry", () => ({
  getActiveClocksForChapter: vi.fn(() => []),
}));

const mockGetAllCharacters = vi.fn<() => unknown[]>(() => []);
vi.mock("@/modules/characterDB/characterDB", () => ({
  getAllCharacters: () => mockGetAllCharacters(),
}));

vi.mock("@/modules/outline/outlineSystem", () => ({
  getChapter: vi.fn(() => ({
    chapter_number: 1, scene_purpose: "Test scene", hook_type: "REVELATION",
    hook_seed: "seed", opening_type: "ACTION", opening_seed: "open",
    tension_score_target: 5, collision_specification: "collision",
    permanent_change: "change", act: 1,
  })),
  getAllChapters: vi.fn(() => []),
}));

vi.mock("@/modules/livingState/livingState", () => ({
  getLivingState: vi.fn(() => ({ emotional_state_at_chapter_end: "tense" })),
}));

const mockGetSeriesContext = vi.fn(() => ({ active: false, previous_titles: [] }));
vi.mock("@/modules/seriesMemory/seriesMemory", () => ({
  getSeriesContext: (...args: unknown[]) => mockGetSeriesContext(...args),
}));

vi.mock("./relevanceScorer", () => ({
  scoreCharacterRelevance: vi.fn(() => 8),
}));

import { assembleBrief } from "../briefingGenerator";

// ── Character fixtures ──────────────────────────────────────────────────

const PROTAGONIST = {
  id: "elena", name: "Elena", role: "protagonist" as const,
  wound: "abandonment", flaw: "control", want: "find sister", need: "let go",
  self_deception: "doing it for sister", fear: "being forgotten",
  arc_start: "isolated", arc_end: "connected", arc_lesson: "control isnt love",
  compressed_voice_dna: "Clinical precision short declarative present tense sensory anchored",
  external_goal: "find sister", internal_desire: "prove self", goal_desire_gap: "search = self-worth",
  voice_corpus_status: "MISSING" as const, voice_reliability: "MISSING" as const, corpus_approved: false,
  contradiction_matrix: {
    behavioural: { stated_belief: "I protect the people I love", actual_behaviour: "Manipulates and isolates them", blind_spot: true },
    moral: { stated_principle: "Honesty is non-negotiable", collapse_condition: "When truth threatens loved ones", guilt_residue: null },
    historical: { past_action: "Left her sister alone", self_narrative: "I was always there", gap: "Chose a party instead" },
    competence: { exceptional_at: "Reading micro-expressions", humiliated_by: "Cooking a meal", origin: null },
  },
};

const ANTAGONIST = {
  id: "marcus", name: "Marcus", role: "antagonist" as const,
  wound: "betrayal", flaw: "cruelty", want: "power", need: "acceptance",
  self_deception: "I deserve this", fear: "vulnerability",
  arc_start: "dominant", arc_end: "exposed", arc_lesson: "power is hollow",
  compressed_voice_dna: "Clipped authoritative sentences with hidden vulnerability layer",
  external_goal: "control the estate", internal_desire: "be needed", goal_desire_gap: "control masks need",
  voice_corpus_status: "MISSING" as const, voice_reliability: "MISSING" as const, corpus_approved: false,
  contradiction_matrix: {
    behavioural: { stated_belief: "I am fair to everyone", actual_behaviour: "Exploits weakness systematically", blind_spot: false },
    moral: { stated_principle: "Loyalty above all", collapse_condition: "When loyalty threatens his position", guilt_residue: "Dreams about the fire" },
  },
};

const SUPPORTING = {
  id: "sarah", name: "Sarah", role: "supporting" as const,
  wound: "neglect", flaw: "passivity", want: "peace", need: "courage",
  self_deception: "everything is fine", fear: "confrontation",
  arc_start: "doormat", arc_end: "assertive", arc_lesson: "peace requires honesty",
  compressed_voice_dna: "Gentle halting speech with trailing thoughts and qualifiers",
  external_goal: "keep the family together", internal_desire: "be seen", goal_desire_gap: "family unity vs self",
  voice_corpus_status: "MISSING" as const, voice_reliability: "MISSING" as const, corpus_approved: false,
  contradiction_matrix: {
    historical: { past_action: "Witnessed the abuse and said nothing", self_narrative: "I didnt know", gap: null },
    moral: { stated_principle: "Family comes first", collapse_condition: "When family demands silence about harm", guilt_residue: null },
  },
};

// ── Tests ───────────────────────────────────────────────────────────────

describe("contradiction injection — Tier 1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("injects protagonist contradiction core into Tier 1", () => {
    mockGetAllCharacters.mockReturnValue([PROTAGONIST]);
    const brief = assembleBrief(1, "proj");
    const tier1 = brief.tiers[1].content;

    expect(tier1).toContain("PROTAGONIST CONTRADICTION CORE");
    expect(tier1).toContain("I protect the people I love");
    expect(tier1).toContain("Manipulates and isolates them");
  });

  it("includes blind spot note when blind_spot is true", () => {
    mockGetAllCharacters.mockReturnValue([PROTAGONIST]);
    const brief = assembleBrief(1, "proj");
    const tier1 = brief.tiers[1].content;

    expect(tier1).toContain("She cannot see this contradiction. The reader will.");
  });

  it("omits blind spot note when blind_spot is false", () => {
    const protNoBlindSpot = {
      ...PROTAGONIST,
      contradiction_matrix: {
        ...PROTAGONIST.contradiction_matrix,
        behavioural: { ...PROTAGONIST.contradiction_matrix.behavioural, blind_spot: false },
      },
    };
    mockGetAllCharacters.mockReturnValue([protNoBlindSpot]);
    const brief = assembleBrief(1, "proj");
    const tier1 = brief.tiers[1].content;

    expect(tier1).not.toContain("She cannot see this contradiction");
  });

  it("injects moral principle and collapse condition", () => {
    mockGetAllCharacters.mockReturnValue([PROTAGONIST]);
    const brief = assembleBrief(1, "proj");
    const tier1 = brief.tiers[1].content;

    expect(tier1).toContain("Honesty is non-negotiable");
    expect(tier1).toContain("When truth threatens loved ones");
  });

  it("injects historical action, self-narrative, and gap", () => {
    mockGetAllCharacters.mockReturnValue([PROTAGONIST]);
    const brief = assembleBrief(1, "proj");
    const tier1 = brief.tiers[1].content;

    expect(tier1).toContain("Left her sister alone");
    expect(tier1).toContain("I was always there");
    expect(tier1).toContain("Chose a party instead");
  });

  it("injects competence contradiction", () => {
    mockGetAllCharacters.mockReturnValue([PROTAGONIST]);
    const brief = assembleBrief(1, "proj");
    const tier1 = brief.tiers[1].content;

    expect(tier1).toContain("Reading micro-expressions");
    expect(tier1).toContain("Cooking a meal");
  });

  it("injects antagonist contradiction core into Tier 1", () => {
    mockGetAllCharacters.mockReturnValue([ANTAGONIST]);
    const brief = assembleBrief(1, "proj");
    const tier1 = brief.tiers[1].content;

    expect(tier1).toContain("ANTAGONIST CONTRADICTION CORE");
    expect(tier1).toContain("I am fair to everyone");
    expect(tier1).toContain("Exploits weakness systematically");
  });

  it("includes guilt_residue when present", () => {
    mockGetAllCharacters.mockReturnValue([ANTAGONIST]);
    const brief = assembleBrief(1, "proj");
    const tier1 = brief.tiers[1].content;

    expect(tier1).toContain("Dreams about the fire");
  });

  it("injects both protagonist and antagonist when both exist", () => {
    mockGetAllCharacters.mockReturnValue([PROTAGONIST, ANTAGONIST]);
    const brief = assembleBrief(1, "proj");
    const tier1 = brief.tiers[1].content;

    expect(tier1).toContain("PROTAGONIST CONTRADICTION CORE");
    expect(tier1).toContain("ANTAGONIST CONTRADICTION CORE");
  });

  it("produces no contradiction content when character has no matrix", () => {
    const noMatrix = { ...PROTAGONIST, contradiction_matrix: undefined };
    mockGetAllCharacters.mockReturnValue([noMatrix]);
    const brief = assembleBrief(1, "proj");
    const tier1 = brief.tiers[1].content;

    expect(tier1).not.toContain("CONTRADICTION CORE");
  });
});

describe("contradiction injection — Tier 2 (supporting)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("injects supporting character contradiction note into Tier 2", () => {
    mockGetAllCharacters.mockReturnValue([SUPPORTING]);
    const brief = assembleBrief(1, "proj");
    const tier2 = brief.tiers[2].content;

    expect(tier2).toContain("Sarah (contradiction note)");
    expect(tier2).toContain("Witnessed the abuse and said nothing");
  });

  it("uses moral principle for supporting when available", () => {
    mockGetAllCharacters.mockReturnValue([SUPPORTING]);
    const brief = assembleBrief(1, "proj");
    const tier2 = brief.tiers[2].content;

    expect(tier2).toContain("Family comes first");
    expect(tier2).toContain("When family demands silence about harm");
  });

  it("does not inject protagonist/antagonist contradiction notes into Tier 2", () => {
    mockGetAllCharacters.mockReturnValue([PROTAGONIST, ANTAGONIST, SUPPORTING]);
    const brief = assembleBrief(1, "proj");
    const tier2 = brief.tiers[2].content;

    // Protagonist and antagonist contradiction notes should NOT appear in Tier 2
    expect(tier2).not.toContain("Elena (contradiction note)");
    expect(tier2).not.toContain("Marcus (contradiction note)");
    // Supporting should appear in Tier 2
    expect(tier2).toContain("Sarah (contradiction note)");
  });

  it("falls back to behavioural when moral is absent for supporting", () => {
    const supportingBehavioural = {
      ...SUPPORTING,
      contradiction_matrix: {
        behavioural: { stated_belief: "I never take sides", actual_behaviour: "Always sides with the stronger", blind_spot: true },
      },
    };
    mockGetAllCharacters.mockReturnValue([supportingBehavioural]);
    const brief = assembleBrief(1, "proj");
    const tier2 = brief.tiers[2].content;

    expect(tier2).toContain("I never take sides");
    expect(tier2).toContain("Always sides with the stronger");
  });
});
