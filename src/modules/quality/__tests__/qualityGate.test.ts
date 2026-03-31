/**
 * Quality Gate Tests
 * GHOSTLY v2.2 · Session 22
 *
 * Tests: weighted composite scoring, 4 hard vetoes, generation floor,
 * revision escalation, compulsion curve records, revision brief builder.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runQualityGate,
  buildCompulsionCurveRecord,
  buildRevisionBrief,
  type QualityGateInput,
  type ModuleScores,
} from "../qualityGate";

function baseScores(overrides: Partial<ModuleScores> = {}): ModuleScores {
  return {
    reader_simulation: 9,
    developmental_editor: 9,
    anti_ai_detector: 9,
    line_editor: 9,
    dialogue_editor: 9,
    continuity_editor: 9,
    ...overrides,
  };
}

function baseInput(overrides: Partial<QualityGateInput> = {}): QualityGateInput {
  return {
    chapterNumber: 5,
    projectId: "test-proj",
    moduleScores: baseScores(),
    readerSimOptimismOffset: 0,
    compulsionRating: 8,
    hookCompulsionScore: 8,
    entryCompulsionScore: 7,
    tensionScoreTarget: 7,
    tensionScoreActual: 7,
    act: 1,
    twistIntegrityVerdict: "PROTECTED",
    continuityVeto: false,
    scenePurposeVeto: false,
    revisionCount: 0,
    isFirstGeneration: true,
    ...overrides,
  };
}

describe("QualityGate", () => {
  // ── Weighted composite ──

  it("calculates correct weighted composite with all 9s", () => {
    const result = runQualityGate(baseInput());
    // 9*0.32 + 9*0.20 + 9*0.18 + 9*0.15 + 9*0.10 + 9*0.05 = 9*1.0 = 9.0
    expect(result.weighted_score).toBe(9);
    expect(result.result).toBe("APPROVED");
    expect(result.action).toBe("APPROVED");
  });

  it("calculates correct weighted composite with mixed scores", () => {
    const result = runQualityGate(baseInput({
      moduleScores: baseScores({
        reader_simulation: 8,
        developmental_editor: 7,
        anti_ai_detector: 6,
        line_editor: 9,
        dialogue_editor: 8,
        continuity_editor: 10,
      }),
    }));
    // 8*0.32 + 7*0.20 + 6*0.18 + 9*0.15 + 8*0.10 + 10*0.05
    // = 2.56 + 1.40 + 1.08 + 1.35 + 0.80 + 0.50 = 7.69
    expect(result.weighted_score).toBeCloseTo(7.7, 1);
    expect(result.result).toBe("REVIEW");
  });

  it("applies reader_sim_optimism_offset before weighting", () => {
    const result = runQualityGate(baseInput({
      moduleScores: baseScores({ reader_simulation: 9 }),
      readerSimOptimismOffset: -0.8,
    }));
    expect(result.adjusted_reader_sim_score).toBeCloseTo(8.2, 1);
    // 8.2*0.32 + 9*0.20 + 9*0.18 + 9*0.15 + 9*0.10 + 9*0.05
    // = 2.624 + 1.80 + 1.62 + 1.35 + 0.90 + 0.45 = 8.744
    expect(result.weighted_score).toBeCloseTo(8.7, 1);
  });

  it("clamps adjusted reader sim score to 0-10", () => {
    const result = runQualityGate(baseInput({
      moduleScores: baseScores({ reader_simulation: 2 }),
      readerSimOptimismOffset: -5,
    }));
    expect(result.adjusted_reader_sim_score).toBe(0);
  });

  // ── Thresholds ──

  it("APPROVED when composite >= 8.0 and no vetoes", () => {
    const result = runQualityGate(baseInput());
    expect(result.result).toBe("APPROVED");
  });

  it("REVIEW when composite 7.0-7.9", () => {
    const result = runQualityGate(baseInput({
      moduleScores: baseScores({
        reader_simulation: 7,
        developmental_editor: 7,
        anti_ai_detector: 8,
        line_editor: 8,
        dialogue_editor: 8,
        continuity_editor: 8,
      }),
    }));
    expect(result.result).toBe("REVIEW");
  });

  it("REJECTED when composite < 7.0", () => {
    const result = runQualityGate(baseInput({
      moduleScores: baseScores({
        reader_simulation: 5,
        developmental_editor: 5,
        anti_ai_detector: 5,
        line_editor: 5,
        dialogue_editor: 5,
        continuity_editor: 5,
      }),
    }));
    expect(result.result).toBe("REJECTED");
  });

  // ── Hard vetoes ──

  it("veto 1: continuity_veto → REJECTED regardless of score", () => {
    const result = runQualityGate(baseInput({ continuityVeto: true }));
    expect(result.result).toBe("REJECTED");
    expect(result.any_veto_fired).toBe(true);
    expect(result.vetoes.continuity_veto).toBe(true);
    expect(result.flags.some(f => f.code === "VETO_CONTINUITY")).toBe(true);
  });

  it("veto 2: scene_purpose_veto → REJECTED + FULL_REGENERATION", () => {
    const result = runQualityGate(baseInput({ scenePurposeVeto: true }));
    expect(result.result).toBe("REJECTED");
    expect(result.action).toBe("FULL_REGENERATION");
    expect(result.flags.some(f => f.code === "VETO_SCENE_PURPOSE")).toBe(true);
  });

  it("veto 3: twist integrity BREACHED → REJECTED", () => {
    const result = runQualityGate(baseInput({ twistIntegrityVerdict: "BREACHED" }));
    expect(result.result).toBe("REJECTED");
    expect(result.vetoes.twist_integrity_veto).toBe(true);
    expect(result.flags.some(f => f.code === "VETO_TWIST_BREACHED")).toBe(true);
  });

  it("veto 4: compulsion < 5 without floor note → REJECTED", () => {
    const result = runQualityGate(baseInput({ compulsionRating: 3 }));
    expect(result.result).toBe("REJECTED");
    expect(result.vetoes.compulsion_veto).toBe(true);
    expect(result.flags.some(f => f.code === "VETO_COMPULSION")).toBe(true);
  });

  it("compulsion < 5 WITH floor note → no veto", () => {
    const result = runQualityGate(baseInput({
      compulsionRating: 3,
      compulsionFloorNote: "Intentionally low-tension chapter per outline.",
    }));
    expect(result.vetoes.compulsion_veto).toBe(false);
    expect(result.result).toBe("APPROVED"); // score still 9
  });

  it("twist AT_RISK does not trigger veto", () => {
    const result = runQualityGate(baseInput({ twistIntegrityVerdict: "AT_RISK" }));
    expect(result.vetoes.twist_integrity_veto).toBe(false);
    expect(result.result).toBe("APPROVED");
  });

  // ── Generation floor ──

  it("first generation below 4.0 → FULL_REGENERATION", () => {
    const result = runQualityGate(baseInput({
      isFirstGeneration: true,
      moduleScores: baseScores({
        reader_simulation: 3,
        developmental_editor: 3,
        anti_ai_detector: 3,
        line_editor: 3,
        dialogue_editor: 3,
        continuity_editor: 3,
      }),
    }));
    expect(result.action).toBe("FULL_REGENERATION");
    expect(result.flags.some(f => f.code === "GENERATION_FLOOR")).toBe(true);
  });

  it("non-first generation below 4.0 → REJECTED (not regeneration)", () => {
    const result = runQualityGate(baseInput({
      isFirstGeneration: false,
      moduleScores: baseScores({
        reader_simulation: 3,
        developmental_editor: 3,
        anti_ai_detector: 3,
        line_editor: 3,
        dialogue_editor: 3,
        continuity_editor: 3,
      }),
    }));
    expect(result.action).toBe("REJECTED");
  });

  // ── Revision escalation ──

  it("7 revisions + REJECTED → ESCALATION", () => {
    const result = runQualityGate(baseInput({
      revisionCount: 7,
      moduleScores: baseScores({
        reader_simulation: 5,
        developmental_editor: 5,
        anti_ai_detector: 5,
        line_editor: 5,
        dialogue_editor: 5,
        continuity_editor: 5,
      }),
    }));
    expect(result.action).toBe("ESCALATION");
    expect(result.max_revisions_reached).toBe(true);
    expect(result.flags.some(f => f.code === "REVISION_ESCALATION")).toBe(true);
  });

  it("7 revisions but APPROVED → no escalation", () => {
    const result = runQualityGate(baseInput({ revisionCount: 7 }));
    expect(result.action).toBe("APPROVED");
    expect(result.max_revisions_reached).toBe(true);
  });
});

describe("buildCompulsionCurveRecord", () => {
  it("builds record with correct fields", () => {
    const record = buildCompulsionCurveRecord(baseInput());
    expect(record.chapter_number).toBe(5);
    expect(record.tension_score_target).toBe(7);
    expect(record.tension_score_actual).toBe(7);
    expect(record.compulsion_score).toBe(8);
    expect(record.hook_compulsion_score).toBe(8);
    expect(record.entry_compulsion_score).toBe(7);
    expect(record.act).toBe(1);
    expect(record.approved_at).toBeDefined();
  });
});

describe("buildRevisionBrief", () => {
  it("identifies highest-impact module as primary", () => {
    const output = runQualityGate(baseInput({
      moduleScores: baseScores({
        reader_simulation: 4, // 6 gap × 0.32 weight = 1.92 impact (highest)
        line_editor: 5,       // 5 gap × 0.15 weight = 0.75
      }),
    }));
    const brief = buildRevisionBrief(output);
    const primary = brief.find(m => m.is_primary);
    expect(primary?.module_name).toBe("reader_simulation");
  });

  it("includes secondary modules below score 7", () => {
    const output = runQualityGate(baseInput({
      moduleScores: baseScores({
        reader_simulation: 4,
        line_editor: 5,
        dialogue_editor: 6,
      }),
    }));
    const brief = buildRevisionBrief(output);
    expect(brief.length).toBeGreaterThan(1);
    const secondaries = brief.filter(m => !m.is_primary);
    expect(secondaries.some(m => m.module_name === "line_editor")).toBe(true);
  });
});
