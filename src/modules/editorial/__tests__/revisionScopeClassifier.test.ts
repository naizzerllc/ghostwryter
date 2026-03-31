import { describe, it, expect } from "vitest";
import { classifyRevisionScope, type RevisionRequest } from "../revisionScopeClassifier";

function makeRequest(overrides: Partial<RevisionRequest> = {}): RevisionRequest {
  return {
    instruction: "Fix a typo",
    chapter_number: 3,
    chapter_content: "Some chapter content.",
    forbidden_word_violation_count: 0,
    scene_purpose_changed: false,
    structural_change: false,
    ...overrides,
  };
}

describe("classifyRevisionScope", () => {
  // ── FULL_REGENERATION ──────────────────────────────────────────────
  it("returns FULL_REGENERATION when scene_purpose_changed is true", () => {
    const result = classifyRevisionScope(makeRequest({ scene_purpose_changed: true }));
    expect(result.scope).toBe("FULL_REGENERATION");
    expect(result.memory_update_required).toBe(true);
    expect(result.estimated_tokens).toBe(8000);
  });

  it("returns FULL_REGENERATION when structural_change is true", () => {
    const result = classifyRevisionScope(makeRequest({ structural_change: true }));
    expect(result.scope).toBe("FULL_REGENERATION");
    expect(result.memory_update_required).toBe(true);
  });

  it("returns FULL_REGENERATION when forbidden_word_violation_count > 10", () => {
    const result = classifyRevisionScope(makeRequest({ forbidden_word_violation_count: 11 }));
    expect(result.scope).toBe("FULL_REGENERATION");
    expect(result.reason).toContain("11");
  });

  it("scene_purpose_changed takes priority over structural_change", () => {
    const result = classifyRevisionScope(
      makeRequest({ scene_purpose_changed: true, structural_change: true })
    );
    expect(result.reason).toContain("Scene purpose");
  });

  // ── SECTION_REWRITE ────────────────────────────────────────────────
  it("returns SECTION_REWRITE for keyword 'rewrite'", () => {
    const result = classifyRevisionScope(makeRequest({ instruction: "Rewrite the opening" }));
    expect(result.scope).toBe("SECTION_REWRITE");
    expect(result.estimated_tokens).toBe(3500);
    expect(result.memory_update_required).toBe(true);
  });

  it.each(["redo", "change the scene", "rework", "overhaul", "restructure"])(
    "returns SECTION_REWRITE for keyword '%s'",
    (kw) => {
      const result = classifyRevisionScope(makeRequest({ instruction: `Please ${kw} this part` }));
      expect(result.scope).toBe("SECTION_REWRITE");
    }
  );

  it("returns SECTION_REWRITE for character behaviour keywords", () => {
    const result = classifyRevisionScope(
      makeRequest({ instruction: "Character should be more aggressive" })
    );
    expect(result.scope).toBe("SECTION_REWRITE");
  });

  it("returns SECTION_REWRITE when forbidden_word_violation_count >= 5", () => {
    const result = classifyRevisionScope(makeRequest({ forbidden_word_violation_count: 5 }));
    expect(result.scope).toBe("SECTION_REWRITE");
  });

  it("returns SECTION_REWRITE when forbidden_word_violation_count is exactly 5", () => {
    const result = classifyRevisionScope(makeRequest({ forbidden_word_violation_count: 5 }));
    expect(result.scope).toBe("SECTION_REWRITE");
    expect(result.reason).toContain("5");
  });

  // ── PATCH ──────────────────────────────────────────────────────────
  it("returns PATCH for a simple instruction with no triggers", () => {
    const result = classifyRevisionScope(makeRequest());
    expect(result.scope).toBe("PATCH");
    expect(result.estimated_tokens).toBe(800);
    expect(result.memory_update_required).toBe(false);
  });

  it("returns PATCH when forbidden_word_violation_count is 4", () => {
    const result = classifyRevisionScope(makeRequest({ forbidden_word_violation_count: 4 }));
    expect(result.scope).toBe("PATCH");
  });

  it("returns PATCH for non-matching instruction", () => {
    const result = classifyRevisionScope(
      makeRequest({ instruction: "Change the word 'blue' to 'crimson'" })
    );
    expect(result.scope).toBe("PATCH");
  });

  // ── Edge: high violations override keyword detection ───────────────
  it("returns FULL_REGENERATION even if instruction has section keywords when violations > 10", () => {
    const result = classifyRevisionScope(
      makeRequest({ instruction: "Rewrite the scene", forbidden_word_violation_count: 15 })
    );
    expect(result.scope).toBe("FULL_REGENERATION");
  });
});
