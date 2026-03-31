import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GenerationBrief } from "../briefingGenerator";
import type { ChapterOutlineRecord } from "@/modules/outline/outlineSystem";

// ── Mock dependencies ───────────────────────────────────────────────────

const mockGetRevelationChapter = vi.fn(() => 20);
const mockGetGenreMode = vi.fn(() => "psychological_thriller");
const mockGetChapter = vi.fn(() => null);

vi.mock("@/modules/outline/outlineSystem", () => ({
  getRevelationChapter: () => mockGetRevelationChapter(),
  getGenreMode: () => mockGetGenreMode(),
  getChapter: (_n: number) => mockGetChapter(),
}));

vi.mock("@/modules/livingState/livingState", () => ({
  getLivingState: () => ({
    emotional_state_at_chapter_end: "tense",
    character_sliders: [],
    clock_states: [],
    breadcrumb_states: [],
  }),
}));

// ── Fixtures ────────────────────────────────────────────────────────────

function makeBrief(overrides: Partial<GenerationBrief> = {}): GenerationBrief {
  return {
    chapter_number: 5,
    project_id: "proj",
    tiers: [],
    total_tokens: 6000,
    total_budget: 10000,
    over_budget: false,
    budget_warnings: [],
    truncation_log: [],
    proximity_gap: null,
    warnings: [],
    assembled_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeOutline(overrides: Partial<ChapterOutlineRecord> = {}): ChapterOutlineRecord {
  return {
    chapter_number: 5,
    timeline_id: "main",
    scene_purpose: "confront the suspect in the hallway",
    hook_type: "REVELATION",
    hook_seed: "the letter on the desk reveals a hidden name clearly",
    opening_type: "action",
    opening_seed: "she runs",
    tension_score_target: 7,
    collision_specification: "confrontation",
    permanent_change: "trust broken",
    protagonist_decision_type: "active",
    narrator_deception_gesture: "glances away from the mirror",
    act: 2,
    ...overrides,
  } as ChapterOutlineRecord;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRevelationChapter.mockReturnValue(20);
  mockGetGenreMode.mockReturnValue("psychological_thriller");
  mockGetChapter.mockReturnValue(null);
});

// ── Force Classification ────────────────────────────────────────────────

describe("briefValidationGate — force classification", () => {
  it("classifies FORCE_HIGH for high-force verbs", async () => {
    const { validateBrief } = await import("../briefValidationGate");
    const result = validateBrief(makeBrief(), makeOutline({ scene_purpose: "expose the lie behind it all" }));
    expect(result.force_classification).toBe("FORCE_HIGH");
  });

  it("classifies FORCE_MID for mid-force verbs", async () => {
    const { validateBrief } = await import("../briefValidationGate");
    const result = validateBrief(makeBrief(), makeOutline({ scene_purpose: "discover the hidden room in the basement" }));
    expect(result.force_classification).toBe("FORCE_MID");
  });

  it("classifies FORCE_LOW and errors for low-force verbs", async () => {
    const { validateBrief } = await import("../briefValidationGate");
    const result = validateBrief(makeBrief(), makeOutline({ scene_purpose: "illustrate the morning routine at the clinic" }));
    expect(result.force_classification).toBe("FORCE_LOW");
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("higher-force verb"))).toBe(true);
  });

  it("defaults to FORCE_MID for unrecognized verbs", async () => {
    const { validateBrief } = await import("../briefValidationGate");
    const result = validateBrief(makeBrief(), makeOutline({ scene_purpose: "zigzag across the ballroom floor nervously" }));
    expect(result.force_classification).toBe("FORCE_MID");
  });
});

// ── Hook Seed Specificity ───────────────────────────────────────────────

describe("briefValidationGate — hook seed", () => {
  it("warns when hook_seed is missing", async () => {
    const { validateBrief } = await import("../briefValidationGate");
    const result = validateBrief(makeBrief(), makeOutline({ hook_seed: "" }));
    expect(result.warnings.some(w => w.includes("missing"))).toBe(true);
  });

  it("warns when hook_seed is fewer than 5 words", async () => {
    const { validateBrief } = await import("../briefValidationGate");
    const result = validateBrief(makeBrief(), makeOutline({ hook_seed: "a twist occurs" }));
    expect(result.warnings.some(w => w.includes("generic"))).toBe(true);
  });

  it("warns on generic phrasing", async () => {
    const { validateBrief } = await import("../briefValidationGate");
    const result = validateBrief(makeBrief(), makeOutline({ hook_seed: "something happens inside the room and changes everything" }));
    expect(result.warnings.some(w => w.includes("generic phrasing"))).toBe(true);
  });

  it("passes with specific hook_seed", async () => {
    const { validateBrief } = await import("../briefValidationGate");
    const result = validateBrief(makeBrief(), makeOutline());
    expect(result.warnings.filter(w => w.includes("hook_seed"))).toHaveLength(0);
  });
});

// ── Narrator Deception Gesture ──────────────────────────────────────────

describe("briefValidationGate — narrator deception gesture", () => {
  it("warns when NDG missing in psych thriller pre-revelation chapter", async () => {
    const { validateBrief } = await import("../briefValidationGate");
    const outline = makeOutline({
      chapter_number: 10,
      narrator_deception_gesture: undefined,
    });
    // Delete to ensure property is absent, not just undefined
    delete (outline as Record<string, unknown>).narrator_deception_gesture;
    const result = validateBrief(makeBrief(), outline);
    expect(result.warnings.some(w => w.includes("narrator_deception_gesture"))).toBe(true);
  });

  it("does not warn for post-revelation chapters", async () => {
    const { validateBrief } = await import("../briefValidationGate");
    const outline = makeOutline({ chapter_number: 25 });
    delete (outline as Record<string, unknown>).narrator_deception_gesture;
    const result = validateBrief(makeBrief(), outline);
    expect(result.warnings.filter(w => w.includes("narrator_deception_gesture"))).toHaveLength(0);
  });

  it("does not warn when NDG is present", async () => {
    const { validateBrief } = await import("../briefValidationGate");
    const outline = makeOutline({
      chapter_number: 10,
      narrator_deception_gesture: "avoids looking at the photo",
    });
    const result = validateBrief(makeBrief(), outline);
    expect(result.warnings.filter(w => w.includes("narrator_deception_gesture"))).toHaveLength(0);
  });
});

// ── Token Budget ────────────────────────────────────────────────────────

describe("briefValidationGate — token budget", () => {
  it("errors when total_tokens exceeds 10,000", async () => {
    const { validateBrief } = await import("../briefValidationGate");
    const result = validateBrief(makeBrief({ total_tokens: 11000 }), makeOutline());
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("10,000T"))).toBe(true);
  });

  it("warns when total_tokens exceeds 8,000", async () => {
    const { validateBrief } = await import("../briefValidationGate");
    const result = validateBrief(makeBrief({ total_tokens: 9000 }), makeOutline());
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes("8,000T"))).toBe(true);
  });

  it("passes cleanly under 8,000", async () => {
    const { validateBrief } = await import("../briefValidationGate");
    const result = validateBrief(makeBrief({ total_tokens: 6000 }), makeOutline());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
