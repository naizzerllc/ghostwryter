/**
 * Outline Import Diagnostic — chapter_outline_record batch validation + breadcrumb integrity checker.
 * GHOSTLY v2.2 · Prompt 02 MSG-5
 *
 * Validates a batch of chapter outlines against MIC v2.1 chapter_outline_record schema v2.8.
 * Checks breadcrumb integrity: hook continuity, timeline consistency, tension arc coherence.
 */

import type { ChapterOutlineRecord, HookType, OpeningType, ProtagonistDecisionType, ReaderInformationMode } from "../storyBibleImporter/types";

// ── Types ───────────────────────────────────────────────────────────────

export type BreadcrumbStatus = "INTACT" | "DEGRADED" | "BROKEN";

export interface BreadcrumbIssue {
  chapter: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface BreadcrumbIntegrityResult {
  status: BreadcrumbStatus;
  total_chapters: number;
  issues: BreadcrumbIssue[];
  timeline_ids: string[];
  tension_arc: { chapter: number; target: number }[];
  duplicate_chapters: number[];
  gap_chapters: number[];
  hook_distribution: Record<HookType, number>;
  decision_distribution: Record<ProtagonistDecisionType, number>;
}

export interface OutlineValidationEntry {
  chapter_number: number;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface OutlineBatchResult {
  total: number;
  valid: number;
  invalid: number;
  entries: OutlineValidationEntry[];
  breadcrumb_integrity: BreadcrumbIntegrityResult;
}

// ── Enum sets (MIC v2.1) ────────────────────────────────────────────────

const HOOK_TYPES: HookType[] = ["REVELATION", "THREAT", "DECISION", "THE_LIE", "NEW_QUESTION"];
const OPENING_TYPES: OpeningType[] = ["action_mid_scene", "sensory_disorientation", "dialogue_no_tag", "object_close_up"];
const DECISION_TYPES: ProtagonistDecisionType[] = ["active", "passive_justified", "forced"];
const INFO_MODES: ReaderInformationMode[] = ["dramatic_irony", "shared_discovery", "delayed_reveal"];

// ── Single chapter validation ───────────────────────────────────────────

function validateSingleOutline(
  ch: Record<string, unknown>,
  genreMode: string,
  revelationChapter: number,
): OutlineValidationEntry {
  const errors: string[] = [];
  const warnings: string[] = [];
  const chNum = typeof ch.chapter_number === "number" ? ch.chapter_number : -1;

  // Required number
  if (typeof ch.chapter_number !== "number" || ch.chapter_number < 1) {
    errors.push("chapter_number: required positive number");
  }

  // Required strings
  const reqStrings = ["timeline_id", "scene_purpose", "hook_seed", "opening_seed", "collision_specification", "permanent_change"];
  for (const f of reqStrings) {
    if (!ch[f] || typeof ch[f] !== "string") {
      errors.push(`${f}: required non-empty string`);
    }
  }

  // Enum checks
  if (!ch.hook_type || !HOOK_TYPES.includes(ch.hook_type as HookType)) {
    errors.push(`hook_type: must be one of ${HOOK_TYPES.join(", ")}`);
  }
  if (!ch.opening_type || !OPENING_TYPES.includes(ch.opening_type as OpeningType)) {
    errors.push(`opening_type: must be one of ${OPENING_TYPES.join(", ")}`);
  }
  if (!ch.protagonist_decision_type || !DECISION_TYPES.includes(ch.protagonist_decision_type as ProtagonistDecisionType)) {
    errors.push(`protagonist_decision_type: must be one of ${DECISION_TYPES.join(", ")}`);
  }
  if (!ch.reader_information_mode || !INFO_MODES.includes(ch.reader_information_mode as ReaderInformationMode)) {
    errors.push(`reader_information_mode: must be one of ${INFO_MODES.join(", ")}`);
  }

  // Tension score
  if (typeof ch.tension_score_target !== "number" || ch.tension_score_target < 1 || ch.tension_score_target > 10) {
    errors.push("tension_score_target: must be 1–10");
  }

  // narrator_deception_gesture: required for psych thriller pre-revelation
  if (genreMode === "psychological_thriller" && chNum < revelationChapter) {
    if (!ch.narrator_deception_gesture || typeof ch.narrator_deception_gesture !== "string") {
      errors.push("narrator_deception_gesture: required for psychological_thriller pre-revelation");
    }
  }

  // compulsion_floor_note warning
  if (typeof ch.tension_score_target === "number" && ch.tension_score_target < 5 && !ch.compulsion_floor_note) {
    warnings.push("compulsion_floor_note: recommended when tension < 5 to avoid hard veto");
  }

  // hook_seed specificity check (> 10 chars)
  if (typeof ch.hook_seed === "string" && ch.hook_seed.length < 10) {
    warnings.push("hook_seed: suspiciously short — must be specific image/detail, not generic");
  }

  return { chapter_number: chNum, valid: errors.length === 0, errors, warnings };
}

// ── Breadcrumb integrity checker ────────────────────────────────────────

function checkBreadcrumbIntegrity(chapters: ChapterOutlineRecord[]): BreadcrumbIntegrityResult {
  const issues: BreadcrumbIssue[] = [];
  const sorted = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);

  // Duplicate chapter numbers
  const seen = new Set<number>();
  const duplicates: number[] = [];
  for (const ch of sorted) {
    if (seen.has(ch.chapter_number)) duplicates.push(ch.chapter_number);
    seen.add(ch.chapter_number);
  }
  for (const d of duplicates) {
    issues.push({ chapter: d, field: "chapter_number", message: `Duplicate chapter number: ${d}`, severity: "error" });
  }

  // Gap detection
  const gaps: number[] = [];
  if (sorted.length > 1) {
    for (let i = 1; i < sorted.length; i++) {
      const expected = sorted[i - 1].chapter_number + 1;
      if (sorted[i].chapter_number !== expected) {
        for (let g = expected; g < sorted[i].chapter_number; g++) {
          gaps.push(g);
        }
      }
    }
  }
  for (const g of gaps) {
    issues.push({ chapter: g, field: "chapter_number", message: `Missing chapter ${g} in sequence`, severity: "warning" });
  }

  // Timeline consistency
  const timelineIds = [...new Set(sorted.map(ch => ch.timeline_id))];
  if (timelineIds.length > 3) {
    issues.push({ chapter: 0, field: "timeline_id", message: `${timelineIds.length} timeline strands detected — unusually high`, severity: "warning" });
  }

  // Tension arc — check for monotone flatness
  const tensionArc = sorted.map(ch => ({ chapter: ch.chapter_number, target: ch.tension_score_target }));
  if (tensionArc.length >= 3) {
    const allSame = tensionArc.every(t => t.target === tensionArc[0].target);
    if (allSame) {
      issues.push({ chapter: 0, field: "tension_score_target", message: "All chapters have identical tension — flat arc detected", severity: "warning" });
    }
    // Check final chapters aren't low tension
    const last = tensionArc[tensionArc.length - 1];
    if (last.target < 6) {
      issues.push({ chapter: last.chapter, field: "tension_score_target", message: `Final chapter tension is ${last.target} — expected high climax`, severity: "warning" });
    }
  }

  // Hook distribution
  const hookDist: Record<HookType, number> = { REVELATION: 0, THREAT: 0, DECISION: 0, THE_LIE: 0, NEW_QUESTION: 0 };
  for (const ch of sorted) {
    if (hookDist[ch.hook_type] !== undefined) hookDist[ch.hook_type]++;
  }
  // Check for single hook type dominance (>60%)
  const total = sorted.length;
  if (total >= 5) {
    for (const [type, count] of Object.entries(hookDist)) {
      if (count / total > 0.6) {
        issues.push({ chapter: 0, field: "hook_type", message: `${type} used in ${count}/${total} chapters (>${60}%) — low hook variety`, severity: "warning" });
      }
    }
  }

  // Decision distribution
  const decDist: Record<ProtagonistDecisionType, number> = { active: 0, passive_justified: 0, forced: 0 };
  for (const ch of sorted) {
    if (decDist[ch.protagonist_decision_type] !== undefined) decDist[ch.protagonist_decision_type]++;
  }
  // Warn if protagonist is never active
  if (total >= 3 && decDist.active === 0) {
    issues.push({ chapter: 0, field: "protagonist_decision_type", message: "No active protagonist decisions — risk of passive protagonist", severity: "warning" });
  }

  // Consecutive passive chapters
  let consecutivePassive = 0;
  for (const ch of sorted) {
    if (ch.protagonist_decision_type !== "active") {
      consecutivePassive++;
      if (consecutivePassive >= 3) {
        issues.push({ chapter: ch.chapter_number, field: "protagonist_decision_type", message: `${consecutivePassive} consecutive non-active decisions ending at ch ${ch.chapter_number}`, severity: "warning" });
        break;
      }
    } else {
      consecutivePassive = 0;
    }
  }

  // Status determination
  const errorCount = issues.filter(i => i.severity === "error").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;
  let status: BreadcrumbStatus = "INTACT";
  if (errorCount > 0) status = "BROKEN";
  else if (warningCount > 2) status = "DEGRADED";

  return {
    status,
    total_chapters: sorted.length,
    issues,
    timeline_ids: timelineIds,
    tension_arc: tensionArc,
    duplicate_chapters: duplicates,
    gap_chapters: gaps,
    hook_distribution: hookDist,
    decision_distribution: decDist,
  };
}

// ── Store ───────────────────────────────────────────────────────────────

interface OutlineDiagnosticStore {
  lastResult: OutlineBatchResult | null;
  listeners: Set<() => void>;
}

const store: OutlineDiagnosticStore = {
  lastResult: null,
  listeners: new Set(),
};

function notify() {
  store.listeners.forEach(fn => fn());
}

// ── Public API ──────────────────────────────────────────────────────────

export function validateOutlineBatch(
  chapters: Record<string, unknown>[],
  genreMode: string = "psychological_thriller",
  revelationChapter: number = 22,
): OutlineBatchResult {
  const entries: OutlineValidationEntry[] = chapters.map(ch =>
    validateSingleOutline(ch, genreMode, revelationChapter)
  );

  const validChapters: ChapterOutlineRecord[] = chapters
    .filter((_, i) => entries[i].valid)
    .map(ch => ch as unknown as ChapterOutlineRecord);

  const breadcrumbIntegrity = validChapters.length > 0
    ? checkBreadcrumbIntegrity(validChapters)
    : {
        status: "BROKEN" as BreadcrumbStatus,
        total_chapters: 0,
        issues: [{ chapter: 0, field: "batch", message: "No valid chapters to check", severity: "error" as const }],
        timeline_ids: [],
        tension_arc: [],
        duplicate_chapters: [],
        gap_chapters: [],
        hook_distribution: { REVELATION: 0, THREAT: 0, DECISION: 0, THE_LIE: 0, NEW_QUESTION: 0 },
        decision_distribution: { active: 0, passive_justified: 0, forced: 0 },
      };

  const result: OutlineBatchResult = {
    total: chapters.length,
    valid: entries.filter(e => e.valid).length,
    invalid: entries.filter(e => !e.valid).length,
    entries,
    breadcrumb_integrity: breadcrumbIntegrity,
  };

  store.lastResult = result;
  notify();
  return result;
}

export function getOutlineDiagnosticSnapshot() {
  return store;
}

export function subscribeOutlineDiagnostic(callback: () => void) {
  store.listeners.add(callback);
  return () => { store.listeners.delete(callback); };
}

// ── Window registration ─────────────────────────────────────────────────
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_outlineDiagnostic = {
    validateOutlineBatch,
    getOutlineDiagnosticSnapshot,
  };
}
