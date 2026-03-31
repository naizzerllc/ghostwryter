/**
 * Developmental Editor Tests
 * GHOSTLY v2.2 · Quality Module Coverage
 *
 * Tests assembleResult logic: flag generation, score penalties,
 * conditional checks (agency, goal/desire, arc delivery, resonance,
 * pivot, contradiction), retry/error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runDevelopmentalEditor, type DevEditorInput } from "../developmentalEditor";

import { callWithFallback } from "@/api/llmRouter";

vi.mock("@/api/llmRouter", () => ({
  callWithFallback: vi.fn(),
}));

const mockCallWithFallback = vi.mocked(callWithFallback);

function baseInput(overrides: Partial<DevEditorInput> = {}): DevEditorInput {
  return {
    chapterNumber: 5,
    chapterContent: "Some prose content.",
    scenePurpose: "reveal the therapist's hidden motive",
    act: 1,
    isConsequenceChapter: false,
    consecutiveReactiveCount: 0,
    consecutiveNeutralCount: 0,
    ...overrides,
  };
}

function baseLLMResponse(overrides: Record<string, unknown> = {}) {
  return {
    scene_purpose_check: { scene_purpose_delivered: true, explanation: "Delivered." },
    false_progression_check: { irreversible_change_delivered: true, change_type: "RELATIONSHIP_SHIFT", change_description: "Trust broken." },
    scene_collision_check: { collision_present: true, collision_type: "CHARACTER_GOAL_COLLISION", collision_description: "Goals clash." },
    opening_check: { opening_type_delivered: "MID_ACTION", first_sentence: "She grabs the folder.", explanation: "Action." },
    ...overrides,
  };
}

function mockLLMReturn(data: Record<string, unknown>) {
  mockCallWithFallback.mockResolvedValue({ content: JSON.stringify(data) } as any);
}

describe("developmentalEditor", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Happy path ──

  it("returns a valid result with score 10 for perfect chapter", async () => {
    mockLLMReturn(baseLLMResponse());
    const result = await runDevelopmentalEditor(baseInput());

    expect(result.chapter_number).toBe(5);
    expect(result.scene_purpose_check.scene_purpose_delivered).toBe(true);
    expect(result.false_progression_check.irreversible_change_delivered).toBe(true);
    expect(result.flags).toHaveLength(0);
    expect(result.score).toBe(10);
    expect(result.veto_scene_purpose).toBe(false);
  });

  // ── Scene Purpose CRITICAL ──

  it("flags SCENE_PURPOSE_FAILED and vetoes on failure", async () => {
    mockLLMReturn(baseLLMResponse({
      scene_purpose_check: { scene_purpose_delivered: false, explanation: "Missed." },
    }));
    const result = await runDevelopmentalEditor(baseInput());

    expect(result.veto_scene_purpose).toBe(true);
    expect(result.flags.some(f => f.code === "SCENE_PURPOSE_FAILED" && f.severity === "CRITICAL")).toBe(true);
    expect(result.score).toBeLessThan(10);
  });

  // ── False Progression CRITICAL ──

  it("flags FALSE_PROGRESSION when no irreversible change", async () => {
    mockLLMReturn(baseLLMResponse({
      false_progression_check: { irreversible_change_delivered: false, change_type: null, change_description: "" },
    }));
    const result = await runDevelopmentalEditor(baseInput());

    expect(result.flags.some(f => f.code === "FALSE_PROGRESSION" && f.severity === "CRITICAL")).toBe(true);
    expect(result.score).toBeLessThanOrEqual(6.5);
  });

  // ── Collision flags ──

  it("flags NO_COLLISION as WARNING", async () => {
    mockLLMReturn(baseLLMResponse({
      scene_collision_check: { collision_present: false, collision_type: "NO_COLLISION", collision_description: "" },
    }));
    const result = await runDevelopmentalEditor(baseInput());
    expect(result.flags.some(f => f.code === "NO_COLLISION")).toBe(true);
  });

  it("flags COLLISION_WEAK as NOTE", async () => {
    mockLLMReturn(baseLLMResponse({
      scene_collision_check: { collision_present: true, collision_type: "COLLISION_WEAK", collision_description: "Soft." },
    }));
    const result = await runDevelopmentalEditor(baseInput());
    expect(result.flags.some(f => f.code === "COLLISION_WEAK" && f.severity === "NOTE")).toBe(true);
  });

  // ── Opening BANNED ──

  it("flags OPENING_BANNED as CRITICAL for R12 violation", async () => {
    mockLLMReturn(baseLLMResponse({
      opening_check: { opening_type_delivered: "BANNED", first_sentence: "The sun rose.", explanation: "Weather opening." },
    }));
    const result = await runDevelopmentalEditor(baseInput());
    expect(result.flags.some(f => f.code === "OPENING_BANNED" && f.severity === "CRITICAL")).toBe(true);
  });

  // ── Protagonist Agency (Act 2 only) ──

  it("activates protagonist agency check in Act 2", async () => {
    mockLLMReturn(baseLLMResponse({
      protagonist_agency_check: { decision_type_delivered: "PROACTIVE", explanation: "She chose." },
    }));
    const result = await runDevelopmentalEditor(baseInput({ act: 2 }));
    expect(result.protagonist_agency_check).not.toBeNull();
    expect(result.protagonist_agency_check!.decision_type_delivered).toBe("PROACTIVE");
    expect(result.protagonist_agency_check!.consecutive_reactive_count).toBe(0);
  });

  it("does not activate agency check in Act 1", async () => {
    mockLLMReturn(baseLLMResponse());
    const result = await runDevelopmentalEditor(baseInput({ act: 1 }));
    expect(result.protagonist_agency_check).toBeNull();
  });

  it("flags PASSIVITY_PATTERN at 3+ consecutive reactive", async () => {
    mockLLMReturn(baseLLMResponse({
      protagonist_agency_check: { decision_type_delivered: "REACTIVE", explanation: "Passive." },
    }));
    const result = await runDevelopmentalEditor(baseInput({ act: 2, consecutiveReactiveCount: 2 }));
    expect(result.protagonist_agency_check!.consecutive_reactive_count).toBe(3);
    expect(result.flags.some(f => f.code === "PASSIVITY_PATTERN")).toBe(true);
  });

  // ── Goal/Desire Arc (Chapter 10+) ──

  it("activates goal/desire arc check at chapter 10+", async () => {
    mockLLMReturn(baseLLMResponse({
      goal_desire_arc_check: { gap_movement: "CLOSING", explanation: "Gap shrinks." },
    }));
    const result = await runDevelopmentalEditor(baseInput({ chapterNumber: 12 }));
    expect(result.goal_desire_arc_check).not.toBeNull();
    expect(result.goal_desire_arc_check!.gap_movement).toBe("CLOSING");
  });

  it("does not activate goal/desire arc before chapter 10", async () => {
    mockLLMReturn(baseLLMResponse());
    const result = await runDevelopmentalEditor(baseInput({ chapterNumber: 5 }));
    expect(result.goal_desire_arc_check).toBeNull();
  });

  it("flags GOAL_DESIRE_NEUTRAL at 3+ consecutive neutral", async () => {
    mockLLMReturn(baseLLMResponse({
      goal_desire_arc_check: { gap_movement: "NEUTRAL", explanation: "Stalled." },
    }));
    const result = await runDevelopmentalEditor(baseInput({ chapterNumber: 15, consecutiveNeutralCount: 2 }));
    expect(result.goal_desire_arc_check!.consecutive_neutral_count).toBe(3);
    expect(result.flags.some(f => f.code === "GOAL_DESIRE_NEUTRAL")).toBe(true);
  });

  // ── Arc Delivery (consequence chapter) ──

  it("flags ARC_DELIVERY_UNEARNED as CRITICAL", async () => {
    mockLLMReturn(baseLLMResponse({
      arc_delivery_check: { arc_transformation_visible: true, outcome_earned: false, explanation: "Unearned." },
    }));
    const result = await runDevelopmentalEditor(baseInput({ isConsequenceChapter: true }));
    expect(result.arc_delivery_check).not.toBeNull();
    expect(result.flags.some(f => f.code === "ARC_DELIVERY_UNEARNED" && f.severity === "CRITICAL")).toBe(true);
  });

  it("flags ARC_DELIVERY_STATED_NOT_SHOWN as WARNING when transformation not visible but earned", async () => {
    mockLLMReturn(baseLLMResponse({
      arc_delivery_check: { arc_transformation_visible: false, outcome_earned: true, explanation: "Stated." },
    }));
    const result = await runDevelopmentalEditor(baseInput({ isConsequenceChapter: true }));
    expect(result.flags.some(f => f.code === "ARC_DELIVERY_STATED_NOT_SHOWN")).toBe(true);
  });

  // ── Emotional Resonance ──

  it("flags RESONANCE_ABSENT in Act 1 when not delivered", async () => {
    mockLLMReturn(baseLLMResponse({
      emotional_resonance_assessment: { resonance_delivered: false, resonance_confidence: "LOW", resonance_note: "None." },
    }));
    const result = await runDevelopmentalEditor(baseInput({ act: 1, emotionalResonanceTarget: "abandonment" }));
    expect(result.emotional_resonance_assessment.active).toBe(true);
    expect(result.flags.some(f => f.code === "RESONANCE_ABSENT" && f.severity === "CRITICAL")).toBe(true);
  });

  it("flags RESONANCE_WEAK in Act 2 when not delivered", async () => {
    mockLLMReturn(baseLLMResponse({
      emotional_resonance_assessment: { resonance_delivered: false, resonance_confidence: "MEDIUM", resonance_note: "Partial." },
    }));
    const result = await runDevelopmentalEditor(baseInput({ act: 2, emotionalResonanceTarget: "betrayal" }));
    expect(result.flags.some(f => f.code === "RESONANCE_WEAK" && f.severity === "WARNING")).toBe(true);
  });

  it("sets resonance inactive when no target", async () => {
    mockLLMReturn(baseLLMResponse());
    const result = await runDevelopmentalEditor(baseInput());
    expect(result.emotional_resonance_assessment.active).toBe(false);
  });

  // ── Relationship Pivot ──

  it("flags PIVOT_ABSENT when both subtext and change fail", async () => {
    mockLLMReturn(baseLLMResponse({
      relationship_pivot_assessment: { subtext_traceable: false, change_permanent: false, pivot_note: "Missing." },
    }));
    const result = await runDevelopmentalEditor(baseInput({
      relationshipPivot: { isPivot: true, pivotPair: "PAIR_1", subtextExchange: "power shift", whatChanges: "trust" },
    }));
    expect(result.flags.some(f => f.code === "PIVOT_ABSENT" && f.severity === "CRITICAL")).toBe(true);
  });

  it("flags PIVOT_WEAK when only one of subtext/change delivered", async () => {
    mockLLMReturn(baseLLMResponse({
      relationship_pivot_assessment: { subtext_traceable: true, change_permanent: false, pivot_note: "Half." },
    }));
    const result = await runDevelopmentalEditor(baseInput({
      relationshipPivot: { isPivot: true, pivotPair: "PAIR_2", subtextExchange: "power shift", whatChanges: "trust" },
    }));
    expect(result.flags.some(f => f.code === "PIVOT_WEAK")).toBe(true);
  });

  // ── Contradiction Surface Check ──

  it("flags HISTORICAL_GAP_COLLAPSED as CRITICAL pre-Act 3", async () => {
    mockLLMReturn(baseLLMResponse({
      contradiction_surface_check: {
        behavioural_visible: true, behavioural_assessment: "Visible.",
        moral_tested: false, moral_assessment: null,
        historical_gap_maintained: false, historical_assessment: "Gap collapsed.",
        competence_surfaced_recently: false, competence_note: null,
      },
    }));
    const result = await runDevelopmentalEditor(baseInput({
      act: 2,
      contradictionInput: {
        hasMatrix: true,
        behavioural: { stated_belief: "I protect", actual_behaviour: "I isolate", blind_spot: true },
        historical: { past_action: "Left her", self_narrative: "Was always there", gap: "Went to party" },
      },
    }));
    expect(result.flags.some(f => f.code === "HISTORICAL_GAP_COLLAPSED" && f.severity === "CRITICAL")).toBe(true);
  });

  it("flags CONTRADICTION_ABSENT when behavioural not visible", async () => {
    mockLLMReturn(baseLLMResponse({
      contradiction_surface_check: {
        behavioural_visible: false, behavioural_assessment: "Not visible.",
        moral_tested: false, moral_assessment: null,
        historical_gap_maintained: true, historical_assessment: null,
        competence_surfaced_recently: false, competence_note: null,
      },
    }));
    const result = await runDevelopmentalEditor(baseInput({
      contradictionInput: {
        hasMatrix: true,
        behavioural: { stated_belief: "I protect", actual_behaviour: "I isolate", blind_spot: true },
      },
    }));
    expect(result.flags.some(f => f.code === "CONTRADICTION_ABSENT")).toBe(true);
  });

  // ── Score clamping ──

  it("clamps score to 0 minimum on catastrophic failure", async () => {
    mockLLMReturn(baseLLMResponse({
      scene_purpose_check: { scene_purpose_delivered: false, explanation: "" },
      false_progression_check: { irreversible_change_delivered: false, change_type: null, change_description: "" },
      scene_collision_check: { collision_present: false, collision_type: "NO_COLLISION", collision_description: "" },
      opening_check: { opening_type_delivered: "BANNED", first_sentence: "", explanation: "" },
    }));
    const result = await runDevelopmentalEditor(baseInput());
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  // ── Retry and error handling ──

  it("retries on invalid JSON and succeeds on second attempt", async () => {
    mockCallWithFallback
      .mockResolvedValueOnce({ content: "not json" } as any)
      .mockResolvedValueOnce({ content: JSON.stringify(baseLLMResponse()) } as any);

    const result = await runDevelopmentalEditor(baseInput());
    expect(result.score).toBe(10);
    expect(mockCallWithFallback).toHaveBeenCalledTimes(2);
  });

  it("throws after all retries exhausted", async () => {
    const { callWithFallback } = require("@/api/llmRouter");
    (callWithFallback as any).mockResolvedValue({ content: "garbage" });

    await expect(runDevelopmentalEditor(baseInput())).rejects.toThrow(/All 3 attempts failed/);
  });
});
