/**
 * Outline Importer — v2.8 schema validation, misdirection map checks,
 * breadcrumb integrity, character extraction.
 * GHOSTLY v2.2 · S08
 */

import { githubStorage } from "@/storage/githubStorage";
import type { ChapterOutlineRecord, HookType } from "@/modules/storyBibleImporter/types";

// ── Types ───────────────────────────────────────────────────────────────

export type IssueSeverity = "ERROR" | "WARNING";
export type IssueCategory = "SCHEMA" | "MISDIRECTION" | "NARRATOR" | "HOOK" | "STRUCTURAL" | "BREADCRUMB";

export interface ValidationIssue {
  severity: IssueSeverity;
  category: IssueCategory;
  field: string;
  description: string;
  suggestedFix?: string;
}

export interface BreadcrumbIntegrityReport {
  phantom_harvests: { chapter: number; explanation: string }[];
  orphan_plants: { chapter: number; field: string }[];
  total_breadcrumbs: number;
  integrity_score: number;
  blocks_import: boolean;
}

export interface OutlineImportDiagnosticReport {
  schema_version_found: string | null;
  schema_version_valid: boolean;
  issues: ValidationIssue[];
  breadcrumb_report: BreadcrumbIntegrityReport | null;
  errors_count: number;
  warnings_count: number;
}

export interface OutlineImportResult {
  success: boolean;
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
  diagnostic_report: OutlineImportDiagnosticReport;
  chapters?: ChapterOutlineRecord[];
  characters_extracted?: ExtractedCharacter[];
}

export interface ExtractedCharacter {
  id: string;
  name: string;
  role: "protagonist" | "antagonist" | "supporting";
  source_chapter: number;
}

// ── Constants ───────────────────────────────────────────────────────────

const HOOK_TYPES: HookType[] = ["REVELATION", "THREAT", "DECISION", "THE_LIE", "NEW_QUESTION"];
const OPENING_TYPES = ["action_mid_scene", "sensory_disorientation", "dialogue_no_tag", "object_close_up"];
const DECISION_TYPES = ["active", "passive_justified", "forced"];
const INFO_MODES = ["dramatic_irony", "shared_discovery", "delayed_reveal"];

// ── Schema version validation ───────────────────────────────────────────

function validateSchemaVersion(data: Record<string, unknown>, issues: ValidationIssue[]): string | null {
  const version = data.schema_version as string | undefined;
  if (!version) {
    issues.push({
      severity: "ERROR",
      category: "SCHEMA",
      field: "schema_version",
      description: "Missing schema_version field",
      suggestedFix: "Add schema_version: '2.8' to the root of your outline JSON",
    });
    return null;
  }

  if (version === "2.8") return version;

  if (version === "2.7") {
    issues.push({
      severity: "WARNING",
      category: "SCHEMA",
      field: "schema_version",
      description: "Schema v2.7 detected — importing with warnings. v2.8 recommended.",
      suggestedFix: "Update to v2.8 to access all validation features (narrator_deception_gesture, hook_seed specificity).",
    });
    return version;
  }

  issues.push({
    severity: "ERROR",
    category: "SCHEMA",
    field: "schema_version",
    description: `Unsupported schema version: ${version}. Only v2.8 (and v2.7 with warnings) accepted.`,
    suggestedFix: "Upgrade your outline to schema v2.8",
  });
  return version;
}

// ── Chapter validation ──────────────────────────────────────────────────

function validateChapter(
  ch: Record<string, unknown>,
  index: number,
  genreMode: string,
  revelationChapter: number,
  issues: ValidationIssue[],
): boolean {
  const prefix = `chapters[${index}]`;
  let hasError = false;

  const addIssue = (severity: IssueSeverity, category: IssueCategory, field: string, description: string, suggestedFix?: string) => {
    issues.push({ severity, category, field: `${prefix}.${field}`, description, suggestedFix });
    if (severity === "ERROR") hasError = true;
  };

  // Required number
  if (typeof ch.chapter_number !== "number" || ch.chapter_number < 1) {
    addIssue("ERROR", "STRUCTURAL", "chapter_number", "Required positive number");
  }

  // Required strings
  for (const f of ["timeline_id", "scene_purpose", "hook_seed", "opening_seed", "collision_specification", "permanent_change"]) {
    if (!ch[f] || typeof ch[f] !== "string") {
      addIssue("ERROR", "STRUCTURAL", f, `Required non-empty string`);
    }
  }

  // Enum checks
  if (!ch.hook_type || !HOOK_TYPES.includes(ch.hook_type as HookType)) {
    addIssue("ERROR", "HOOK", "hook_type", `Must be one of: ${HOOK_TYPES.join(", ")}`);
  }
  if (!ch.opening_type || !OPENING_TYPES.includes(ch.opening_type as string)) {
    addIssue("ERROR", "STRUCTURAL", "opening_type", `Must be one of: ${OPENING_TYPES.join(", ")}`);
  }
  if (!ch.protagonist_decision_type || !DECISION_TYPES.includes(ch.protagonist_decision_type as string)) {
    addIssue("ERROR", "STRUCTURAL", "protagonist_decision_type", `Must be one of: ${DECISION_TYPES.join(", ")}`);
  }
  if (!ch.reader_information_mode || !INFO_MODES.includes(ch.reader_information_mode as string)) {
    addIssue("ERROR", "STRUCTURAL", "reader_information_mode", `Must be one of: ${INFO_MODES.join(", ")}`);
  }

  // Tension
  if (typeof ch.tension_score_target !== "number" || ch.tension_score_target < 1 || ch.tension_score_target > 10) {
    addIssue("ERROR", "STRUCTURAL", "tension_score_target", "Must be a number between 1 and 10");
  }

  // hook_seed specificity (> 5 words)
  if (typeof ch.hook_seed === "string") {
    const wordCount = ch.hook_seed.trim().split(/\s+/).length;
    if (wordCount <= 5) {
      addIssue("WARNING", "HOOK", "hook_seed", `Hook seed is only ${wordCount} words — must be specific image/detail, not generic`, "Expand with concrete sensory detail or specific action");
    }
  }

  // narrator_deception_gesture for psych thriller pre-revelation
  const chNum = ch.chapter_number as number;
  if (genreMode === "psychological_thriller" && chNum < revelationChapter) {
    if (!ch.narrator_deception_gesture || typeof ch.narrator_deception_gesture !== "string") {
      addIssue("WARNING", "NARRATOR", "narrator_deception_gesture", `Missing for psychological_thriller pre-revelation chapter ${chNum}`, "Add a specific narrator deception gesture for this chapter");
    }
  }

  // compulsion_floor_note warning
  if (typeof ch.tension_score_target === "number" && ch.tension_score_target < 5 && !ch.compulsion_floor_note) {
    addIssue("WARNING", "STRUCTURAL", "compulsion_floor_note", "Recommended when tension_score_target < 5 to avoid hard veto");
  }

  return !hasError;
}

// ── Misdirection map validation ─────────────────────────────────────────

function validateMisdirectionMap(
  data: Record<string, unknown>,
  chapters: Record<string, unknown>[],
  issues: ValidationIssue[],
): void {
  const mmap = data.misdirection_map as Record<string, unknown> | undefined;
  if (!mmap) return;

  // false_trail_sequence check (3 beats required)
  const act2 = mmap.act_2_entry as Record<string, unknown> | undefined;
  if (act2) {
    if (typeof act2.false_trail_intensifier === "string") {
      issues.push({
        severity: "WARNING",
        category: "MISDIRECTION",
        field: "misdirection_map.act_2_entry.false_trail_intensifier",
        description: "Old format detected: false_trail_intensifier (string). v2.8 requires false_trail_sequence (object with 3 beats).",
        suggestedFix: "Migrate to false_trail_sequence: { beat_1: '...', beat_2: '...', beat_3: '...' }",
      });
    }
    const fts = act2.false_trail_sequence as Record<string, unknown> | undefined;
    if (fts) {
      const beats = ["beat_1", "beat_2", "beat_3"];
      for (const b of beats) {
        if (!fts[b] || typeof fts[b] !== "string") {
          issues.push({
            severity: "ERROR",
            category: "MISDIRECTION",
            field: `misdirection_map.act_2_entry.false_trail_sequence.${b}`,
            description: `Missing or invalid ${b} in false_trail_sequence`,
            suggestedFix: `Add ${b} as a specific misdirection beat`,
          });
        }
      }
    }
  }

  // recontextualisation_list validation
  const recontList = mmap.recontextualisation_list as unknown[] | undefined;
  if (!recontList || !Array.isArray(recontList)) {
    issues.push({
      severity: "ERROR",
      category: "MISDIRECTION",
      field: "misdirection_map.recontextualisation_list",
      description: "Missing recontextualisation_list — required",
      suggestedFix: "Add recontextualisation_list with minimum 8 entries",
    });
    return;
  }

  if (recontList.length < 8) {
    issues.push({
      severity: "ERROR",
      category: "MISDIRECTION",
      field: "misdirection_map.recontextualisation_list",
      description: `Only ${recontList.length} recontextualisation entries — minimum 8 required`,
      suggestedFix: `Add ${8 - recontList.length} more recontextualisation entries`,
    });
  }

  // Validate each entry references a real chapter and is specific
  const chapterNumbers = new Set(chapters.map(c => c.chapter_number as number));
  for (let i = 0; i < recontList.length; i++) {
    const raw = recontList[i];
    if (typeof raw === "string") {
      if (raw.length < 10) {
        issues.push({
          severity: "WARNING",
          category: "MISDIRECTION",
          field: `misdirection_map.recontextualisation_list[${i}]`,
          description: "Entry too generic — must be specific (> 10 words)",
          suggestedFix: "Expand with concrete detail about what is recontextualised",
        });
      }
      continue;
    }
    const entry = raw as Record<string, unknown>;
    if (typeof entry?.chapter === "number" && !chapterNumbers.has(entry.chapter)) {
      issues.push({
        severity: "ERROR",
        category: "BREADCRUMB",
        field: `misdirection_map.recontextualisation_list[${i}].chapter`,
        description: `References chapter ${entry.chapter} which does not exist in outline`,
        suggestedFix: "Fix the chapter reference or add the missing chapter",
      });
    }
    if (typeof entry?.description === "string" && entry.description.split(/\s+/).length < 10) {
      issues.push({
        severity: "WARNING",
        category: "MISDIRECTION",
        field: `misdirection_map.recontextualisation_list[${i}].description`,
        description: "Entry too generic — must be specific",
      });
    }
  }
}

// ── Breadcrumb integrity ────────────────────────────────────────────────

function validateBreadcrumbs(
  data: Record<string, unknown>,
  chapters: Record<string, unknown>[],
): BreadcrumbIntegrityReport {
  const mmap = data.misdirection_map as Record<string, unknown> | undefined;
  const recontList = (mmap?.recontextualisation_list as unknown[]) ?? [];
  const chapterNumbers = new Set(chapters.map(c => c.chapter_number as number));

  const phantom_harvests: { chapter: number; explanation: string }[] = [];
  const orphan_plants: { chapter: number; field: string }[] = [];

  // Check recontextualisation entries reference real chapters
  for (const entry of recontList) {
    const e = entry as Record<string, unknown>;
    if (typeof e?.chapter === "number") {
      if (!chapterNumbers.has(e.chapter)) {
        phantom_harvests.push({
          chapter: e.chapter,
          explanation: `Recontextualisation references chapter ${e.chapter} which doesn't exist`,
        });
      }
    }
  }

  // Check chapters with misdirection weight have recontextualisation entries
  const referencedChapters = new Set(
    recontList
      .filter(e => typeof (e as Record<string, unknown>)?.chapter === "number")
      .map(e => (e as Record<string, unknown>).chapter as number)
  );

  for (const ch of chapters) {
    const chNum = ch.chapter_number as number;
    if (ch.carries_misdirection_weight && !referencedChapters.has(chNum)) {
      orphan_plants.push({ chapter: chNum, field: "carries_misdirection_weight" });
    }
  }

  const total = recontList.length;
  const phantomCount = phantom_harvests.length;
  const orphanCount = orphan_plants.length;
  const score = total > 0 ? Math.max(0, Math.round(100 * (1 - (phantomCount + orphanCount * 0.5) / total))) : 0;

  return {
    phantom_harvests,
    orphan_plants,
    total_breadcrumbs: total,
    integrity_score: score,
    blocks_import: phantom_harvests.length > 0 || total < 8,
  };
}

// ── Character extraction from outline ───────────────────────────────────

function extractCharacters(data: Record<string, unknown>): ExtractedCharacter[] {
  const chars: ExtractedCharacter[] = [];
  const characters = data.characters as Record<string, unknown>[] | undefined;
  if (!characters || !Array.isArray(characters)) return chars;

  for (const c of characters) {
    if (typeof c.name === "string" && typeof c.role === "string") {
      chars.push({
        id: (c.id as string) ?? c.name.toLowerCase().replace(/\s+/g, "_"),
        name: c.name,
        role: c.role as "protagonist" | "antagonist" | "supporting",
        source_chapter: (c.introduced_chapter as number) ?? 1,
      });
    }
  }
  return chars;
}

// ── Main import function ────────────────────────────────────────────────

export function importOutline(jsonString: string, projectId: string): OutlineImportResult {
  const issues: ValidationIssue[] = [];

  // Parse
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(jsonString);
  } catch (e) {
    const parseError: ValidationIssue = {
      severity: "ERROR",
      category: "SCHEMA",
      field: "root",
      description: `JSON parse error: ${(e as Error).message}`,
    };
    return {
      success: false,
      errors: [parseError],
      warnings: [],
      diagnostic_report: {
        schema_version_found: null,
        schema_version_valid: false,
        issues: [parseError],
        breadcrumb_report: null,
        errors_count: 1,
        warnings_count: 0,
      },
    };
  }

  // Schema version
  const schemaVersion = validateSchemaVersion(data, issues);
  const schemaValid = schemaVersion === "2.8" || schemaVersion === "2.7";

  // Project config
  const config = data.project_config as Record<string, unknown> | undefined;
  const genreMode = (config?.genre_mode as string) ?? "psychological_thriller";
  const revelationChapter = (config?.revelation_chapter as number) ?? 22;

  // Chapters
  const chaptersRaw = (data.chapters as Record<string, unknown>[]) ?? [];
  const validChapters: ChapterOutlineRecord[] = [];

  for (let i = 0; i < chaptersRaw.length; i++) {
    const valid = validateChapter(chaptersRaw[i], i, genreMode, revelationChapter, issues);
    if (valid) {
      validChapters.push(chaptersRaw[i] as unknown as ChapterOutlineRecord);
    }
  }

  // Misdirection map
  validateMisdirectionMap(data, chaptersRaw, issues);

  // Breadcrumb integrity
  const breadcrumbReport = validateBreadcrumbs(data, chaptersRaw);
  if (breadcrumbReport.blocks_import) {
    for (const ph of breadcrumbReport.phantom_harvests) {
      issues.push({
        severity: "ERROR",
        category: "BREADCRUMB",
        field: `breadcrumb.chapter_${ph.chapter}`,
        description: `PHANTOM HARVEST: ${ph.explanation}`,
      });
    }
  }
  for (const op of breadcrumbReport.orphan_plants) {
    issues.push({
      severity: "WARNING",
      category: "BREADCRUMB",
      field: `breadcrumb.chapter_${op.chapter}`,
      description: `ORPHAN PLANT: Chapter ${op.chapter} carries misdirection weight but has no recontextualisation entry`,
    });
  }

  // Extract characters
  const extractedChars = extractCharacters(data);

  // Build result
  const errors = issues.filter(i => i.severity === "ERROR");
  const warnings = issues.filter(i => i.severity === "WARNING");
  const success = errors.length === 0;

  const report: OutlineImportDiagnosticReport = {
    schema_version_found: schemaVersion,
    schema_version_valid: schemaValid,
    issues,
    breadcrumb_report: breadcrumbReport,
    errors_count: errors.length,
    warnings_count: warnings.length,
  };

  return {
    success,
    errors,
    warnings,
    diagnostic_report: report,
    chapters: success ? validChapters : undefined,
    characters_extracted: success ? extractedChars : undefined,
  };
}

// ── Persist imported outline ────────────────────────────────────────────

export async function saveImportedOutline(
  projectId: string,
  chapters: ChapterOutlineRecord[],
  rawJson: string,
): Promise<{ storage: string }> {
  const result = await githubStorage.saveFile(
    `story-data/${projectId}/outline.json`,
    rawJson,
  );
  await githubStorage.saveFile(
    `story-data/${projectId}/chapters_validated.json`,
    JSON.stringify(chapters, null, 2),
  );
  return { storage: result.storage };
}
