/**
 * Voice Register Anchor Injection + Token Budget Dry-Run Gate.
 * GHOSTLY v2.2 · Session 15
 *
 * Anchor Injection: Injects demonstration constructions from VOICE_REGISTER_ANCHORS.json
 * when freshness risk is elevated. REVELATION chapters always get chapter_ending_internal.
 *
 * Token Dry-Run: Runs a real brief assembly against actual project data before first generation.
 * Blocks generation if any tier exceeds ceiling.
 */

import ANCHORS from "@/constants/VOICE_REGISTER_ANCHORS.json";
import { ChapterOutlineRecord } from "@/modules/outline/outlineSystem";
import { assembleBrief, countTokens, type GenerationBrief } from "./briefingGenerator";

// ── Types ───────────────────────────────────────────────────────────────

export type FreshnessRiskFlag = "NORMAL" | "ELEVATED" | "HIGH";

export type MomentType =
  | "processing_unwanted_information"
  | "moving_under_dread"
  | "lying"
  | "registering_threat"
  | "observing_another_character"
  | "chapter_ending_internal";

export interface AnchorInjectionResult {
  active: boolean;
  injected_constructions: string[];
  moment_types_used: MomentType[];
  token_cost: number;
}

export interface TokenDryRunResult {
  status: "PASSED" | "FAILED";
  tier_breakdown: Array<{
    tier: number;
    label: string;
    budget: number;
    used: number;
    over: boolean;
  }>;
  total_tokens: number;
  total_budget: number;
  recommendations: string[];
  run_at: string;
}

// ── Moment Type Inference ──────────────────────────────────────────────

const SCENE_PURPOSE_TO_MOMENT: Record<string, MomentType[]> = {
  confront: ["registering_threat", "processing_unwanted_information"],
  discover: ["processing_unwanted_information", "chapter_ending_internal"],
  reveal: ["processing_unwanted_information", "chapter_ending_internal"],
  flee: ["moving_under_dread"],
  escape: ["moving_under_dread"],
  deceive: ["lying"],
  manipulate: ["lying", "observing_another_character"],
  investigate: ["observing_another_character"],
  observe: ["observing_another_character"],
  threaten: ["registering_threat"],
  interrogate: ["observing_another_character", "lying"],
};

function inferMomentTypes(chapter: ChapterOutlineRecord): MomentType[] {
  const purposeLower = chapter.scene_purpose.toLowerCase();
  const matched: MomentType[] = [];

  for (const [keyword, types] of Object.entries(SCENE_PURPOSE_TO_MOMENT)) {
    if (purposeLower.includes(keyword)) {
      for (const t of types) {
        if (!matched.includes(t)) matched.push(t);
      }
    }
  }

  // Default if nothing matched
  if (matched.length === 0) {
    matched.push("observing_another_character");
  }

  return matched;
}

function getConstructions(momentType: MomentType): string[] {
  const entry = (ANCHORS.moment_types as Record<string, { constructions: string[] }>)[momentType];
  return entry?.constructions ?? [];
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ── Public API ──────────────────────────────────────────────────────────

export function injectVoiceRegisterAnchors(
  chapter: ChapterOutlineRecord,
  freshnessRiskFlag: FreshnessRiskFlag
): AnchorInjectionResult {
  const isRevelation = chapter.hook_type === "REVELATION";
  const injected: string[] = [];
  const typesUsed: MomentType[] = [];

  // REVELATION chapters always get chapter_ending_internal
  if (isRevelation) {
    const endings = getConstructions("chapter_ending_internal");
    const picked = pickRandom(endings, 2);
    if (picked.length > 0) {
      injected.push(
        `The register for chapter-ending internal sounds like: ${picked.map(c => `"${c}"`).join(", ")}`
      );
      typesUsed.push("chapter_ending_internal");
    }
  }

  // Freshness-based injection
  if (freshnessRiskFlag === "ELEVATED") {
    const moments = inferMomentTypes(chapter);
    const primaryType = moments[0];
    const constructions = getConstructions(primaryType);
    const picked = pickRandom(constructions, 3);
    if (picked.length > 0) {
      injected.push(
        `The register for ${primaryType.replace(/_/g, " ")} sounds like: ${picked.map(c => `"${c}"`).join(", ")}`
      );
      if (!typesUsed.includes(primaryType)) typesUsed.push(primaryType);
    }
  } else if (freshnessRiskFlag === "HIGH") {
    const moments = inferMomentTypes(chapter);
    const typesToUse = moments.slice(0, 2);

    for (const momentType of typesToUse) {
      const constructions = getConstructions(momentType);
      const picked = pickRandom(constructions, 3);
      if (picked.length > 0) {
        injected.push(
          `The register for ${momentType.replace(/_/g, " ")} sounds like: ${picked.map(c => `"${c}"`).join(", ")}`
        );
        if (!typesUsed.includes(momentType)) typesUsed.push(momentType);
      }
    }
  }

  // If no injection triggered and not revelation
  if (injected.length === 0) {
    return { active: false, injected_constructions: [], moment_types_used: [], token_cost: 0 };
  }

  const fullText = injected.join("\n");
  const tokenCost = countTokens(fullText);

  return {
    active: true,
    injected_constructions: injected,
    moment_types_used: typesUsed,
    token_cost: tokenCost,
  };
}

// ── Token Budget Dry-Run Gate ──────────────────────────────────────────

const DRY_RUN_KEY = "ghostly_token_dry_run_status";

interface DryRunStatus {
  project_id: string;
  status: "PASSED" | "FAILED";
  run_at: string;
}

function getDryRunStatus(projectId: string): DryRunStatus | null {
  try {
    const raw = localStorage.getItem(DRY_RUN_KEY);
    if (!raw) return null;
    const parsed: DryRunStatus = JSON.parse(raw);
    return parsed.project_id === projectId ? parsed : null;
  } catch {
    return null;
  }
}

function saveDryRunStatus(status: DryRunStatus): void {
  localStorage.setItem(DRY_RUN_KEY, JSON.stringify(status));
}

/**
 * Runs a real context brief from actual imported project data (chapter 1).
 * Measures tier-by-tier token counts. Blocks generation if any tier over ceiling.
 */
export function runTokenDryRun(projectId: string): TokenDryRunResult {
  // Assemble a real brief for chapter 1
  const brief: GenerationBrief = assembleBrief(1, projectId);
  const recommendations: string[] = [];

  const tierBreakdown = brief.tiers.map(t => {
    const over = t.tier !== 4 && t.used > t.budget;
    if (over) {
      const excess = t.used - t.budget;
      recommendations.push(
        `Tier ${t.tier} (${t.label}) exceeds budget by ${excess}T. Reduce ${t.label.toLowerCase()} content or increase tier budget.`
      );
    }
    return {
      tier: t.tier,
      label: t.label,
      budget: t.budget,
      used: t.used,
      over,
    };
  });

  const anyOver = tierBreakdown.some(t => t.over);
  const status: "PASSED" | "FAILED" = anyOver ? "FAILED" : "PASSED";
  const runAt = new Date().toISOString();

  // Save status
  saveDryRunStatus({ project_id: projectId, status, run_at: runAt });

  return {
    status,
    tier_breakdown: tierBreakdown,
    total_tokens: brief.total_tokens,
    total_budget: brief.total_budget,
    recommendations,
    run_at: runAt,
  };
}

/**
 * Check if a dry run has passed for the given project.
 * Returns true if passed, false if failed or never run.
 */
export function isDryRunPassed(projectId: string): boolean {
  const status = getDryRunStatus(projectId);
  return status?.status === "PASSED";
}

/**
 * Check if a dry run needs to be run (never run for this project).
 */
export function isDryRunRequired(projectId: string): boolean {
  return getDryRunStatus(projectId) === null;
}
