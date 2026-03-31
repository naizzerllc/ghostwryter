import { describe, it, expect, vi } from "vitest";
import { validateBrief } from "../briefValidationGate";
import type { GenerationBrief } from "../briefingGenerator";
import type { ChapterOutlineRecord } from "@/modules/outline/outlineSystem";

// ── Mock dependencies ───────────────────────────────────────────────────

vi.mock("@/modules/outline/outlineSystem", () => ({
  getRevelationChapter: () => 20,
  getGenreMode: () => "psychological_thriller",
  getChapter: () => null,
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
    scene_purpose: "expose the hidden truth about the therapist",
    hook_type: "REVELATION",
    hook_seed: "the letter on the desk reveals the real identity",
    opening_type: "action",
    opening_seed: "she runs",
    tension_score_target: 7,
    collision_specification: "confrontation",
    permanent_change: "trust broken",
    protagonist_decision_type: "active",
    act: 2,
  } as ChapterOutlineRecord;
}

// ── Force Classification ────────────────────────────────────────────────

describe("briefValidationGate — force classification", () => {
  it("classifies FORCE_HIGH for high-force verbs", () => {
    const result = validateBrief(makeBrief(), makeOutline({ scene_purpose: "expose the lie" }));
    expect(result.force_classification).toBe("FORCE_HIGH");
  });

  it("classifies FORCE_MID for mid-force verbs", () => {
    const result = validateBrief(makeBrief(), makeOutline({ scene_purpose: "escalate the tension between them" }));
    expect(result.force_classification).toBe("FORCE_MID");
  });

  it("classifies FORCE_LOW and errors for low-force verbs", () => {
    const result = validateBrief(makeBrief(), makeOutline({ scene_purpose: "explore her feelings about the house" }));
    expect(result.force_classification).toBe("FORCE_LOW");
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("higher-force verb"))).toBe(true);
  });

  it("defaults to FORCE_MID for unrecognized verbs", () => {
    const result = validateBrief(makeBrief(), makeOutline({ scene_purpose: "zigzag across the room" }));
    expect(result.force_classification).toBe("FORCE_MID");
  });
});

// ── Hook Seed Specificity ───────────────────────────────────────────────

describe("briefValidationGate — hook seed", () => {
  it("warns when hook_seed is missing", () => {
    const result = validateBrief(makeBrief(), makeOutline({ hook_seed: "" }));
    expect(result.warnings.some(w => w.includes("missing"))).toBe(true);
  });

  it("warns when hook_seed is fewer than 5 words", () => {
    const result = validateBrief(makeBrief(), makeOutline({ hook_seed: "a twist" }));
    expect(result.warnings.some(w => w.includes("generic"))).toBe(true);
  });

  it("warns on generic phrasing", () => {
    const result = validateBrief(makeBrief(), makeOutline({ hook_seed: "something happens in the room and changes" }));
    expect(result.warnings.some(w => w.includes("generic phrasing"))).toBe(true);
  });

  it("passes with specific hook_seed", () => {
    const result = validateBrief(makeBrief(), makeOutline({ hook_seed: "the letter on the desk reveals a hidden name" }));
    expect(result.warnings.filter(w => w.includes("hook_seed"))).toHaveLength(0);
  });
});

// ── Narrator Deception Gesture ──────────────────────────────────────────

describe("briefValidationGate — narrator deception gesture", () => {
  it("warns when NDG missing in psych thriller pre-revelation chapter", () => {
    const outline = makeOutline({ chapter_number: 10, narrator_deception_gesture: undefined });
    const result = validateBrief(makeBrief(), outline);
    expect(result.warnings.some(w => w.includes("narrator_deception_gesture"))).toBe(true);
  });

  it("does not warn for post-revelation chapters", () => {
    const outline = makeOutline({ chapter_number: 25, narrator_deception_gesture: undefined });
    const result = validateBrief(makeBrief(), outline);
    expect(result.warnings.filter(w => w.includes("narrator_deception_gesture"))).toHaveLength(0);
  });

  it("does not warn when NDG is present", () => {
    const outline = makeOutline({ chapter_number: 10, narrator_deception_gesture: "avoids looking at the photo" });
    const result = validateBrief(makeBrief(), outline);
    expect(result.warnings.filter(w => w.includes("narrator_deception_gesture"))).toHaveLength(0);
  });
});

// ── Token Budget ────────────────────────────────────────────────────────

describe("briefValidationGate — token budget", () => {
  it("errors when total_tokens exceeds 10,000", () => {
    const result = validateBrief(makeBrief({ total_tokens: 11000 }), makeOutline());
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("10,000T"))).toBe(true);
  });

  it("warns when total_tokens exceeds 8,000", () => {
    const result = validateBrief(makeBrief({ total_tokens: 9000 }), makeOutline());
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes("8,000T"))).toBe(true);
  });

  it("passes cleanly under 8,000", () => {
    const result = validateBrief(makeBrief({ total_tokens: 6000 }), makeOutline());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
