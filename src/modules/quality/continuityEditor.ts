/**
 * Continuity Editor — Fact consistency and subplot persistence.
 * GHOSTLY v2.2 · Session 20
 *
 * Checks: canonical facts, corpus baseline (every 15 chapters),
 * subplot persistence (Act 2).
 * Uses Gemini Flash via callWithFallback('continuity_check', ...) — NO Prose DNA.
 */

import { callWithFallback } from "@/api/llmRouter";
import { checkFact, getAllFacts, type CanonicalFact, type FactCheckResult } from "@/modules/canonicalFacts/canonicalFactsDB";
import { getAllSubplots, type SubplotRecord } from "@/modules/subplot/subplotRegistry";

// ── Types ───────────────────────────────────────────────────────────────

export type ContinuityFlagSeverity = "CRITICAL" | "WARNING" | "NOTE";

export interface ContinuityEditorFlag {
  code: string;
  severity: ContinuityFlagSeverity;
  message: string;
  instruction?: string;
}

export interface CanonicalFactsCheckResult {
  claims_checked: number;
  violations: Array<{
    claim: string;
    conflicting_fact: string;
    fact_id: string;
    severity: "CRITICAL";
  }>;
  consistent: boolean;
}

export interface CorpusBaselineCheckResult {
  ran: boolean;
  voice_drift_detected: boolean;
  drift_description: string;
  trigger_chapter: number;
}

export type SubplotPersistenceStatus = "ACTIVE" | "DORMANT" | "DARK";

export interface SubplotPersistenceEntry {
  subplot_id: string;
  subplot_description: string;
  status: SubplotPersistenceStatus;
  chapters_since_last_touch: number;
  act_2_touches: number;
}

export interface SubplotPersistenceCheckResult {
  ran: boolean;
  entries: SubplotPersistenceEntry[];
  dark_count: number;
  dormant_count: number;
}

export interface ContinuityEditorResult {
  chapter_number: number;
  canonical_facts_check: CanonicalFactsCheckResult;
  corpus_baseline_check: CorpusBaselineCheckResult;
  subplot_persistence_check: SubplotPersistenceCheckResult;
  flags: ContinuityEditorFlag[];
  score: number;
  continuity_veto: boolean;
}

// ── Canonical Facts Check (LLM-assisted claim extraction) ───────────────

async function extractClaims(chapterContent: string): Promise<string[]> {
  const prompt = `You are a continuity checker. Extract all factual claims from this chapter that could contradict established story facts. Focus on: character names, relationships, locations, timeline events, physical descriptions, backstory references.

Return ONLY a JSON array of claim strings. Each claim should be a single statement of fact.

Example: ["Sarah has brown eyes", "The house is on Oak Street", "Tom is Sarah's brother"]

--- CHAPTER CONTENT ---

${chapterContent}`;

  try {
    const response = await callWithFallback("continuity_check", prompt, {
      temperature: 0.1,
      max_tokens: 1500,
    });

    const text = response.content.trim();
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.filter(c => typeof c === "string");
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) return parsed.filter(c => typeof c === "string");
      }
    }
    return [];
  } catch (err) {
    console.warn("[ContinuityEditor] Claim extraction failed:", err);
    return [];
  }
}

function runCanonicalFactsCheck(
  claims: string[],
  chapterNumber: number,
): CanonicalFactsCheckResult {
  const violations: CanonicalFactsCheckResult["violations"] = [];

  for (const claim of claims) {
    const result: FactCheckResult = checkFact(claim, chapterNumber);
    if (!result.consistent && result.conflicting_facts.length > 0) {
      for (const cf of result.conflicting_facts) {
        violations.push({
          claim,
          conflicting_fact: cf.statement,
          fact_id: cf.fact_id,
          severity: "CRITICAL",
        });
      }
    }
  }

  return {
    claims_checked: claims.length,
    violations,
    consistent: violations.length === 0,
  };
}

// ── Corpus Baseline Check (every 15 chapters) ───────────────────────────

async function runCorpusBaselineCheck(
  chapterNumber: number,
  chapterContent: string,
): Promise<CorpusBaselineCheckResult> {
  const shouldRun = chapterNumber > 0 && chapterNumber % 15 === 0;

  if (!shouldRun) {
    return {
      ran: false,
      voice_drift_detected: false,
      drift_description: "",
      trigger_chapter: chapterNumber,
    };
  }

  const prompt = `You are a voice consistency analyst for a psychological thriller. Compare this chapter's protagonist narration voice against the clinical_dissociative register:
- Controlled, precise, slightly detached
- First person present tense
- Interiority through observation and physical response, not psychological labelling
- Short chapters, high compulsion

Has the voice drifted from this register? Look for:
- Increased warmth or emotional openness in narration
- Shift to past tense or third person leakage
- Direct psychological labelling replacing observed behaviour
- Loss of the dissociative distance

Return ONLY valid JSON:
{
  "voice_drift_detected": boolean,
  "drift_description": string
}

--- CHAPTER CONTENT ---

${chapterContent}`;

  try {
    const response = await callWithFallback("continuity_check", prompt, {
      temperature: 0.2,
      max_tokens: 500,
    });

    const text = response.content.trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { voice_drift_detected: false, drift_description: "" };
    }

    return {
      ran: true,
      voice_drift_detected: (parsed.voice_drift_detected as boolean) ?? false,
      drift_description: (parsed.drift_description as string) ?? "",
      trigger_chapter: chapterNumber,
    };
  } catch (err) {
    console.warn("[ContinuityEditor] Corpus baseline check failed:", err);
    return {
      ran: true,
      voice_drift_detected: false,
      drift_description: "Check failed — manual review recommended",
      trigger_chapter: chapterNumber,
    };
  }
}

// ── Subplot Persistence Check (Act 2 only) ──────────────────────────────

function runSubplotPersistenceCheck(
  currentChapter: number,
  act: number,
): SubplotPersistenceCheckResult {
  if (act !== 2) {
    return { ran: false, entries: [], dark_count: 0, dormant_count: 0 };
  }

  const subplots = getAllSubplots();
  const entries: SubplotPersistenceEntry[] = [];
  let darkCount = 0;
  let dormantCount = 0;

  for (const sp of subplots) {
    if (currentChapter < sp.introduced_chapter) continue;
    if (currentChapter >= sp.resolution_chapter) continue;

    const allTouches = [...sp.act_2_touch_log];
    const lastTouch = allTouches.length > 0 ? Math.max(...allTouches) : sp.introduced_chapter;
    const chaptersSinceTouch = currentChapter - lastTouch;

    let status: SubplotPersistenceStatus;
    if (chaptersSinceTouch > 20 || (sp.act_2_touch_log.length === 0 && currentChapter - sp.introduced_chapter > 10)) {
      status = "DARK";
      darkCount++;
    } else if (chaptersSinceTouch >= 11) {
      status = "DORMANT";
      dormantCount++;
    } else {
      status = "ACTIVE";
    }

    entries.push({
      subplot_id: sp.subplot_id,
      subplot_description: sp.subplot_description,
      status,
      chapters_since_last_touch: chaptersSinceTouch,
      act_2_touches: sp.act_2_touch_log.length,
    });
  }

  return { ran: true, entries, dark_count: darkCount, dormant_count: dormantCount };
}

// ── Main Function ───────────────────────────────────────────────────────

export interface ContinuityEditorInput {
  chapterNumber: number;
  chapterContent: string;
  act: number;
}

export async function runContinuityEditor(
  input: ContinuityEditorInput
): Promise<ContinuityEditorResult> {
  const flags: ContinuityEditorFlag[] = [];

  // 1. Extract claims and check against canonical facts
  const claims = await extractClaims(input.chapterContent);
  const canonicalFactsCheck = runCanonicalFactsCheck(claims, input.chapterNumber);

  for (const v of canonicalFactsCheck.violations) {
    flags.push({
      code: "CONTINUITY_CRITICAL",
      severity: "CRITICAL",
      message: `Fact contradiction: "${v.claim}" conflicts with canonical fact "${v.conflicting_fact}" (${v.fact_id})`,
      instruction: "This chapter contradicts an established canonical fact. The contradiction must be resolved before approval.",
    });
  }

  // 2. Corpus baseline check (every 15 chapters)
  const corpusBaselineCheck = await runCorpusBaselineCheck(input.chapterNumber, input.chapterContent);

  if (corpusBaselineCheck.voice_drift_detected) {
    flags.push({
      code: "VOICE_DRIFT",
      severity: "WARNING",
      message: `Voice drift detected at Chapter ${input.chapterNumber}: ${corpusBaselineCheck.drift_description}`,
      instruction: "Flag affected chapters for human editorial review. Re-evaluate voice register against corpus benchmarks.",
    });
  }

  // 3. Subplot persistence check (Act 2 only)
  const subplotPersistenceCheck = runSubplotPersistenceCheck(input.chapterNumber, input.act);

  for (const entry of subplotPersistenceCheck.entries) {
    if (entry.status === "DARK") {
      flags.push({
        code: "SUBPLOT_DARK",
        severity: "WARNING",
        message: `Subplot "${entry.subplot_description}" (${entry.subplot_id}) has gone DARK — ${entry.chapters_since_last_touch} chapters since last touch, ${entry.act_2_touches} Act 2 touches.`,
        instruction: "This subplot has been absent too long. The reader has forgotten it. Either touch it in the next 2 chapters or formally close it.",
      });
    } else if (entry.status === "DORMANT") {
      flags.push({
        code: "SUBPLOT_DORMANT",
        severity: "NOTE",
        message: `Subplot "${entry.subplot_description}" (${entry.subplot_id}) is DORMANT — ${entry.chapters_since_last_touch} chapters since last touch.`,
      });
    }
  }

  // ── Score ──
  const continuityVeto = canonicalFactsCheck.violations.length > 0;
  let score = 10;

  if (continuityVeto) score -= 4;
  if (corpusBaselineCheck.voice_drift_detected) score -= 1.5;
  score -= subplotPersistenceCheck.dark_count * 1.0;
  score -= subplotPersistenceCheck.dormant_count * 0.3;

  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));

  return {
    chapter_number: input.chapterNumber,
    canonical_facts_check: canonicalFactsCheck,
    corpus_baseline_check: corpusBaselineCheck,
    subplot_persistence_check: subplotPersistenceCheck,
    flags,
    score,
    continuity_veto: continuityVeto,
  };
}

// ── Console exposure ────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_continuityEditor = {
    runContinuityEditor,
  };
}
