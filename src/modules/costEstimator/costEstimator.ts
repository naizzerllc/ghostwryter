/**
 * Project Cost Estimator — S24
 * Pre-generation cost estimates and running actuals.
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface CostEstimate {
  estimated_total_usd: number;
  by_provider: {
    anthropic: number;
    google: number;
    openai: number;
  };
  by_phase: {
    generation: number;
    quality: number;
    revision: number;
  };
  per_chapter_average: number;
  chapter_count: number;
  revision_loops_assumed: number;
  estimated_at: string;
}

// ── Pricing (USD per 1M tokens, approximate) ────────────────────────────

const PRICING = {
  anthropic_sonnet_input: 3.0,
  anthropic_sonnet_output: 15.0,
  gemini_flash_input: 0.075,
  gemini_flash_output: 0.30,
  gemini_pro_input: 1.25,
  gemini_pro_output: 5.0,
  openai_gpt4o_input: 2.50,
  openai_gpt4o_output: 10.0,
};

function tokenCost(inputTokens: number, outputTokens: number, inputRate: number, outputRate: number): number {
  return (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Estimate total project cost based on chapter count.
 */
export function estimateProjectCost(chapterCount: number, revisionLoops = 1.3): CostEstimate {
  // Per chapter estimates (tokens)
  const GEN_INPUT = 3_000;
  const GEN_OUTPUT = 2_000;
  const QUALITY_FLASH_INPUT = 2_900;
  const QUALITY_FLASH_OUTPUT = 500;
  const QUALITY_FLASH_CALLS = 5;
  const QUALITY_OPENAI_INPUT = 2_300;
  const QUALITY_OPENAI_OUTPUT = 800;
  const QUALITY_CLAUDE_INPUT = 2_900;
  const QUALITY_CLAUDE_OUTPUT = 500;

  // Generation cost per chapter (Anthropic Sonnet)
  const genCostPerChapter = tokenCost(GEN_INPUT, GEN_OUTPUT, PRICING.anthropic_sonnet_input, PRICING.anthropic_sonnet_output);

  // Quality cost per chapter
  const flashCost = tokenCost(QUALITY_FLASH_INPUT, QUALITY_FLASH_OUTPUT, PRICING.gemini_flash_input, PRICING.gemini_flash_output) * QUALITY_FLASH_CALLS;
  const openaiCost = tokenCost(QUALITY_OPENAI_INPUT, QUALITY_OPENAI_OUTPUT, PRICING.openai_gpt4o_input, PRICING.openai_gpt4o_output);
  const claudeSecondaryCost = tokenCost(QUALITY_CLAUDE_INPUT, QUALITY_CLAUDE_OUTPUT, PRICING.anthropic_sonnet_input, PRICING.anthropic_sonnet_output);
  const qualityCostPerChapter = flashCost + openaiCost + claudeSecondaryCost;

  // Total per chapter with revisions
  const totalPerChapter = (genCostPerChapter + qualityCostPerChapter) * revisionLoops;

  const totalGeneration = genCostPerChapter * chapterCount * revisionLoops;
  const totalQuality = qualityCostPerChapter * chapterCount * revisionLoops;
  const revisionExtra = (genCostPerChapter + qualityCostPerChapter) * chapterCount * (revisionLoops - 1);

  // Provider breakdown
  const anthropicTotal = (genCostPerChapter + claudeSecondaryCost) * chapterCount * revisionLoops;
  const googleTotal = flashCost * chapterCount * revisionLoops;
  const openaiTotal = openaiCost * chapterCount * revisionLoops;

  return {
    estimated_total_usd: parseFloat((totalPerChapter * chapterCount).toFixed(4)),
    by_provider: {
      anthropic: parseFloat(anthropicTotal.toFixed(4)),
      google: parseFloat(googleTotal.toFixed(4)),
      openai: parseFloat(openaiTotal.toFixed(4)),
    },
    by_phase: {
      generation: parseFloat(totalGeneration.toFixed(4)),
      quality: parseFloat(totalQuality.toFixed(4)),
      revision: parseFloat(revisionExtra.toFixed(4)),
    },
    per_chapter_average: parseFloat(totalPerChapter.toFixed(4)),
    chapter_count: chapterCount,
    revision_loops_assumed: revisionLoops,
    estimated_at: new Date().toISOString(),
  };
}

/**
 * Rollercoaster Integrity Check — runs every 10 approved chapters.
 * Uses the S24 spec rules (slightly different thresholds from S12):
 * 1. No > 3 consecutive chapters with tension < 5
 * 2. No > 2 consecutive chapters with tension ≥ 8
 * 3. Every 8 Act 2 chapters must have 1 warmth chapter (4–6)
 * 4. Act 2 SD ≥ 1.2
 *
 * This delegates to the existing checkRollercoaster in tensionCurve.ts
 * which already implements these rules.
 */
export { checkRollercoaster as runRollercoasterIntegrityCheck } from "@/modules/dramaticArchitecture/tensionCurve";
