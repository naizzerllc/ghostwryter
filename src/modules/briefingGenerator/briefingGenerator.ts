/**
 * Briefing Generator — Assembles 4-tier context for generation calls.
 * GHOSTLY v2.2 · Session 14
 *
 * Tier 0 (800T, immovable): Prose DNA runtime
 * Tier 1 (1,200T / 1,000T if series): Style Layer + active clocks + session memory
 * Tier 2 (2,000T, relevance-scored): Character context + scene brief
 * Tier 3 (1,500T, sub-budgeted): Continuity bridge from previous chapters
 * Tier 4 (4,500T): Output headroom — reserved for generation
 *
 * Total ceiling: 10,000T. Assembled brief must verify total ≤ 10,000T.
 */

import { PROSE_DNA_RUNTIME } from "@/constants/PROSE_DNA_RUNTIME";
import { getActiveClocksForChapter } from "@/modules/dramaticArchitecture/clockRegistry";
import { getAllCharacters } from "@/modules/characterDB/characterDB";
import type { ContradictionMatrix } from "@/modules/characterDB/types";
import { getChapter, getAllChapters } from "@/modules/outline/outlineSystem";
import { getLivingState } from "@/modules/livingState/livingState";
import { getSeriesContext } from "@/modules/seriesMemory/seriesMemory";
import { scoreCharacterRelevance } from "./relevanceScorer";
import {
  getAnnotationsForBriefInjection,
  buildAnnotationBriefInjection,
  markAnnotationsInjected,
} from "@/modules/editorial/editorialAnnotation";

// ── Types ───────────────────────────────────────────────────────────────

export interface TierBudget {
  tier: number;
  label: string;
  budget: number;
  used: number;
  content: string;
}

export interface BriefingWarning {
  type: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
  chapter_number: number;
  recommendation: string;
}

export interface GenerationBrief {
  chapter_number: number;
  project_id: string;
  tiers: TierBudget[];
  total_tokens: number;
  total_budget: number;
  over_budget: boolean;
  budget_warnings: string[];
  truncation_log: string[];
  proximity_gap: string | null;
  warnings: BriefingWarning[];
  assembled_at: string;
}

// ── Token Counting ──────────────────────────────────────────────────────

export function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

// ── Contradiction Core Builders ─────────────────────────────────────────

function buildContradictionCore(name: string, roleLabel: string, cm?: ContradictionMatrix): string | null {
  if (!cm) return null;
  const lines: string[] = [`${roleLabel} CONTRADICTION CORE:`];

  if (cm.behavioural?.stated_belief && cm.behavioural?.actual_behaviour) {
    lines.push(`${name} believes ${cm.behavioural.stated_belief} — ${cm.behavioural.actual_behaviour}.`);
    if (cm.behavioural.blind_spot) {
      lines.push("She cannot see this contradiction. The reader will.");
    }
  }

  if (cm.moral?.stated_principle && cm.moral?.collapse_condition) {
    lines.push(`She holds: ${cm.moral.stated_principle} — it collapses when ${cm.moral.collapse_condition}.`);
  }
  if (cm.moral?.guilt_residue) {
    lines.push(`Guilt residue: ${cm.moral.guilt_residue}`);
  }

  if (cm.historical?.past_action && cm.historical?.self_narrative) {
    lines.push(`She did: ${cm.historical.past_action}`);
    lines.push(`She tells herself: ${cm.historical.self_narrative}`);
    if (cm.historical?.gap) {
      lines.push(`The gap: ${cm.historical.gap}`);
    }
  }

  if (cm.competence?.exceptional_at && cm.competence?.humiliated_by) {
    lines.push(`Exceptional at: ${cm.competence.exceptional_at}`);
    lines.push(`Cannot: ${cm.competence.humiliated_by}`);
  }

  return lines.length > 1 ? lines.join("\n") : null;
}

function buildSupportingContradictionNote(name: string, cm: ContradictionMatrix): string | null {
  const lines: string[] = [`${name} (contradiction note):`];

  if (cm.historical?.past_action) {
    lines.push(cm.historical.past_action);
  }
  if (cm.moral?.stated_principle && cm.moral?.collapse_condition) {
    lines.push(`Holds: ${cm.moral.stated_principle} — collapses when ${cm.moral.collapse_condition}.`);
  } else if (cm.behavioural?.stated_belief) {
    lines.push(`${cm.behavioural.stated_belief} — ${cm.behavioural.actual_behaviour}.`);
  }

  return lines.length > 1 ? lines.join(" ") : null;
}

// ── Tier Builders ───────────────────────────────────────────────────────

function buildTier0(): string {
  return PROSE_DNA_RUNTIME;
}

function buildTier1(chapterNumber: number, projectId: string, seriesBudget: number): string {
  const parts: string[] = [];

  // Active clocks
  const clocks = getActiveClocksForChapter(chapterNumber);
  if (clocks.length > 0) {
    const clockSummary = clocks
      .map(c => `[${c.type}] ${c.name}: intensity ${c.current_intensity}/10`)
      .join("\n");
    parts.push(`ACTIVE CLOCKS (${clocks.length}):\n${clockSummary}`);
  }

  // Living state emotional context
  const livingState = getLivingState(projectId);
  if (livingState.emotional_state_at_chapter_end) {
    parts.push(`EMOTIONAL STATE: ${livingState.emotional_state_at_chapter_end}`);
  }

  // Series memory if active
  const seriesCtx = getSeriesContext(projectId);
  if (seriesCtx.active && seriesCtx.previous_titles.length > 0) {
    const seriesSummary = seriesCtx.previous_titles
      .map(t => `Book ${t.sequence_number} (${t.title_name}): ${t.protagonist_arc_resolution.slice(0, 200)}`)
      .join("\n");
    parts.push(`SERIES MEMORY:\n${seriesSummary}`);
  }

  // Contradiction Core — protagonist and antagonist (~70T each)
  const allChars = getAllCharacters();
  const protagonist = allChars.find(c => c.role === "protagonist");
  const antagonist = allChars.find(c => c.role === "antagonist");

  const protContradiction = protagonist ? buildContradictionCore(protagonist.name, "PROTAGONIST", protagonist.contradiction_matrix as ContradictionMatrix | undefined) : null;
  if (protContradiction) parts.push(protContradiction);

  const antContradiction = antagonist ? buildContradictionCore(antagonist.name, "ANTAGONIST", antagonist.contradiction_matrix as ContradictionMatrix | undefined) : null;
  if (antContradiction) parts.push(antContradiction);

  return truncateToTokens(parts.join("\n\n"), seriesBudget);
}

function buildTier2(
  chapterNumber: number,
  projectId: string,
  budget: number
): { content: string; truncated: string[] } {
  const chapterOutline = getChapter(chapterNumber);
  const livingState = getLivingState(projectId);
  const allCharacters = getAllCharacters();
  const truncated: string[] = [];

  if (allCharacters.length === 0 || !chapterOutline) {
    return { content: "", truncated };
  }

  // Score and rank characters
  const scored = allCharacters
    .map(char => ({
      character: char,
      score: scoreCharacterRelevance(char, chapterOutline, livingState),
    }))
    .sort((a, b) => b.score - a.score);

  const parts: string[] = [];
  let usedTokens = 0;

  for (const { character, score } of scored) {
    const entry = `[${character.role.toUpperCase()}] ${character.name} (relevance: ${score}/10)
Wound: ${character.wound} | Flaw: ${character.flaw}
Want: ${character.want} | Need: ${character.need}
Voice: ${character.compressed_voice_dna.slice(0, 200)}
Goal: ${character.external_goal} | Desire: ${character.internal_desire}`;

    const entryTokens = countTokens(entry);

    // Supporting character contradiction note (Tier 2)
    const cm = character.contradiction_matrix as ContradictionMatrix | undefined;
    if (cm && character.role !== "protagonist" && character.role !== "antagonist") {
      const contradictionNote = buildSupportingContradictionNote(character.name, cm);
      if (contradictionNote) {
        const noteTokens = countTokens(contradictionNote);
        if (usedTokens + entryTokens + noteTokens <= budget) {
          parts.push(entry + "\n" + contradictionNote);
          usedTokens += entryTokens + noteTokens;
          continue;
        }
      }
    }

    if (usedTokens + entryTokens > budget) {
      truncated.push(character.name);
      continue;
    }

    parts.push(entry);
    usedTokens += entryTokens;
  }

  // Append scene brief context
  if (chapterOutline) {
    const sceneBrief = `SCENE PURPOSE: ${chapterOutline.scene_purpose}
HOOK: ${chapterOutline.hook_type} — ${chapterOutline.hook_seed}
OPENING: ${chapterOutline.opening_type} — ${chapterOutline.opening_seed}
TENSION TARGET: ${chapterOutline.tension_score_target}/10
COLLISION: ${chapterOutline.collision_specification}
PERMANENT CHANGE: ${chapterOutline.permanent_change}`;

    const briefTokens = countTokens(sceneBrief);
    if (usedTokens + briefTokens <= budget) {
      parts.push(sceneBrief);
    }
  }

  return { content: parts.join("\n\n"), truncated };
}

function buildTier3(chapterNumber: number): string {
  const allChapters = getAllChapters();
  const parts: string[] = [];

  // Sub-budgets
  const subBudgets: Array<{ offset: number; budget: number; label: string }> = [
    { offset: 1, budget: 600, label: "last_chapter_summary" },
    { offset: 2, budget: 400, label: "chapter_n-2" },
    { offset: 3, budget: 300, label: "chapter_n-3" },
  ];

  for (const { offset, budget, label } of subBudgets) {
    const prevNum = chapterNumber - offset;
    const prevChapter = allChapters.find(c => c.chapter_number === prevNum);
    if (prevChapter) {
      const summary = `Ch${prevNum} (${label}): Purpose: ${prevChapter.scene_purpose} | Hook: ${prevChapter.hook_type} — ${prevChapter.hook_seed} | Change: ${prevChapter.permanent_change}`;
      parts.push(truncateToTokens(summary, budget));
    }
  }

  // Act 1 anchor slot (from Chapter 30 onward)
  if (chapterNumber >= 30) {
    const act1Chapters = allChapters.filter(c => c.act === 1);
    if (act1Chapters.length > 0) {
      const anchorSummary = `ACT 1 ANCHOR: ${act1Chapters.length} chapters. Key purposes: ${act1Chapters.slice(0, 3).map(c => c.scene_purpose).join(" | ")}`;
      parts.push(truncateToTokens(anchorSummary, 200));
    }
  }

  return parts.join("\n\n");
}

// ── Main Assembly ───────────────────────────────────────────────────────

export function assembleBrief(chapterNumber: number, projectId: string): GenerationBrief {
  const warnings: string[] = [];
  const truncationLog: string[] = [];
  const briefingWarnings: BriefingWarning[] = [];

  // Determine series budget adjustment
  const seriesCtx = getSeriesContext(projectId);
  const tier1Budget = seriesCtx.active ? 1000 : 1200;

  // Build all tiers
  const tier0Content = buildTier0();
  const tier1Content = buildTier1(chapterNumber, projectId, tier1Budget);
  const { content: tier2Content, truncated: tier2Truncated } = buildTier2(chapterNumber, projectId, 2000);
  const tier3Content = buildTier3(chapterNumber);

  // GAP3 — Editorial annotation injection into Tier 2 (synchronous, from localStorage)
  const pendingAnnotations = getAnnotationsForBriefInjection(chapterNumber);
  let annotationInjection = "";
  for (const ann of pendingAnnotations) {
    if (ann.annotation_text && ann.annotation_target) {
      annotationInjection += `\n\n## EDITORIAL CALIBRATION NOTE — carry forward from Chapter ${ann.annotation_chapter}\n\nThe platform owner reviewed Chapter ${ann.annotation_chapter} and noted:\n"${ann.annotation_text}"\n\nTarget area: ${ann.annotation_target}\nSignificance: ${ann.annotation_severity}\n\nAddress this observation in the current chapter's generation.`;
    }
  }
  const tier2WithAnnotations = annotationInjection ? tier2Content + annotationInjection : tier2Content;
  if (pendingAnnotations.length > 0) {
    markAnnotationsInjected(pendingAnnotations, chapterNumber);
    console.log(`[BriefingGenerator] Injected ${pendingAnnotations.length} editorial annotation(s) into chapter ${chapterNumber} brief`);
  }

  if (tier2Truncated.length > 0) {
    truncationLog.push(`Characters truncated from Tier 2: ${tier2Truncated.join(", ")}`);
  }

  // PROXIMITY TENSION — S24B
  const chapterOutline = getChapter(chapterNumber);
  const proximityGap: string | null = (chapterOutline as Record<string, unknown>)?.proximity_gap as string | null ?? null;
  const tensionTarget = chapterOutline?.tension_score_target ?? 0;

  if (tensionTarget >= 7 && !proximityGap) {
    const warning: BriefingWarning = {
      type: 'PROXIMITY_ABSENT',
      severity: 'WARNING',
      message: `Chapter ${chapterNumber}: tension_score_target is ${tensionTarget} but proximity_gap is not specified. Consider adding a forward movement imperative to the scene brief — the gap between where the character is and where they need to be. This is a quality signal, not a block.`,
      chapter_number: chapterNumber,
      recommendation: 'Add proximity_gap to the chapter outline record or let the briefing generator derive one from the scene purpose and clock state.'
    };
    briefingWarnings.push(warning);
    console.warn(`[GHOSTLY PROXIMITY_ABSENT] ${warning.message}`);
  }

  const tiers: TierBudget[] = [
    { tier: 0, label: "Prose DNA", budget: 800, used: countTokens(tier0Content), content: tier0Content },
    { tier: 1, label: "Style + Clocks + Session", budget: tier1Budget, used: countTokens(tier1Content), content: tier1Content },
    { tier: 2, label: "Characters + Scene Brief", budget: 2000, used: countTokens(tier2WithAnnotations), content: tier2WithAnnotations },
    { tier: 3, label: "Continuity Bridge", budget: 1500, used: countTokens(tier3Content), content: tier3Content },
    { tier: 4, label: "Output Headroom", budget: 4500, used: 0, content: "" },
  ];

  const totalUsed = tiers.reduce((sum, t) => sum + t.used, 0);
  const totalBudget = 10000;

  // Budget warnings
  if (totalUsed > 8000) {
    warnings.push(`⚠ Brief token count (${totalUsed}) exceeds 8,000T warning threshold`);
  }
  if (totalUsed > totalBudget) {
    warnings.push(`🛑 Brief token count (${totalUsed}) exceeds 10,000T ceiling — generation blocked`);
  }

  // Check individual tier overruns
  for (const tier of tiers) {
    if (tier.used > tier.budget && tier.tier !== 4) {
      warnings.push(`Tier ${tier.tier} (${tier.label}) over budget: ${tier.used}/${tier.budget}T`);
    }
  }

  return {
    chapter_number: chapterNumber,
    project_id: projectId,
    tiers,
    total_tokens: totalUsed,
    total_budget: totalBudget,
    over_budget: totalUsed > totalBudget,
    budget_warnings: warnings,
    truncation_log: truncationLog,
    proximity_gap: proximityGap,
    warnings: briefingWarnings,
    assembled_at: new Date().toISOString(),
  };
}

/**
 * GAP3 — Async enrichment: replaces the synchronous annotation injection with
 * a Gemini Flash-derived instruction for higher quality calibration notes.
 * Call after assembleBrief when async context is available.
 */
export async function enrichBriefWithDerivedInstructions(
  brief: GenerationBrief,
  chapterNumber: number,
): Promise<GenerationBrief> {
  const annotations = getAnnotationsForBriefInjection(chapterNumber);
  if (annotations.length === 0) return brief;

  const injections: string[] = [];
  for (const ann of annotations) {
    const injection = await buildAnnotationBriefInjection(ann);
    if (injection) injections.push(injection);
  }

  if (injections.length === 0) return brief;

  const tier2 = brief.tiers.find(t => t.tier === 2);
  if (tier2) {
    const enrichedContent = tier2.content + "\n\n" + injections.join("\n\n");
    tier2.content = enrichedContent;
    tier2.used = countTokens(enrichedContent);
  }

  // Recalculate totals
  const totalUsed = brief.tiers.reduce((sum, t) => sum + t.used, 0);
  brief.total_tokens = totalUsed;
  brief.over_budget = totalUsed > brief.total_budget;

  return brief;
}
