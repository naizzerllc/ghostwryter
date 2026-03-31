/**
 * Reader Simulation Tests
 * GHOSTLY v2.2
 *
 * Tests: stateless call architecture, persona injection, result assembly,
 * score calculation, optimism offset, flags, sample read gate.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock callWithFallback before importing module
vi.mock("@/api/llmRouter", () => ({
  callWithFallback: vi.fn(),
}));

import { callWithFallback } from "@/api/llmRouter";
import {
  runReaderSimulation,
  runSampleReadGate,
  type ReaderSimulationInput,
} from "../readerSimulation";

const mockedCall = vi.mocked(callWithFallback);

function validLLMResponse(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    hook_compulsion: { would_continue: true, score: 8, reasoning: "Strong hook" },
    protagonist_sympathy: { engagement_maintained: true, protagonist_active: true, sympathy_score: 8, reasoning: "Active protagonist" },
    entry_assessment: { pulls_reader_in: true, entry_compulsion_score: 7, strengths: ["Gripping opening"], weaknesses: [] },
    information_mode: { delivered_mode: "WITH", mode_mismatch: false, ahead_mystery_lag: false, explanation: "Reader aligned" },
    ...overrides,
  });
}

function baseInput(overrides: Partial<ReaderSimulationInput> = {}): ReaderSimulationInput {
  return {
    chapterNumber: 3,
    chapterContent: "She walks into the room. The door clicks shut behind her.",
    isPrologueEpilogue: false,
    ...overrides,
  };
}

describe("runReaderSimulation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls reader_simulation task type (OpenAI routing)", async () => {
    mockedCall.mockResolvedValueOnce({ content: validLLMResponse(), model_used: "gpt-4o", provider: "openai", tokens_used: 500 });

    await runReaderSimulation(baseInput());

    expect(mockedCall).toHaveBeenCalledWith(
      "reader_simulation",
      expect.stringContaining("pacing-intolerant binge reader"),
      expect.any(Object),
    );
  });

  it("sends stateless single prompt — no messages array", async () => {
    mockedCall.mockResolvedValueOnce({ content: validLLMResponse(), model_used: "gpt-4o", provider: "openai", tokens_used: 500 });

    await runReaderSimulation(baseInput());

    // Second arg is a string, not an array — stateless
    const callArgs = mockedCall.mock.calls[0];
    expect(typeof callArgs[1]).toBe("string");
  });

  it("injects reader persona in the prompt", async () => {
    mockedCall.mockResolvedValueOnce({ content: validLLMResponse(), model_used: "gpt-4o", provider: "openai", tokens_used: 500 });

    await runReaderSimulation(baseInput());

    const prompt = mockedCall.mock.calls[0][1] as string;
    expect(prompt).toContain("pacing-intolerant binge reader");
    expect(prompt).toContain("abandon slow chapter openings");
    expect(prompt).toContain("actively trying to spot the twist");
  });

  it("assembles result with correct chapter number and score", async () => {
    mockedCall.mockResolvedValueOnce({ content: validLLMResponse(), model_used: "gpt-4o", provider: "openai", tokens_used: 500 });

    const result = await runReaderSimulation(baseInput({ chapterNumber: 7 }));

    expect(result.chapter_number).toBe(7);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it("calculates composite score from sub-scores", async () => {
    mockedCall.mockResolvedValueOnce({
      content: validLLMResponse({
        hook_compulsion: { would_continue: true, score: 10, reasoning: "" },
        protagonist_sympathy: { engagement_maintained: true, protagonist_active: true, sympathy_score: 10, reasoning: "" },
        entry_assessment: { pulls_reader_in: true, entry_compulsion_score: 10, strengths: [], weaknesses: [] },
        information_mode: { delivered_mode: "WITH", mode_mismatch: false, ahead_mystery_lag: false, explanation: "" },
      }),
      model_used: "gpt-4o", provider: "openai", tokens_used: 500,
    });

    const result = await runReaderSimulation(baseInput());
    // 10*0.35 + 10*0.25 + 10*0.25 + 9*0.15 = 3.5+2.5+2.5+1.35 = 9.85
    expect(result.score).toBeCloseTo(9.9, 0);
  });

  it("applies optimism offset to score", async () => {
    mockedCall.mockResolvedValueOnce({ content: validLLMResponse(), model_used: "gpt-4o", provider: "openai", tokens_used: 500 });
    const withOffset = await runReaderSimulation(baseInput({ optimismOffset: 1.0 }));

    mockedCall.mockResolvedValueOnce({ content: validLLMResponse(), model_used: "gpt-4o", provider: "openai", tokens_used: 500 });
    const withoutOffset = await runReaderSimulation(baseInput());

    expect(withOffset.score).toBeLessThan(withoutOffset.score);
  });

  it("clamps score to 0-10 range", async () => {
    mockedCall.mockResolvedValueOnce({
      content: validLLMResponse({
        hook_compulsion: { would_continue: false, score: 1, reasoning: "" },
        protagonist_sympathy: { engagement_maintained: false, protagonist_active: false, sympathy_score: 1, reasoning: "" },
        entry_assessment: { pulls_reader_in: false, entry_compulsion_score: 1, strengths: [], weaknesses: [] },
        information_mode: { delivered_mode: "BEHIND", mode_mismatch: true, ahead_mystery_lag: false, explanation: "" },
      }),
      model_used: "gpt-4o", provider: "openai", tokens_used: 500,
    });

    const result = await runReaderSimulation(baseInput({ optimismOffset: 20 }));
    expect(result.score).toBe(0);
  });

  // ── Flags ──

  it("flags HOOK_FAIL when reader would not continue", async () => {
    mockedCall.mockResolvedValueOnce({
      content: validLLMResponse({
        hook_compulsion: { would_continue: false, score: 3, reasoning: "Boring ending" },
      }),
      model_used: "gpt-4o", provider: "openai", tokens_used: 500,
    });

    const result = await runReaderSimulation(baseInput());
    expect(result.flags.some(f => f.code === "HOOK_FAIL")).toBe(true);
  });

  it("flags PROTAGONIST_PASSIVE when protagonist inactive", async () => {
    mockedCall.mockResolvedValueOnce({
      content: validLLMResponse({
        protagonist_sympathy: { engagement_maintained: true, protagonist_active: false, sympathy_score: 5, reasoning: "" },
      }),
      model_used: "gpt-4o", provider: "openai", tokens_used: 500,
    });

    const result = await runReaderSimulation(baseInput());
    expect(result.flags.some(f => f.code === "PROTAGONIST_PASSIVE")).toBe(true);
  });

  it("flags WEAK_OPENING when entry compulsion < 5", async () => {
    mockedCall.mockResolvedValueOnce({
      content: validLLMResponse({
        entry_assessment: { pulls_reader_in: false, entry_compulsion_score: 3, strengths: [], weaknesses: ["Slow"] },
      }),
      model_used: "gpt-4o", provider: "openai", tokens_used: 500,
    });

    const result = await runReaderSimulation(baseInput());
    expect(result.flags.some(f => f.code === "WEAK_OPENING")).toBe(true);
  });

  it("flags MODE_MISMATCH when information mode differs from intended", async () => {
    mockedCall.mockResolvedValueOnce({
      content: validLLMResponse({
        information_mode: { delivered_mode: "AHEAD", mode_mismatch: true, ahead_mystery_lag: false, explanation: "Mismatch" },
      }),
      model_used: "gpt-4o", provider: "openai", tokens_used: 500,
    });

    const result = await runReaderSimulation(baseInput({ intendedInformationMode: "WITH" }));
    expect(result.flags.some(f => f.code === "MODE_MISMATCH")).toBe(true);
  });

  it("flags AHEAD_MYSTERY_LAG when reader ahead in mystery chapter", async () => {
    mockedCall.mockResolvedValueOnce({
      content: validLLMResponse({
        information_mode: { delivered_mode: "AHEAD", mode_mismatch: false, ahead_mystery_lag: true, explanation: "Collapsed" },
      }),
      model_used: "gpt-4o", provider: "openai", tokens_used: 500,
    });

    const result = await runReaderSimulation(baseInput());
    expect(result.flags.some(f => f.code === "AHEAD_MYSTERY_LAG")).toBe(true);
  });

  // ── Sympathy Curve ──

  it("builds sympathy curve record", async () => {
    mockedCall.mockResolvedValueOnce({ content: validLLMResponse(), model_used: "gpt-4o", provider: "openai", tokens_used: 500 });

    const result = await runReaderSimulation(baseInput({ chapterNumber: 5 }));
    expect(result.sympathy_curve_record.chapter_number).toBe(5);
    expect(result.sympathy_curve_record.sympathy_score).toBe(8);
    expect(result.sympathy_curve_record.protagonist_active).toBe(true);
  });

  // ── Prologue/Epilogue ──

  it("includes prologue/epilogue loop check when flagged", async () => {
    mockedCall.mockResolvedValueOnce({
      content: validLLMResponse({
        prologue_epilogue_loop: { loop_pays_off: false, tension_deflated: true, explanation: "Deflated" },
      }),
      model_used: "gpt-4o", provider: "openai", tokens_used: 500,
    });

    const result = await runReaderSimulation(baseInput({ isPrologueEpilogue: true }));
    expect(result.prologue_epilogue_loop).toBeDefined();
    expect(result.prologue_epilogue_loop?.tension_deflated).toBe(true);
    expect(result.flags.some(f => f.code === "LOOP_TENSION_DEFLATED")).toBe(true);
  });

  // ── Retries ──

  it("retries on parse failure up to MAX_RETRIES", async () => {
    mockedCall
      .mockResolvedValueOnce({ content: "not json", model_used: "gpt-4o", provider: "openai", tokens_used: 100 })
      .mockResolvedValueOnce({ content: "still bad", model_used: "gpt-4o", provider: "openai", tokens_used: 100 })
      .mockResolvedValueOnce({ content: validLLMResponse(), model_used: "gpt-4o", provider: "openai", tokens_used: 500 });

    const result = await runReaderSimulation(baseInput());
    expect(result.chapter_number).toBe(3);
    expect(mockedCall).toHaveBeenCalledTimes(3);
  });

  it("throws after all retries exhausted", async () => {
    mockedCall.mockResolvedValue({ content: "bad json", model_used: "gpt-4o", provider: "openai", tokens_used: 100 });

    await expect(runReaderSimulation(baseInput())).rejects.toThrow("All 3 attempts failed");
  });

  // ── JSON extraction ──

  it("extracts JSON from markdown code blocks", async () => {
    const wrapped = "```json\n" + validLLMResponse() + "\n```";
    mockedCall.mockResolvedValueOnce({ content: wrapped, model_used: "gpt-4o", provider: "openai", tokens_used: 500 });

    const result = await runReaderSimulation(baseInput());
    expect(result.chapter_number).toBe(3);
  });
});

describe("runSampleReadGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns acquisition decision from LLM response", async () => {
    mockedCall.mockResolvedValueOnce({
      content: JSON.stringify({
        acquisition_decision: "YES",
        reasons: ["Great pacing", "Strong hook"],
        strongest_element: "Opening scene tension",
        weakest_element: "Minor pacing dip in ch2",
        recommendation: "Proceed with confidence",
      }),
      model_used: "gpt-4o", provider: "openai", tokens_used: 800,
    });

    const result = await runSampleReadGate("Chapter 1 content... Chapter 2 content...");
    expect(result.acquisition_decision).toBe("YES");
    expect(result.reasons).toHaveLength(2);
    expect(result.strongest_element).toBeTruthy();
  });

  it("uses reader_simulation task type", async () => {
    mockedCall.mockResolvedValueOnce({
      content: JSON.stringify({
        acquisition_decision: "MARGINAL",
        reasons: [],
        strongest_element: "",
        weakest_element: "",
        recommendation: "",
      }),
      model_used: "gpt-4o", provider: "openai", tokens_used: 500,
    });

    await runSampleReadGate("sample content");
    expect(mockedCall).toHaveBeenCalledWith("reader_simulation", expect.any(String), expect.any(Object));
  });

  it("throws after all retries fail", async () => {
    mockedCall.mockResolvedValue({ content: "bad", model_used: "gpt-4o", provider: "openai", tokens_used: 100 });

    await expect(runSampleReadGate("content")).rejects.toThrow("All 3 attempts failed");
  });
});
