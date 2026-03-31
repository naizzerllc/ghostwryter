/**
 * Misdirection Erosion Index (MEI) Tests
 * GHOSTLY v2.2 · Quality Module Coverage
 *
 * Tests: shouldRunMEI gating, composite status calculation, flag generation,
 * retry logic, generation blocking, JSON extraction.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  shouldRunMEI,
  runMEI,
  meiBlocksGeneration,
  type MEIInput,
  type MEIResult,
} from "../misdirectionErosionIndex";

vi.mock("@/api/llmRouter", () => ({
  callWithFallback: vi.fn(),
}));

import { callWithFallback } from "@/api/llmRouter";

const mockLLM = vi.mocked(callWithFallback);

function baseInput(overrides: Partial<MEIInput> = {}): MEIInput {
  return {
    triggerChapter: 20,
    misdirectionMap: "Narrator suppresses memory of the accident.",
    approvedChaptersSummary: "Chapters 11-20 summary...",
    twistMode: "FULL",
    revelationChapter: 35,
    ...overrides,
  };
}

function mockMEIResponse(data: Record<string, unknown>) {
  mockLLM.mockResolvedValueOnce({
    content: JSON.stringify(data),
    model_used: "gemini-2.0-flash",
    provider: "gemini_flash",
    tokens_used: 500,
  } as any);
}

function greenResponse(overrides: Record<string, unknown> = {}) {
  return {
    possibility_space: "WIDE",
    suppressed_evidence_exposure: "NONE",
    self_deception_coherence: "FULL_STRENGTH",
    erosion_chapters: [],
    analysis: "All dimensions healthy.",
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

// ── shouldRunMEI ──

describe("shouldRunMEI", () => {
  it("returns false for twist_architecture none", () => {
    expect(shouldRunMEI(20, 35, "none")).toBe(false);
  });

  it("returns false before chapter 10", () => {
    expect(shouldRunMEI(5, 35, "active")).toBe(false);
  });

  it("returns false after revelation - 5", () => {
    expect(shouldRunMEI(31, 35, "active")).toBe(false);
  });

  it("returns true at chapter 10", () => {
    expect(shouldRunMEI(10, 35, "active")).toBe(true);
  });

  it("returns true at chapter 20", () => {
    expect(shouldRunMEI(20, 35, "active")).toBe(true);
  });

  it("returns false at chapter 15 (not multiple of 10)", () => {
    expect(shouldRunMEI(15, 35, "active")).toBe(false);
  });

  it("returns true at revelation - 5 exactly if multiple of 10", () => {
    expect(shouldRunMEI(30, 35, "active")).toBe(true);
  });
});

// ── Composite status ──

describe("runMEI — composite status", () => {
  it("returns GREEN when all dimensions healthy", async () => {
    mockMEIResponse(greenResponse());
    const result = await runMEI(baseInput());
    expect(result.composite_status).toBe("GREEN");
    expect(result.action_required).toBe(false);
    expect(result.flags).toHaveLength(0);
  });

  it("returns CRITICAL on COLLAPSED possibility space", async () => {
    mockMEIResponse(greenResponse({ possibility_space: "COLLAPSED" }));
    const result = await runMEI(baseInput());
    expect(result.composite_status).toBe("CRITICAL");
    expect(result.action_required).toBe(true);
    expect(result.flags.some(f => f.code === "MEI_POSSIBILITY_COLLAPSED")).toBe(true);
  });

  it("returns CRITICAL on COMPROMISED self-deception", async () => {
    mockMEIResponse(greenResponse({ self_deception_coherence: "COMPROMISED" }));
    const result = await runMEI(baseInput());
    expect(result.composite_status).toBe("CRITICAL");
    expect(result.flags.some(f => f.code === "MEI_SELF_DECEPTION_COMPROMISED")).toBe(true);
  });

  it("returns RED when two dimensions degraded", async () => {
    mockMEIResponse(greenResponse({
      possibility_space: "NARROW",
      suppressed_evidence_exposure: "EXPOSURE_RISK",
    }));
    const result = await runMEI(baseInput());
    expect(result.composite_status).toBe("RED");
    expect(result.action_required).toBe(true);
    expect(result.flags.some(f => f.code === "MEI_RED")).toBe(true);
  });

  it("returns AMBER when one dimension degraded", async () => {
    mockMEIResponse(greenResponse({ possibility_space: "NARROW" }));
    const result = await runMEI(baseInput());
    expect(result.composite_status).toBe("AMBER");
  });

  it("returns AMBER when two warning-level dimensions", async () => {
    mockMEIResponse(greenResponse({
      possibility_space: "MODERATE",
      suppressed_evidence_exposure: "PROXIMITY_WARNING",
    }));
    const result = await runMEI(baseInput());
    expect(result.composite_status).toBe("AMBER");
  });
});

// ── Flag generation ──

describe("runMEI — flags", () => {
  it("generates NARROW possibility warning with chapter citations", async () => {
    mockMEIResponse(greenResponse({
      possibility_space: "NARROW",
      erosion_chapters: [14, 18],
    }));
    const result = await runMEI(baseInput());
    const flag = result.flags.find(f => f.code === "MEI_POSSIBILITY_NARROW");
    expect(flag).toBeDefined();
    expect(flag!.chapter_citations).toEqual([14, 18]);
  });

  it("generates EXPOSURE_RISK warning", async () => {
    mockMEIResponse(greenResponse({ suppressed_evidence_exposure: "EXPOSURE_RISK" }));
    const result = await runMEI(baseInput());
    expect(result.flags.some(f => f.code === "MEI_EVIDENCE_EXPOSED")).toBe(true);
  });

  it("generates PROXIMITY_WARNING note", async () => {
    mockMEIResponse(greenResponse({ suppressed_evidence_exposure: "PROXIMITY_WARNING" }));
    const result = await runMEI(baseInput());
    expect(result.flags.some(f => f.code === "MEI_EVIDENCE_PROXIMITY")).toBe(true);
  });

  it("generates THINNING self-deception warning", async () => {
    mockMEIResponse(greenResponse({ self_deception_coherence: "THINNING" }));
    const result = await runMEI(baseInput());
    expect(result.flags.some(f => f.code === "MEI_SELF_DECEPTION_THINNING")).toBe(true);
  });

  it("omits self-deception for EXTERNAL twist mode", async () => {
    mockMEIResponse(greenResponse({ self_deception_coherence: null }));
    const result = await runMEI(baseInput({ twistMode: "EXTERNAL" }));
    expect(result.self_deception_coherence).toBeNull();
  });
});

// ── Retry logic ──

describe("runMEI — retries and errors", () => {
  it("retries on invalid JSON and succeeds", async () => {
    mockLLM.mockResolvedValueOnce({ content: "not json", model_used: "x", provider: "y", tokens_used: 0 } as any);
    mockMEIResponse(greenResponse());
    const result = await runMEI(baseInput());
    expect(result.composite_status).toBe("GREEN");
    expect(mockLLM).toHaveBeenCalledTimes(2);
  });

  it("throws after all retries exhausted", async () => {
    mockLLM.mockResolvedValue({ content: "bad", model_used: "x", provider: "y", tokens_used: 0 } as any);
    await expect(runMEI(baseInput())).rejects.toThrow("All 3 attempts failed");
  });

  it("handles JSON wrapped in markdown code blocks", async () => {
    mockLLM.mockResolvedValueOnce({
      content: "```json\n" + JSON.stringify(greenResponse()) + "\n```",
      model_used: "gemini-2.0-flash",
      provider: "gemini_flash",
      tokens_used: 500,
    } as any);
    const result = await runMEI(baseInput());
    expect(result.composite_status).toBe("GREEN");
  });
});

// ── Generation blocking ──

describe("meiBlocksGeneration", () => {
  it("blocks on CRITICAL", () => {
    expect(meiBlocksGeneration({ composite_status: "CRITICAL" } as MEIResult)).toBe(true);
  });

  it("does not block on RED", () => {
    expect(meiBlocksGeneration({ composite_status: "RED" } as MEIResult)).toBe(false);
  });

  it("does not block on GREEN", () => {
    expect(meiBlocksGeneration({ composite_status: "GREEN" } as MEIResult)).toBe(false);
  });
});
