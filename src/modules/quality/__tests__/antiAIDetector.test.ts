/**
 * Anti-AI Detector Tests
 * GHOSTLY v2.2
 *
 * Tests: two-pass architecture, primary/secondary routing, combined scoring,
 * systematic tell detection, flags, retry logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/api/llmRouter", () => ({
  callWithFallback: vi.fn(),
}));

import { callWithFallback } from "@/api/llmRouter";
import { runAntiAIDetector, type AntiAIDetectorInput } from "../antiAIDetector";

const mockedCall = vi.mocked(callWithFallback);

function flash(content: string) {
  return { content, model_used: "gemini-2.0-flash", provider: "gemini_flash" as const, tokens_used: 600, fallback_used: false };
}
function claude(content: string) {
  return { content, model_used: "claude-sonnet", provider: "anthropic" as const, tokens_used: 500, fallback_used: false };
}

function primaryResponse(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    rhythm_uniformity: { detected: false, score: 8, details: "Good variation" },
    lexical_overreach: { detected: false, score: 9, details: "Consistent register" },
    structural_completeness: { detected: false, score: 8, details: "Open threads" },
    hedging_constructions: { detected: false, count: 1, details: "Minimal hedging" },
    emotional_explanation: { detected: false, score: 9, details: "Shows not tells" },
    tells: [],
    primary_score: 8.5,
    ...overrides,
  });
}

function secondaryResponse(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    prose_dna_compliance_feels_manufactured: false,
    ai_sentence_openings: { detected: false, count: 0, examples: [] },
    register_manufactured: false,
    tells: [],
    secondary_score: 8.0,
    ...overrides,
  });
}

function baseInput(overrides: Partial<AntiAIDetectorInput> = {}): AntiAIDetectorInput {
  return {
    chapterNumber: 5,
    chapterContent: "She walks into the room. The fluorescent light hums.",
    ...overrides,
  };
}

describe("runAntiAIDetector", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("runs primary and secondary passes in parallel", async () => {
    mockedCall
      .mockResolvedValueOnce(flash(primaryResponse()))
      .mockResolvedValueOnce(claude(secondaryResponse()));
    const result = await runAntiAIDetector(baseInput());
    expect(mockedCall).toHaveBeenCalledTimes(2);
    expect(mockedCall.mock.calls[0][0]).toBe("anti_ai_detection");
    expect(mockedCall.mock.calls[1][0]).toBe("anti_ai_detection_secondary");
  });

  it("calculates combined score with correct weighting (0.667/0.333)", async () => {
    mockedCall
      .mockResolvedValueOnce(flash(primaryResponse({ primary_score: 9.0 })))
      .mockResolvedValueOnce(claude(secondaryResponse({ secondary_score: 6.0 })));
    const result = await runAntiAIDetector(baseInput());
    expect(result.combined_score).toBeCloseTo(8.0, 0);
    expect(result.primary_score).toBe(9.0);
    expect(result.secondary_score).toBe(6.0);
  });

  it("clamps combined score to 0-10", async () => {
    mockedCall
      .mockResolvedValueOnce(flash(primaryResponse({ primary_score: 10 })))
      .mockResolvedValueOnce(claude(secondaryResponse({ secondary_score: 10 })));
    const result = await runAntiAIDetector(baseInput());
    expect(result.combined_score).toBeLessThanOrEqual(10);
    expect(result.combined_score).toBeGreaterThanOrEqual(0);
  });

  it("merges tells from both passes", async () => {
    mockedCall
      .mockResolvedValueOnce(flash(primaryResponse({
        tells: [{ tell_id: "hedging_1", category: "hedging", description: "Excessive hedging", severity: "WARNING" }],
      })))
      .mockResolvedValueOnce(claude(secondaryResponse({
        tells: [{ tell_id: "manufactured_1", category: "register", description: "Manufactured voice", severity: "NOTE" }],
      })));
    const result = await runAntiAIDetector(baseInput());
    expect(result.tells_detected).toHaveLength(2);
  });

  it("flags AI_DETECTION_HIGH when combined score < 5", async () => {
    mockedCall
      .mockResolvedValueOnce(flash(primaryResponse({ primary_score: 3 })))
      .mockResolvedValueOnce(claude(secondaryResponse({ secondary_score: 2 })));
    const result = await runAntiAIDetector(baseInput());
    expect(result.flags.some(f => f.code === "AI_DETECTION_HIGH")).toBe(true);
  });

  it("flags REGISTER_MANUFACTURED when secondary detects it", async () => {
    mockedCall
      .mockResolvedValueOnce(flash(primaryResponse()))
      .mockResolvedValueOnce(claude(secondaryResponse({ register_manufactured: true })));
    const result = await runAntiAIDetector(baseInput());
    expect(result.flags.some(f => f.code === "REGISTER_MANUFACTURED")).toBe(true);
  });

  it("detects systematic tell across 3 consecutive chapters", async () => {
    mockedCall
      .mockResolvedValueOnce(flash(primaryResponse({
        tells: [{ tell_id: "hedging_pattern", category: "hedging", description: "Hedging", severity: "WARNING" }],
      })))
      .mockResolvedValueOnce(claude(secondaryResponse()));
    const result = await runAntiAIDetector(baseInput({
      previousChapterTells: [["hedging_pattern", "other_tell"], ["hedging_pattern"]],
    }));
    expect(result.systematic_tell_flag).toBe(true);
    expect(result.flags.some(f => f.code === "SYSTEMATIC_TELL_PATTERN")).toBe(true);
  });

  it("no systematic flag with only 1 previous chapter", async () => {
    mockedCall
      .mockResolvedValueOnce(flash(primaryResponse({
        tells: [{ tell_id: "hedging_pattern", category: "hedging", description: "Hedging", severity: "WARNING" }],
      })))
      .mockResolvedValueOnce(claude(secondaryResponse()));
    const result = await runAntiAIDetector(baseInput({ previousChapterTells: [["hedging_pattern"]] }));
    expect(result.systematic_tell_flag).toBe(false);
  });

  it("no systematic flag when tells differ across chapters", async () => {
    mockedCall
      .mockResolvedValueOnce(flash(primaryResponse({
        tells: [{ tell_id: "new_tell", category: "rhythm", description: "Rhythm", severity: "NOTE" }],
      })))
      .mockResolvedValueOnce(claude(secondaryResponse()));
    const result = await runAntiAIDetector(baseInput({
      previousChapterTells: [["hedging_pattern"], ["other_pattern"]],
    }));
    expect(result.systematic_tell_flag).toBe(false);
  });

  it("passes rhythmUniformFlagged to primary prompt", async () => {
    mockedCall
      .mockResolvedValueOnce(flash(primaryResponse()))
      .mockResolvedValueOnce(claude(secondaryResponse()));
    await runAntiAIDetector(baseInput({ rhythmUniformFlagged: true }));
    const primaryPrompt = mockedCall.mock.calls[0][1] as string;
    expect(primaryPrompt).toContain("RHYTHM_UNIFORM");
  });

  it("retries primary pass on parse failure", async () => {
    mockedCall
      .mockResolvedValueOnce(flash("bad json"))
      .mockResolvedValueOnce(claude(secondaryResponse()))
      .mockResolvedValueOnce(flash(primaryResponse()));
    const result = await runAntiAIDetector(baseInput());
    expect(result.chapter_number).toBe(5);
  });

  it("returns correct chapter number", async () => {
    mockedCall
      .mockResolvedValueOnce(flash(primaryResponse()))
      .mockResolvedValueOnce(claude(secondaryResponse()));
    const result = await runAntiAIDetector(baseInput({ chapterNumber: 12 }));
    expect(result.chapter_number).toBe(12);
  });
});
