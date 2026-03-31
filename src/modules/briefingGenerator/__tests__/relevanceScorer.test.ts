import { describe, it, expect } from "vitest";
import { scoreCharacterRelevance, buildSceneBrief } from "../relevanceScorer";
import type { CharacterRecord } from "@/modules/characterDB/types";
import type { ChapterOutlineRecord } from "@/modules/outline/outlineSystem";
import type { LivingState } from "@/modules/livingState/livingState";

// ── Fixtures ────────────────────────────────────────────────────────────

function makeChar(overrides: Partial<CharacterRecord> = {}): CharacterRecord {
  return {
    id: "char-1",
    name: "Elena",
    role: "supporting",
    wound: "abandonment",
    flaw: "distrust",
    want: "safety",
    need: "connection",
    self_deception: "",
    compressed_voice_dna: "clinical detached tone",
    external_goal: "survive",
    internal_desire: "belong",
    goal_desire_gap: "gap",
    corpus_approved: true,
    voice_reliability: "HIGH",
    ...overrides,
  } as CharacterRecord;
}

function makeOutline(overrides: Partial<ChapterOutlineRecord> = {}): ChapterOutlineRecord {
  return {
    chapter_number: 5,
    timeline_id: "main",
    scene_purpose: "expose the lie",
    hook_type: "REVELATION",
    hook_seed: "the letter on the desk reveals everything",
    opening_type: "action",
    opening_seed: "she runs",
    tension_score_target: 7,
    collision_specification: "Elena confronts the doctor",
    permanent_change: "trust broken",
    protagonist_decision_type: "active",
    act: 2,
    ...overrides,
  } as ChapterOutlineRecord;
}

function makeLivingState(overrides: Partial<LivingState> = {}): LivingState {
  return {
    project_id: "proj",
    emotional_state_at_chapter_end: "tense",
    character_sliders: [],
    clock_states: [],
    breadcrumb_states: [],
    updated_at: new Date().toISOString(),
    ...overrides,
  } as LivingState;
}

// ── scoreCharacterRelevance ─────────────────────────────────────────────

describe("scoreCharacterRelevance", () => {
  it("returns 10 for protagonist regardless of context", () => {
    const char = makeChar({ role: "protagonist" });
    expect(scoreCharacterRelevance(char, makeOutline(), makeLivingState())).toBe(10);
  });

  it("scores 8+ when character named in scene_purpose", () => {
    const char = makeChar({ name: "Elena" });
    const outline = makeOutline({ scene_purpose: "Elena discovers the truth" });
    expect(scoreCharacterRelevance(char, outline, makeLivingState())).toBeGreaterThanOrEqual(8);
  });

  it("scores 9 when named in both scene_purpose and collision_specification", () => {
    const char = makeChar({ name: "Elena" });
    const outline = makeOutline({
      scene_purpose: "Elena discovers the truth",
      collision_specification: "Elena confronts Mark",
    });
    expect(scoreCharacterRelevance(char, outline, makeLivingState())).toBe(9);
  });

  it("scores 7+ when named in hook_seed", () => {
    const char = makeChar({ name: "Mark" });
    const outline = makeOutline({ hook_seed: "Mark appears at the door with blood on his hands" });
    expect(scoreCharacterRelevance(char, outline, makeLivingState())).toBeGreaterThanOrEqual(7);
  });

  it("gives antagonist a base boost of 5", () => {
    const char = makeChar({ role: "antagonist", name: "Stranger" });
    const outline = makeOutline({ scene_purpose: "unrelated scene" });
    expect(scoreCharacterRelevance(char, outline, makeLivingState())).toBeGreaterThanOrEqual(5);
  });

  it("scores 5-6 for recently mentioned character (within 3 chapters)", () => {
    const char = makeChar({ id: "c1", name: "Nurse" });
    const livingState = makeLivingState({
      character_sliders: [
        { character_id: "c1", psychological_position: "neutral", trust_level: 5, emotional_register: "flat", last_updated_chapter: 4 },
      ],
    });
    const outline = makeOutline({ chapter_number: 5, scene_purpose: "unrelated" });
    const score = scoreCharacterRelevance(char, outline, livingState);
    expect(score).toBeGreaterThanOrEqual(5);
    expect(score).toBeLessThanOrEqual(6);
  });

  it("caps at 3 for character absent 10+ chapters", () => {
    const char = makeChar({ id: "c2", name: "Ghost" });
    const livingState = makeLivingState({
      character_sliders: [
        { character_id: "c2", psychological_position: "neutral", trust_level: 5, emotional_register: "flat", last_updated_chapter: 1 },
      ],
    });
    const outline = makeOutline({ chapter_number: 15, scene_purpose: "unrelated" });
    expect(scoreCharacterRelevance(char, outline, livingState)).toBeLessThanOrEqual(3);
  });
});

// ── buildSceneBrief ─────────────────────────────────────────────────────

describe("buildSceneBrief", () => {
  it("assembles generation_brief with chapter metadata", () => {
    const outline = makeOutline({ chapter_number: 3, act: 1 });
    const result = buildSceneBrief(outline, [], [], makeLivingState());
    expect(result.generation_brief).toContain("CHAPTER 3");
    expect(result.generation_brief).toContain("ACT 1");
    expect(result.generation_brief).toContain("expose the lie");
  });

  it("includes hook continuity bridge when previous hook provided", () => {
    const outline = makeOutline();
    const result = buildSceneBrief(outline, [], [], makeLivingState(), {
      hook_type: "THREAT",
      hook_seed: "footsteps in the hallway",
    });
    expect(result.hook_continuity_bridge).toContain("THREAT");
    expect(result.hook_continuity_bridge).toContain("footsteps");
  });

  it("populates subtext_targets from character self_deception", () => {
    const char = makeChar({ self_deception: "believes she is in control" });
    const result = buildSceneBrief(makeOutline(), [], [{ character: char, score: 8 }], makeLivingState());
    expect(result.subtext_targets).toHaveLength(1);
    expect(result.subtext_targets[0]).toContain("believes she is in control");
  });

  it("includes NDG in brief when present on outline", () => {
    const outline = makeOutline({ narrator_deception_gesture: "avoids looking at the photo" });
    const result = buildSceneBrief(outline, [], [], makeLivingState());
    expect(result.generation_brief).toContain("NDG:");
    expect(result.generation_brief).toContain("avoids looking at the photo");
  });
});
