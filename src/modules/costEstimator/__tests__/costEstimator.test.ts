import { describe, it, expect } from "vitest";
import { estimateProjectCost } from "../costEstimator";

describe("costEstimator", () => {
  it("returns structured estimate with all fields", () => {
    const est = estimateProjectCost(30);
    expect(est.chapter_count).toBe(30);
    expect(est.revision_loops_assumed).toBe(1.3);
    expect(est.estimated_total_usd).toBeGreaterThan(0);
    expect(est.per_chapter_average).toBeGreaterThan(0);
    expect(est.estimated_at).toBeTruthy();
  });

  it("by_provider sums approximately to total", () => {
    const est = estimateProjectCost(10);
    const providerSum = est.by_provider.anthropic + est.by_provider.google + est.by_provider.openai;
    expect(Math.abs(providerSum - est.estimated_total_usd)).toBeLessThan(0.01);
  });

  it("by_phase generation + quality approximately equals total (revision is subset)", () => {
    const est = estimateProjectCost(10, 1.0); // no revisions
    const phaseSum = est.by_phase.generation + est.by_phase.quality;
    expect(Math.abs(phaseSum - est.estimated_total_usd)).toBeLessThan(0.01);
    expect(est.by_phase.revision).toBeCloseTo(0, 4);
  });

  it("scales linearly with chapter count", () => {
    const est10 = estimateProjectCost(10);
    const est20 = estimateProjectCost(20);
    expect(Math.abs(est20.estimated_total_usd / est10.estimated_total_usd - 2)).toBeLessThan(0.01);
  });

  it("per_chapter_average matches total / chapter_count", () => {
    const est = estimateProjectCost(25);
    const calc = est.estimated_total_usd / est.chapter_count;
    expect(Math.abs(est.per_chapter_average - calc)).toBeLessThan(0.01);
  });

  it("accepts custom revision loop count", () => {
    const est1 = estimateProjectCost(10, 1.0);
    const est2 = estimateProjectCost(10, 2.0);
    expect(est2.estimated_total_usd).toBeGreaterThan(est1.estimated_total_usd);
    expect(est2.revision_loops_assumed).toBe(2.0);
  });

  it("anthropic is the largest provider cost", () => {
    const est = estimateProjectCost(30);
    expect(est.by_provider.anthropic).toBeGreaterThan(est.by_provider.google);
    expect(est.by_provider.anthropic).toBeGreaterThan(est.by_provider.openai);
  });

  it("handles 1 chapter edge case", () => {
    const est = estimateProjectCost(1);
    expect(est.chapter_count).toBe(1);
    expect(est.estimated_total_usd).toBeGreaterThan(0);
    expect(est.per_chapter_average).toBe(est.estimated_total_usd);
  });
});
