/**
 * Contradiction Matrix Validation Tests
 * GHOSTLY v2.2 · S24
 *
 * Tests validateContradictionMatrix across protagonist, antagonist,
 * and supporting character roles.
 */

import { describe, it, expect } from "vitest";
import {
  validateContradictionMatrix,
  validateCharacter,
  type FullCharacterRecord,
} from "@/lib/characterDatabase";

// ── Helpers ─────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<FullCharacterRecord>): Partial<FullCharacterRecord> {
  return {
    id: "test_char",
    name: "Test Character",
    role: "protagonist",
    wound: "wound", flaw: "flaw", want: "want", need: "need",
    self_deception: "self_deception", fear: "fear",
    arc_start: "start", arc_end: "end", arc_lesson: "lesson",
    compressed_voice_dna: "A sufficiently long voice DNA string for validation purposes here",
    external_goal: "goal", internal_desire: "desire", goal_desire_gap: "gap",
    voice_corpus_status: "MISSING", voice_reliability: "MISSING", corpus_approved: false,
    ...overrides,
  };
}

const FULL_MATRIX = {
  behavioural: { stated_belief: "I protect people", actual_behaviour: "I isolate them", blind_spot: true },
  moral: { stated_principle: "Honesty first", collapse_condition: "When truth hurts loved ones", guilt_residue: null },
  historical: { past_action: "Left her alone", self_narrative: "I was always there", gap: "Went to a party" },
  competence: { exceptional_at: "Reading people", humiliated_by: "Cooking", origin: null },
};

// ── validateContradictionMatrix ─────────────────────────────────────────

describe("validateContradictionMatrix", () => {
  // Protagonist — all four dimensions required
  it("returns no errors for protagonist with complete matrix", () => {
    const errors = validateContradictionMatrix(makeRecord({ role: "protagonist", contradiction_matrix: FULL_MATRIX }));
    expect(errors).toHaveLength(0);
  });

  it("requires behavioural for protagonist", () => {
    const { behavioural, ...rest } = FULL_MATRIX;
    const errors = validateContradictionMatrix(makeRecord({ role: "protagonist", contradiction_matrix: rest }));
    expect(errors.some(e => e.field === "contradiction_matrix.behavioural")).toBe(true);
  });

  it("requires moral for protagonist", () => {
    const { moral, ...rest } = FULL_MATRIX;
    const errors = validateContradictionMatrix(makeRecord({ role: "protagonist", contradiction_matrix: rest }));
    expect(errors.some(e => e.field === "contradiction_matrix.moral")).toBe(true);
  });

  it("requires historical for protagonist", () => {
    const { historical, ...rest } = FULL_MATRIX;
    const errors = validateContradictionMatrix(makeRecord({ role: "protagonist", contradiction_matrix: rest }));
    expect(errors.some(e => e.field === "contradiction_matrix.historical")).toBe(true);
  });

  it("requires historical.gap for protagonist", () => {
    const matrix = {
      ...FULL_MATRIX,
      historical: { past_action: "Left her alone", self_narrative: "I was there", gap: null as string | null },
    };
    const errors = validateContradictionMatrix(makeRecord({ role: "protagonist", contradiction_matrix: matrix }));
    expect(errors.some(e => e.field === "contradiction_matrix.historical.gap")).toBe(true);
  });

  it("requires competence for protagonist", () => {
    const { competence, ...rest } = FULL_MATRIX;
    const errors = validateContradictionMatrix(makeRecord({ role: "protagonist", contradiction_matrix: rest }));
    expect(errors.some(e => e.field === "contradiction_matrix.competence")).toBe(true);
  });

  // Antagonist — behavioural + moral + historical required, no competence or gap
  it("returns no errors for antagonist with three dimensions", () => {
    const { competence, ...threeD } = FULL_MATRIX;
    const matrix = {
      ...threeD,
      historical: { past_action: "Did something", self_narrative: "Tells herself", gap: null as string | null },
    };
    const errors = validateContradictionMatrix(makeRecord({ role: "antagonist", contradiction_matrix: matrix }));
    expect(errors).toHaveLength(0);
  });

  it("requires behavioural for antagonist", () => {
    const errors = validateContradictionMatrix(makeRecord({ role: "antagonist", contradiction_matrix: {} }));
    expect(errors.some(e => e.field === "contradiction_matrix.behavioural")).toBe(true);
  });

  it("does not require competence for antagonist", () => {
    const { competence, ...rest } = FULL_MATRIX;
    const errors = validateContradictionMatrix(makeRecord({ role: "antagonist", contradiction_matrix: rest }));
    expect(errors.some(e => e.field === "contradiction_matrix.competence")).toBe(false);
  });

  it("does not require historical.gap for antagonist", () => {
    const matrix = {
      ...FULL_MATRIX,
      historical: { past_action: "action", self_narrative: "narrative", gap: null as string | null },
    };
    const errors = validateContradictionMatrix(makeRecord({ role: "antagonist", contradiction_matrix: matrix }));
    expect(errors.some(e => e.field === "contradiction_matrix.historical.gap")).toBe(false);
  });

  // Supporting — no requirements
  it("returns no errors for supporting with empty matrix", () => {
    const errors = validateContradictionMatrix(makeRecord({ role: "supporting", contradiction_matrix: {} }));
    expect(errors).toHaveLength(0);
  });

  it("returns no errors for supporting with no matrix at all", () => {
    const errors = validateContradictionMatrix(makeRecord({ role: "supporting" }));
    expect(errors).toHaveLength(0);
  });

  // Edge cases
  it("returns no errors when role is undefined", () => {
    const errors = validateContradictionMatrix({ contradiction_matrix: FULL_MATRIX });
    expect(errors).toHaveLength(0);
  });

  it("returns multiple errors for protagonist with no matrix", () => {
    const errors = validateContradictionMatrix(makeRecord({ role: "protagonist" }));
    // Should flag: behavioural, moral, historical, historical.gap, competence
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });

  it("partial behavioural still triggers error when actual_behaviour missing", () => {
    const matrix = {
      ...FULL_MATRIX,
      behavioural: { stated_belief: "I protect people", actual_behaviour: "", blind_spot: true },
    };
    const errors = validateContradictionMatrix(makeRecord({ role: "protagonist", contradiction_matrix: matrix }));
    expect(errors.some(e => e.field === "contradiction_matrix.behavioural")).toBe(true);
  });
});

// ── Integration: validateCharacter includes contradiction matrix ────────

describe("validateCharacter — contradiction matrix integration", () => {
  it("includes contradiction matrix errors in full validation for protagonist", () => {
    const errors = validateCharacter(makeRecord({ role: "protagonist" }));
    expect(errors.some(e => e.field.startsWith("contradiction_matrix"))).toBe(true);
  });

  it("passes full validation for protagonist with complete matrix", () => {
    const errors = validateCharacter(makeRecord({ role: "protagonist", contradiction_matrix: FULL_MATRIX }));
    expect(errors).toHaveLength(0);
  });

  it("passes full validation for supporting without matrix", () => {
    const errors = validateCharacter(makeRecord({ role: "supporting" }));
    expect(errors).toHaveLength(0);
  });
});
