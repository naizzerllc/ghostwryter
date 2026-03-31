/**
 * Generation Core — Chapter generation pipeline.
 * GHOSTLY v2.2 · Session 17
 *
 * Full pipeline: brief assembly → validation → Anthropic call → post-processing.
 * Handles refusal detection, truncation detection, forbidden words check,
 * and knowledge boundary violations.
 */

import { callAnthropic, type AnthropicCachedResponse } from "@/api/llmRouter";
import { assembleBrief, type GenerationBrief } from "@/modules/briefingGenerator/briefingGenerator";
import { validateBrief, type BriefValidationResult } from "@/modules/briefingGenerator/briefValidationGate";
import { checkChapter, type ForbiddenWordsResult } from "@/utils/forbiddenWordsChecker";
import { checkBoundary, buildBoundaryMap, type BoundaryViolation } from "@/modules/knowledgeBoundary/knowledgeBoundaryMap";
import { getAllCharacters } from "@/modules/characterDB/characterDB";
import { getChapter, getAllChapters } from "@/modules/outline/outlineSystem";
import { githubStorage } from "@/storage/githubStorage";
import STYLE_PROFILES from "@/constants/STYLE_PROFILES.json";
import { TELL_SUPPRESSION_BLOCK, TELL_SUPPRESSION_CONFIG } from "@/constants/PROSE_DNA_RUNTIME";

// ── Types ───────────────────────────────────────────────────────────────

export type GenerationBlockReason =
  | "GITHUB_DISCONNECTED"
  | "CORPUS_NOT_APPROVED"
  | "BRIEF_VALIDATION_FAILED"
  | "REFUSAL_DETECTED"
  | "BOUNDARY_CRITICAL";

export interface GenerationBlock {
  blocked: true;
  reason: GenerationBlockReason;
  message: string;
  details?: string[];
}

export interface GenerationSuccess {
  blocked: false;
  content: string;
  model_used: string;
  tokens_used: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  refusal_detected: boolean;
  truncation_suspected: boolean;
  forbidden_word_violations: ForbiddenWordsResult;
  boundary_violations: BoundaryViolation[];
  brief: GenerationBrief;
  validation: BriefValidationResult;
  generation_config: {
    prose_dna_version: string;
    tell_suppression_active: boolean;
    tell_suppression_version: string;
  };
}

export type GenerationResult = GenerationBlock | GenerationSuccess;

export type RecoveryOption =
  | "REVISE_BRIEF"
  | "REFRAME_SCENE_PURPOSE"
  | "MANUAL_WRITE"
  | "ESCALATE";

export interface RefusalRecovery {
  chapter_number: number;
  options: RecoveryOption[];
  refusal_logged: boolean;
}

// ── Platform Failure Logging ────────────────────────────────────────────

interface PlatformFailureRecord {
  failure_type: string;
  detected_at: string;
  chapter_number: number;
  description: string;
  recovery_action: string;
  data_loss_risk: boolean;
}

const platformFailures: PlatformFailureRecord[] = [];

function logPlatformFailure(record: PlatformFailureRecord): void {
  platformFailures.push(record);
  console.warn(`[PLATFORM FAILURE] ${record.failure_type}: ${record.description}`);
}

export function getPlatformFailures(): PlatformFailureRecord[] {
  return [...platformFailures];
}

// ── Token Dry Run ───────────────────────────────────────────────────────

let tokenDryRunCompleted = false;

export function hasCompletedTokenDryRun(): boolean {
  return tokenDryRunCompleted;
}

export function markTokenDryRunComplete(): void {
  tokenDryRunCompleted = true;
}

// ── Style Layer Assembly ────────────────────────────────────────────────

function getStyleLayerContent(): string {
  const profile = (STYLE_PROFILES as Record<string, unknown>)["leila_rex_default"];
  if (!profile) return "";
  return `STYLE PROFILE: leila_rex_default\n${JSON.stringify(profile, null, 0)}`;
}

// ── Refusal Recovery ────────────────────────────────────────────────────

export function buildRefusalRecovery(chapterNumber: number): RefusalRecovery {
  logPlatformFailure({
    failure_type: "CONTENT_REFUSAL",
    detected_at: new Date().toISOString(),
    chapter_number: chapterNumber,
    description: `Content refusal detected during generation of chapter ${chapterNumber}`,
    recovery_action: "Surface recovery UI with 4 options",
    data_loss_risk: false,
  });

  return {
    chapter_number: chapterNumber,
    options: ["REVISE_BRIEF", "REFRAME_SCENE_PURPOSE", "MANUAL_WRITE", "ESCALATE"],
    refusal_logged: true,
  };
}

// ── Main Generation Function ────────────────────────────────────────────

/**
 * Generate a chapter through the full pipeline.
 *
 * 1. Check GitHub connected
 * 2. Check character corpus approval
 * 3. Assemble brief → validate
 * 4. Token dry-run (first generation only)
 * 5. Build two-block system prompt (static + dynamic)
 * 6. Call Anthropic via callAnthropic()
 * 7. Handle refusal / truncation
 * 8. Run forbidden words checker
 * 9. Run knowledge boundary check
 * 10. Store raw draft
 */
export async function generateChapter(
  chapterNumber: number,
  projectId: string,
): Promise<GenerationResult> {
  console.log(`[GenerationCore] Starting generation for chapter ${chapterNumber}, project ${projectId}`);

  // ── Step 1: GitHub connection check ───────────────────────────────
  githubStorage.init();
  if (!githubStorage.connected) {
    return {
      blocked: true,
      reason: "GITHUB_DISCONNECTED",
      message: "GitHub is not connected. Generation requires active GitHub storage.",
    };
  }

  // ── Step 2: Character corpus approval ─────────────────────────────
  const chapterOutline = getChapter(chapterNumber);
  const allCharacters = getAllCharacters();

  if (chapterOutline) {
    const chapterCharIds = (chapterOutline as { characters?: string[] }).characters ?? [];
    const unapproved = chapterCharIds.filter(charId => {
      const char = allCharacters.find(c => c.id === charId);
      return char && !char.corpus_approved;
    });

    if (unapproved.length > 0) {
      return {
        blocked: true,
        reason: "CORPUS_NOT_APPROVED",
        message: `Generation blocked: characters without corpus approval: ${unapproved.join(", ")}`,
        details: unapproved,
      };
    }
  }

  // ── Step 3: Assemble brief → validate ─────────────────────────────
  const brief = assembleBrief(chapterNumber, projectId);
  const validation = chapterOutline
    ? validateBrief(brief, chapterOutline)
    : { valid: true, errors: [] as string[], warnings: [] as string[], force_classification: "FORCE_MID" as const };

  if (!validation.valid && validation.errors.length > 0) {
    return {
      blocked: true,
      reason: "BRIEF_VALIDATION_FAILED",
      message: `Brief validation failed with ${validation.errors.length} error(s).`,
      details: validation.errors,
    };
  }

  // ── Step 4: Token dry-run (first generation only) ─────────────────
  if (!tokenDryRunCompleted) {
    console.log(`[GenerationCore] Token dry-run: brief total = ${brief.total_tokens}T / ${brief.total_budget}T budget`);
    if (brief.over_budget) {
      console.warn(`[GenerationCore] Token dry-run WARNING: Over budget by ${brief.total_tokens - brief.total_budget}T`);
    }
    markTokenDryRunComplete();
  }

  // ── Step 5: Build two-block system prompt ─────────────────────────
  // Static block: Prose DNA runtime (Tier 0) + Style Layer + Forbidden Words header
  // + Tell Suppression Block (GAP2 — cached, ~400T, invariant across chapters)
  const proseDnaTier = brief.tiers.find(t => t.tier === 0);
  const styleLayer = getStyleLayerContent();
  const forbiddenWordsHeader = "FORBIDDEN WORDS: Code-enforced post-generation. Do not self-censor — write naturally.";

  const staticBlock = [
    proseDnaTier?.content ?? "",
    styleLayer,
    forbiddenWordsHeader,
    TELL_SUPPRESSION_BLOCK,
  ].filter(Boolean).join("\n\n---\n\n");

  // Dynamic block: Assembled brief (Tiers 1–3)
  const dynamicTiers = brief.tiers.filter(t => t.tier > 0);
  const dynamicBlock = dynamicTiers.map(t => t.content).filter(Boolean).join("\n\n---\n\n");

  // ── Step 6: Call Anthropic ────────────────────────────────────────
  let response: AnthropicCachedResponse;
  try {
    response = await callAnthropic(
      "generation_protagonist",
      staticBlock,
      dynamicBlock,
      { max_tokens: 4096, temperature: 0.7 },
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logPlatformFailure({
      failure_type: "PROVIDER_OUTAGE",
      detected_at: new Date().toISOString(),
      chapter_number: chapterNumber,
      description: `Anthropic call failed: ${errMsg}`,
      recovery_action: "Retry or use fallback provider",
      data_loss_risk: false,
    });
    throw error;
  }

  // ── Step 7: Handle refusal / truncation ───────────────────────────
  if (response.refusal_detected) {
    // Log as CONTENT_REFUSAL — NOT a quality gate failure
    buildRefusalRecovery(chapterNumber);
    return {
      blocked: true,
      reason: "REFUSAL_DETECTED",
      message: "Content refusal detected. Use recovery options to proceed.",
      details: ["REVISE_BRIEF", "REFRAME_SCENE_PURPOSE", "MANUAL_WRITE", "ESCALATE"],
    };
  }

  const truncation_suspected = response.truncation_suspected;
  if (truncation_suspected) {
    console.warn(`[GenerationCore] Truncation suspected for chapter ${chapterNumber}. Mandatory human review required.`);
  }

  // ── Step 8: Forbidden words check ─────────────────────────────────
  const forbiddenWordViolations = checkChapter(response.content, String(chapterNumber));
  if (forbiddenWordViolations.hardBanCount > 0) {
    console.warn(`[GenerationCore] ${forbiddenWordViolations.hardBanCount} hard-ban violations in chapter ${chapterNumber}`);
  }

  // ── Step 9: Knowledge boundary check ──────────────────────────────
  const outline = { chapters: getAllChapters() };
  const boundaryCharacters = allCharacters.map(c => ({
    character_id: c.id,
    name: c.name,
    introduced_chapter: undefined as number | undefined,
  }));
  const boundaryMap = buildBoundaryMap(outline, boundaryCharacters);
  const boundaryViolations = checkBoundary(response.content, chapterNumber, boundaryMap);

  const criticalBoundary = boundaryViolations.filter(v => v.severity === "CRITICAL");
  if (criticalBoundary.length > 0) {
    console.error(`[GenerationCore] ${criticalBoundary.length} CRITICAL boundary violation(s) in chapter ${chapterNumber}`);
    return {
      blocked: true,
      reason: "BOUNDARY_CRITICAL",
      message: `${criticalBoundary.length} critical knowledge boundary violation(s) detected.`,
      details: criticalBoundary.map(v => v.message),
    };
  }

  // ── Step 10: Store raw draft ──────────────────────────────────────
  const draftPath = `story-data/${projectId}/chapters/${chapterNumber}/draft.md`;
  await githubStorage.saveFile(draftPath, response.content);
  console.log(`[GenerationCore] Raw draft saved to ${draftPath}`);

  return {
    blocked: false,
    content: response.content,
    model_used: response.model_used,
    tokens_used: response.tokens_used,
    cache_read_tokens: response.cache_read_tokens,
    cache_write_tokens: response.cache_write_tokens,
    refusal_detected: false,
    truncation_suspected,
    forbidden_word_violations: forbiddenWordViolations,
    boundary_violations: boundaryViolations,
    brief,
    validation,
  };
}
