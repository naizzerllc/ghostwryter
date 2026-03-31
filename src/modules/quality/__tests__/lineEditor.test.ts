/**
 * Line Editor Tests
 * GHOSTLY v2.2 · Quality Module Coverage
 *
 * Tests assembleResult logic: flag generation, score weighting,
 * forbidden words integration, retry/error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runLineEditor, type LineEditorInput } from "../lineEditor";
import type { ForbiddenWordsResult } from "@/utils/forbiddenWordsChecker";

vi.mock("@/api/llmRouter", () => ({
  callWithFallback: vi.fn(),
}));

function cleanFWResult(): ForbiddenWordsResult {
  return { violations: [], hardBanCount: 0, softBanCount: 0, dialogueExemptCleared: 0, contextFlagCount: 0 };
}

function baseInput(overrides: Partial<LineEditorInput> = {}): LineEditorInput {
  return {
    chapterNumber: 3,
    chapterContent: "Prose content here.",
    forbiddenWordsResult: cleanFWResult(),
    ...overrides,
  };
}

function baseLLMResponse(overrides: Record<string, unknown> = {}) {
  return {
    cut_test_scan: { cuttable_percentage: 10, cuttable_count: 3, total_sentences: 30, worst_offenders: [], score: 9 },
    sentence_rhythm_check: { rhythm_uniformity_score: 30, rhythm_variance_score: 4.5, dominant_length_band: "10-15", sentence_lengths: [8, 12, 15, 6, 20], score: 9 },
    backstory_dump_check: { backstory_dump_instances: [], total_backstory_words: 0 },
    prose_dna_compliance: {
      r1_show_dont_tell: { compliant: true, violations: [] },
      r3_rhythm_modulation: { compliant: true, note: "Good variance." },
      r14_non_visual_senses: { compliant: true, senses_found: ["touch", "sound"], count: 2 },
      violations: [],
    },
    ...overrides,
  };
}

function mockLLMReturn(data: Record<string, unknown>) {
  const { callWithFallback } = require("@/api/llmRouter");
  (callWithFallback as any).mockResolvedValue({ content: JSON.stringify(data) });
}

describe("lineEditor", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Happy path ──

  it("returns valid result for clean prose", async () => {
    mockLLMReturn(baseLLMResponse());
    const result = await runLineEditor(baseInput());

    expect(result.chapter_number).toBe(3);
    expect(result.flags).toHaveLength(0);
    expect(result.score).toBeGreaterThanOrEqual(8);
    expect(result.forbidden_words_score_impact).toBe(0);
  });

  // ── Cut Test flags ──

  it("flags CUT_TEST_PADDED when >30% cuttable", async () => {
    mockLLMReturn(baseLLMResponse({
      cut_test_scan: { cuttable_percentage: 45, cuttable_count: 14, total_sentences: 30, worst_offenders: ["filler sentence"], score: 5 },
    }));
    const result = await runLineEditor(baseInput());
    expect(result.flags.some(f => f.code === "CUT_TEST_PADDED" && f.severity === "WARNING")).toBe(true);
  });

  it("does not flag CUT_TEST_PADDED when <=30% cuttable", async () => {
    mockLLMReturn(baseLLMResponse({
      cut_test_scan: { cuttable_percentage: 25, cuttable_count: 7, total_sentences: 30, worst_offenders: [], score: 7 },
    }));
    const result = await runLineEditor(baseInput());
    expect(result.flags.some(f => f.code === "CUT_TEST_PADDED")).toBe(false);
  });

  // ── Rhythm flags ──

  it("flags RHYTHM_UNIFORM when >60% uniformity", async () => {
    mockLLMReturn(baseLLMResponse({
      sentence_rhythm_check: { rhythm_uniformity_score: 75, rhythm_variance_score: 1.2, dominant_length_band: "12-17", sentence_lengths: [13, 14, 15, 14, 13], score: 4 },
    }));
    const result = await runLineEditor(baseInput());
    expect(result.flags.some(f => f.code === "RHYTHM_UNIFORM")).toBe(true);
  });

  // ── Backstory dump flags ──

  it("flags each BACKSTORY_DUMP instance", async () => {
    mockLLMReturn(baseLLMResponse({
      backstory_dump_check: {
        backstory_dump_instances: [
          { location: "para 3", word_count: 80, compression_instruction: "Compress.", excerpt: "She remembered the time when" },
          { location: "para 7", word_count: 60, compression_instruction: "Compress.", excerpt: "Years ago she had been" },
        ],
        total_backstory_words: 140,
      },
    }));
    const result = await runLineEditor(baseInput());
    expect(result.flags.filter(f => f.code === "BACKSTORY_DUMP")).toHaveLength(2);
  });

  // ── Prose DNA compliance flags ──

  it("flags PROSE_DNA_R1 on show-don't-tell violation", async () => {
    mockLLMReturn(baseLLMResponse({
      prose_dna_compliance: {
        r1_show_dont_tell: { compliant: false, violations: ["She felt angry."] },
        r3_rhythm_modulation: { compliant: true, note: "" },
        r14_non_visual_senses: { compliant: true, senses_found: ["touch", "smell"], count: 2 },
        violations: [],
      },
    }));
    const result = await runLineEditor(baseInput());
    expect(result.flags.some(f => f.code === "PROSE_DNA_R1")).toBe(true);
  });

  it("flags PROSE_DNA_R14 when <2 non-visual senses", async () => {
    mockLLMReturn(baseLLMResponse({
      prose_dna_compliance: {
        r1_show_dont_tell: { compliant: true, violations: [] },
        r3_rhythm_modulation: { compliant: true, note: "" },
        r14_non_visual_senses: { compliant: false, senses_found: ["touch"], count: 1 },
        violations: [],
      },
    }));
    const result = await runLineEditor(baseInput());
    expect(result.flags.some(f => f.code === "PROSE_DNA_R14")).toBe(true);
  });

  // ── Forbidden words impact ──

  it("applies forbidden words score impact for hard bans", async () => {
    mockLLMReturn(baseLLMResponse());
    const fwResult: ForbiddenWordsResult = {
      violations: [{ word: "suddenly", tier: "hard_ban", context: "narration", location: "p1" }],
      hardBanCount: 1,
      softBanCount: 0,
      dialogueExemptCleared: 0,
      contextFlagCount: 0,
    };
    const result = await runLineEditor(baseInput({ forbiddenWordsResult: fwResult }));
    expect(result.forbidden_words_score_impact).toBeGreaterThan(0);
  });

  // ── Score weighting ──

  it("computes weighted composite score", async () => {
    mockLLMReturn(baseLLMResponse({
      cut_test_scan: { cuttable_percentage: 10, cuttable_count: 3, total_sentences: 30, worst_offenders: [], score: 8 },
      sentence_rhythm_check: { rhythm_uniformity_score: 30, rhythm_variance_score: 4, dominant_length_band: "10-15", sentence_lengths: [], score: 7 },
    }));
    const result = await runLineEditor(baseInput());
    // rhythm(7)*0.30 + cut(8)*0.25 + backstory(10)*0.20 + dna(10)*0.15 + fw(10)*0.10
    // = 2.1 + 2.0 + 2.0 + 1.5 + 1.0 = 8.6
    expect(result.score).toBeCloseTo(8.6, 1);
  });

  // ── Retry handling ──

  it("retries on malformed JSON and succeeds", async () => {
    const { callWithFallback } = require("@/api/llmRouter");
    (callWithFallback as any)
      .mockResolvedValueOnce({ content: "broken" })
      .mockResolvedValueOnce({ content: JSON.stringify(baseLLMResponse()) });

    const result = await runLineEditor(baseInput());
    expect(result.score).toBeGreaterThan(0);
    expect(callWithFallback).toHaveBeenCalledTimes(2);
  });

  it("throws after all retries exhausted", async () => {
    const { callWithFallback } = require("@/api/llmRouter");
    (callWithFallback as any).mockResolvedValue({ content: "{}" });

    await expect(runLineEditor(baseInput())).rejects.toThrow(/All 3 attempts failed/);
  });
});
