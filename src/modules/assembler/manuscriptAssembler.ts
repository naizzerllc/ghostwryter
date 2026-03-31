/**
 * Manuscript Assembler — S23
 * Concatenates approved chapters into a full manuscript with validation.
 */

import { githubStorage } from "@/storage/githubStorage";
import type { ApprovedChapterRecord, SignOffStatus } from "@/modules/generation/pipelineTypes";

// ── Types ───────────────────────────────────────────────────────────────

export interface AssemblyOptions {
  include_prologue: boolean;
  include_epilogue: boolean;
  chapters_range: { from: number; to: number } | null;
  chapter_separator: string;
}

export interface ManuscriptHealthSummary {
  total_word_count: number;
  chapter_count: number;
  unsigned_chapters: number;
  quality_distribution: {
    high: number;    // >= 8.0
    medium: number;  // 7.0–7.9
    low: number;     // < 7.0
    unscored: number;
  };
  override_count: number;
  flagged_chapters: number[];
  pending_chapters: number[];
}

export interface AssemblyWarning {
  type: "PENDING_SIGNOFF" | "FLAGGED_REVISION" | "LOCAL_ONLY" | "MISSING_CHAPTER";
  chapter_number: number;
  message: string;
}

export interface AssembledManuscript {
  content: string;
  health: ManuscriptHealthSummary;
  warnings: AssemblyWarning[];
  chapters_included: number[];
  assembled_at: string;
}

// ── Defaults ────────────────────────────────────────────────────────────

export const DEFAULT_ASSEMBLY_OPTIONS: AssemblyOptions = {
  include_prologue: false,
  include_epilogue: false,
  chapters_range: null,
  chapter_separator: "\n\n---\n\n",
};

// ── Helpers ─────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Assemble manuscript from approved chapters.
 */
export async function assembleManuscript(
  projectId: string,
  options: Partial<AssemblyOptions> = {},
): Promise<AssembledManuscript> {
  const opts: AssemblyOptions = { ...DEFAULT_ASSEMBLY_OPTIONS, ...options };
  const now = new Date().toISOString();

  // Discover available chapters
  const entries = await githubStorage.listFiles(`story-data/${projectId}/chapters`);
  const chapterNumbers = entries
    .filter((e) => e.type === "dir")
    .map((e) => parseInt(e.name, 10))
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);

  // Apply range filter
  const range = opts.chapters_range;
  const filtered = range
    ? chapterNumbers.filter((n) => n >= range.from && n <= range.to)
    : chapterNumbers;

  const warnings: AssemblyWarning[] = [];
  const sections: string[] = [];
  const included: number[] = [];
  let totalWords = 0;
  let unsignedCount = 0;
  let overrideCount = 0;
  const pendingChapters: number[] = [];
  const flaggedChapters: number[] = [];
  const qualityDist = { high: 0, medium: 0, low: 0, unscored: 0 };

  for (const chNum of filtered) {
    const approvedRaw = await githubStorage.loadFile(
      `story-data/${projectId}/chapters/${chNum}/approved.json`,
    );

    if (!approvedRaw) {
      warnings.push({
        type: "MISSING_CHAPTER",
        chapter_number: chNum,
        message: `Chapter ${chNum}: no approved record found`,
      });
      continue;
    }

    let record: ApprovedChapterRecord;
    try {
      record = JSON.parse(approvedRaw) as ApprovedChapterRecord;
    } catch {
      warnings.push({
        type: "MISSING_CHAPTER",
        chapter_number: chNum,
        message: `Chapter ${chNum}: invalid approved record JSON`,
      });
      continue;
    }

    // Check sign-off status
    const signOff: SignOffStatus = record.human_editorial_sign_off?.status ?? "PENDING";
    if (signOff === "PENDING") {
      unsignedCount++;
      pendingChapters.push(chNum);
      warnings.push({
        type: "PENDING_SIGNOFF",
        chapter_number: chNum,
        message: `Chapter ${chNum}: sign-off status PENDING`,
      });
    } else if (signOff === "FLAGGED_FOR_REVISION") {
      unsignedCount++;
      flaggedChapters.push(chNum);
      warnings.push({
        type: "FLAGGED_REVISION",
        chapter_number: chNum,
        message: `Chapter ${chNum}: flagged for revision`,
      });
    }

    // Quality distribution
    const score = record.composite_score;
    if (score === null || score === undefined) {
      qualityDist.unscored++;
    } else if (score >= 8.0) {
      qualityDist.high++;
    } else if (score >= 7.0) {
      qualityDist.medium++;
    } else {
      qualityDist.low++;
    }

    if (record.human_editorial_override) overrideCount++;

    const wc = countWords(record.approved_draft);
    totalWords += wc;
    included.push(chNum);
    sections.push(`# Chapter ${chNum}\n\n${record.approved_draft}`);
  }

  const content = sections.join(opts.chapter_separator);

  const health: ManuscriptHealthSummary = {
    total_word_count: totalWords,
    chapter_count: included.length,
    unsigned_chapters: unsignedCount,
    quality_distribution: qualityDist,
    override_count: overrideCount,
    flagged_chapters: flaggedChapters,
    pending_chapters: pendingChapters,
  };

  return {
    content,
    health,
    warnings,
    chapters_included: included,
    assembled_at: now,
  };
}
