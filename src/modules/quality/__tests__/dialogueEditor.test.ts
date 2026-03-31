/**
 * Dialogue Editor Tests
 * GHOSTLY v2.2 · Quality Module Coverage
 *
 * Tests assembleResult logic: subtext delivery, voice consistency,
 * information load, dialogue drives, score weighting, retry/error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runDialogueEditor, type DialogueEditorInput } from "../dialogueEditor";

import { callWithFallback } from "@/api/llmRouter";

vi.mock("@/api/llmRouter", () => ({
  callWithFallback: vi.fn(),
}));

const mockCallWithFallback = vi.mocked(callWithFallback);

function baseInput(overrides: Partial<DialogueEditorInput> = {}): DialogueEditorInput {
  return {
    chapterNumber: 4,
    chapterContent: "Dialogue prose.",
    subtextTargets: [
      { target_id: "st_1", description: "Power dynamic shift", character_id: "dr_chen" },
    ],
    characterVoiceDNA: { dr_chen: "clinical, controlled, measured" },
    ...overrides,
  };
}

function baseLLMResponse(overrides: Record<string, unknown> = {}) {
  return {
    subtext_delivery_check: {
      results: [{ target_id: "st_1", description: "Power dynamic shift", subtext_delivered: true, subtext_surfaced: false, explanation: "Delivered beneath surface." }],
      undelivered_count: 0,
      surfaced_count: 0,
    },
    character_voice_consistency: { inconsistencies: [], overall_consistent: true },
    information_load_check: { dump_instances: [], total_dumps: 0 },
    dialogue_drives_check: { weak_lines: [], total_dialogue_lines: 20, multi_function_percentage: 85 },
    ...overrides,
  };
}

function mockLLMReturn(data: Record<string, unknown>) {
  mockCallWithFallback.mockResolvedValue({ content: JSON.stringify(data) } as any);
}

describe("dialogueEditor", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Happy path ──

  it("returns valid result with high score for clean dialogue", async () => {
    mockLLMReturn(baseLLMResponse());
    const result = await runDialogueEditor(baseInput());

    expect(result.chapter_number).toBe(4);
    expect(result.flags).toHaveLength(0);
    expect(result.score).toBe(10);
  });

  // ── Subtext delivery flags ──

  it("flags SUBTEXT_MISSING when target not delivered", async () => {
    mockLLMReturn(baseLLMResponse({
      subtext_delivery_check: {
        results: [{ target_id: "st_1", description: "Power shift", subtext_delivered: false, subtext_surfaced: false, explanation: "Absent." }],
        undelivered_count: 1,
        surfaced_count: 0,
      },
    }));
    const result = await runDialogueEditor(baseInput());
    expect(result.flags.some(f => f.code === "SUBTEXT_MISSING")).toBe(true);
  });

  it("flags SUBTEXT_SURFACED when subtext stated explicitly", async () => {
    mockLLMReturn(baseLLMResponse({
      subtext_delivery_check: {
        results: [{ target_id: "st_1", description: "Power shift", subtext_delivered: true, subtext_surfaced: true, explanation: "Named explicitly." }],
        undelivered_count: 0,
        surfaced_count: 1,
      },
    }));
    const result = await runDialogueEditor(baseInput());
    expect(result.flags.some(f => f.code === "SUBTEXT_SURFACED")).toBe(true);
  });

  // ── Voice consistency flags ──

  it("flags VOICE_INCONSISTENCY for each register break", async () => {
    mockLLMReturn(baseLLMResponse({
      character_voice_consistency: {
        inconsistencies: [
          { character_id: "dr_chen", line_reference: "p3", expected_register: "clinical", actual_register: "warm", explanation: "Broke register." },
        ],
        overall_consistent: false,
      },
    }));
    const result = await runDialogueEditor(baseInput());
    expect(result.flags.some(f => f.code === "VOICE_INCONSISTENCY")).toBe(true);
    expect(result.character_voice_consistency.overall_consistent).toBe(false);
  });

  // ── Information load flags ──

  it("flags INFORMATION_DUMP for dialogue info dumps", async () => {
    mockLLMReturn(baseLLMResponse({
      information_load_check: {
        dump_instances: [{ location: "p5-p6", fact_count: 5, excerpt: "She explained that..." }],
        total_dumps: 1,
      },
    }));
    const result = await runDialogueEditor(baseInput());
    expect(result.flags.some(f => f.code === "INFORMATION_DUMP" && f.severity === "NOTE")).toBe(true);
  });

  // ── Dialogue drives flags ──

  it("flags DIALOGUE_WEAK_LINES when >3 single-function lines", async () => {
    const weakLines = Array.from({ length: 5 }, (_, i) => ({
      line_reference: `line_${i}`,
      functions_served: 1,
      functions_list: ["reveal character"],
      needs_tightening: true,
    }));
    mockLLMReturn(baseLLMResponse({
      dialogue_drives_check: { weak_lines: weakLines, total_dialogue_lines: 20, multi_function_percentage: 60 },
    }));
    const result = await runDialogueEditor(baseInput());
    expect(result.flags.some(f => f.code === "DIALOGUE_WEAK_LINES")).toBe(true);
  });

  it("does not flag DIALOGUE_WEAK_LINES when <=3 weak lines", async () => {
    const weakLines = [
      { line_reference: "l1", functions_served: 1, functions_list: ["info"], needs_tightening: true },
    ];
    mockLLMReturn(baseLLMResponse({
      dialogue_drives_check: { weak_lines: weakLines, total_dialogue_lines: 20, multi_function_percentage: 90 },
    }));
    const result = await runDialogueEditor(baseInput());
    expect(result.flags.some(f => f.code === "DIALOGUE_WEAK_LINES")).toBe(false);
  });

  // ── Score computation ──

  it("reduces score for voice inconsistencies", async () => {
    mockLLMReturn(baseLLMResponse({
      character_voice_consistency: {
        inconsistencies: [
          { character_id: "dr_chen", line_reference: "p1", expected_register: "clinical", actual_register: "casual", explanation: "Off." },
          { character_id: "dr_chen", line_reference: "p4", expected_register: "clinical", actual_register: "warm", explanation: "Off again." },
        ],
        overall_consistent: false,
      },
    }));
    const result = await runDialogueEditor(baseInput());
    expect(result.score).toBeLessThan(10);
  });

  it("computes score 10 with no subtext targets and clean dialogue", async () => {
    mockLLMReturn(baseLLMResponse({
      subtext_delivery_check: { results: [], undelivered_count: 0, surfaced_count: 0 },
    }));
    const result = await runDialogueEditor(baseInput({ subtextTargets: [] }));
    expect(result.score).toBe(10);
  });

  // ── Retry handling ──

  it("retries on schema validation failure", async () => {
    mockCallWithFallback
      .mockResolvedValueOnce({ content: JSON.stringify({ incomplete: true }) } as any)
      .mockResolvedValueOnce({ content: JSON.stringify(baseLLMResponse()) } as any);

    const result = await runDialogueEditor(baseInput());
    expect(result.score).toBe(10);
    expect(mockCallWithFallback).toHaveBeenCalledTimes(2);
  });

  it("throws after all retries exhausted", async () => {
    const { callWithFallback } = require("@/api/llmRouter");
    (callWithFallback as any).mockRejectedValue(new Error("provider down"));

    await expect(runDialogueEditor(baseInput())).rejects.toThrow(/All 3 attempts failed/);
  });
});
