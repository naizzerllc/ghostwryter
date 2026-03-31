import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApprovedRecord } from "../approvedRecordFactory";
import type { GenerationSuccess } from "../generationCore";

function makeGenerationSuccess(overrides: Partial<GenerationSuccess> = {}): GenerationSuccess {
  return {
    blocked: false,
    content: "The hallway smells of lemon cleaner.",
    model_used: "claude-sonnet-latest",
    tokens_used: 1200,
    cache_read_tokens: 800,
    cache_write_tokens: 400,
    refusal_detected: false,
    truncation_suspected: false,
    forbidden_word_violations: {
      violations: [],
      hardBanCount: 0,
      softBanCount: 0,
      dialogueExemptCleared: 0,
      contextFlagCount: 0,
    },
    boundary_violations: [],
    brief: {} as any,
    validation: {} as any,
    generation_config: {
      prose_dna_version: "v2.4",
      tell_suppression_active: true,
      tell_suppression_version: "1.0",
    },
    ...overrides,
  };
}

describe("approvedRecordFactory", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T12:00:00Z"));
  });

  it("creates record with PENDING sign-off status [A16-1]", () => {
    const result = createApprovedRecord(1, makeGenerationSuccess());
    expect(result.human_editorial_sign_off.status).toBe("PENDING");
    expect(result.human_editorial_sign_off.signed_by).toBeNull();
    expect(result.human_editorial_sign_off.signed_at).toBeNull();
  });

  it("copies chapter number and model metadata", () => {
    const result = createApprovedRecord(5, makeGenerationSuccess({ tokens_used: 2000 }));
    expect(result.chapter_number).toBe(5);
    expect(result.model_used).toBe("claude-sonnet-latest");
    expect(result.tokens_used).toBe(2000);
    expect(result.cache_read_tokens).toBe(800);
    expect(result.cache_write_tokens).toBe(400);
  });

  it("defaults override fields to false/null", () => {
    const result = createApprovedRecord(1, makeGenerationSuccess());
    expect(result.human_editorial_override).toBe(false);
    expect(result.override_note).toBeNull();
    expect(result.composite_score).toBeNull();
    expect(result.emotional_state_at_chapter_end).toBeNull();
  });

  it("sets truncation flag from generation result", () => {
    const result = createApprovedRecord(1, makeGenerationSuccess({ truncation_suspected: true }));
    expect(result.generation_truncation_suspected).toBe(true);
    expect(result.human_editorial_sign_off.notes).toContain("TRUNCATION_SUSPECTED");
  });

  it("does not add truncation note when truncation is false", () => {
    const result = createApprovedRecord(1, makeGenerationSuccess({ truncation_suspected: false }));
    expect(result.generation_truncation_suspected).toBe(false);
    expect(result.human_editorial_sign_off.notes).toBeNull();
  });

  it("sets approved_at timestamp", () => {
    const result = createApprovedRecord(1, makeGenerationSuccess());
    expect(result.approved_at).toBe("2026-03-31T12:00:00.000Z");
  });
});
