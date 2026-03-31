/**
 * Export Pipeline — S23
 * Exports manuscript in multiple formats with browser download trigger.
 */

import { githubStorage } from "@/storage/githubStorage";
import { assembleManuscript, type AssemblyOptions, type AssembledManuscript } from "@/modules/assembler/manuscriptAssembler";

// ── Types ───────────────────────────────────────────────────────────────

export type ExportFormat =
  | "plain_text"
  | "markdown"
  | "formatted_document"
  | "chapter_export"
  | "quality_report";

export interface ExportResult {
  format: ExportFormat;
  filename: string;
  content: string;
  exported_at: string;
  word_count: number;
  chapter_count: number;
}

export interface ExportLogEntry {
  format: ExportFormat;
  filename: string;
  exported_at: string;
  word_count: number;
  chapter_count: number;
}

export interface ExportPreflightResult {
  unsigned_chapters: number;
  flagged_chapters: number;
  missing_chapters: number;
  total_chapters: number;
  ready: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────

const PLATFORM_VERSION = "GHOSTLY v2.2";
const AUTHOR_BRAND = "Leila Rex";

// ── Helpers ─────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function loadExportLog(projectId: string): Promise<ExportLogEntry[]> {
  const raw = await githubStorage.loadFile(`story-data/${projectId}/exports/export_log.json`);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ExportLogEntry[];
  } catch {
    return [];
  }
}

async function saveExportLog(projectId: string, log: ExportLogEntry[]): Promise<void> {
  await githubStorage.saveFile(
    `story-data/${projectId}/exports/export_log.json`,
    JSON.stringify(log, null, 2),
  );
}

// ── Format Builders ─────────────────────────────────────────────────────

function buildPlainText(manuscript: AssembledManuscript): string {
  return manuscript.content.replace(/^# /gm, "").replace(/---/g, "");
}

function buildMarkdown(manuscript: AssembledManuscript): string {
  return manuscript.content;
}

function buildFormattedDocument(manuscript: AssembledManuscript, projectId: string): string {
  const h = manuscript.health;
  const header = [
    "---",
    `title: "${projectId}"`,
    `author: "${AUTHOR_BRAND}"`,
    `word_count: ${h.total_word_count}`,
    `chapters: ${h.chapter_count}`,
    `quality_high: ${h.quality_distribution.high}`,
    `quality_medium: ${h.quality_distribution.medium}`,
    `quality_low: ${h.quality_distribution.low}`,
    `export_date: "${manuscript.assembled_at}"`,
    `platform: "${PLATFORM_VERSION}"`,
    "---",
    "",
  ].join("\n");

  return header + manuscript.content;
}

async function buildChapterExport(projectId: string, chapters: number[]): Promise<string> {
  const records: unknown[] = [];
  for (const ch of chapters) {
    const raw = await githubStorage.loadFile(`story-data/${projectId}/chapters/${ch}/approved.json`);
    if (raw) {
      try {
        records.push(JSON.parse(raw));
      } catch { /* skip invalid */ }
    }
  }
  return JSON.stringify(records, null, 2);
}

async function buildQualityReport(projectId: string, manuscript: AssembledManuscript): Promise<string> {
  const h = manuscript.health;
  const lines: string[] = [
    `# Quality Report — ${projectId}`,
    `**Generated:** ${manuscript.assembled_at}`,
    `**Platform:** ${PLATFORM_VERSION}`,
    "",
    "## Summary",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total chapters | ${h.chapter_count} |`,
    `| Total words | ${h.total_word_count.toLocaleString()} |`,
    `| Unsigned chapters | ${h.unsigned_chapters} |`,
    `| Overrides | ${h.override_count} |`,
    `| Quality ≥ 8.0 | ${h.quality_distribution.high} |`,
    `| Quality 7.0–7.9 | ${h.quality_distribution.medium} |`,
    `| Quality < 7.0 | ${h.quality_distribution.low} |`,
    `| Unscored | ${h.quality_distribution.unscored} |`,
    "",
    "## Per-Chapter Breakdown",
    "",
    "| Chapter | Score | Sign-off | Override |",
    "|---------|-------|----------|----------|",
  ];

  for (const ch of manuscript.chapters_included) {
    const raw = await githubStorage.loadFile(`story-data/${projectId}/chapters/${ch}/approved.json`);
    if (!raw) continue;
    try {
      const record = JSON.parse(raw);
      const score = record.composite_score !== null ? record.composite_score.toFixed(1) : "—";
      const signOff = record.human_editorial_sign_off?.status ?? "PENDING";
      const override = record.human_editorial_override ? "YES" : "—";
      lines.push(`| ${ch} | ${score} | ${signOff} | ${override} |`);
    } catch { /* skip */ }
  }

  if (h.pending_chapters.length > 0) {
    lines.push("", "## ⚠️ Pending Chapters", "");
    for (const ch of h.pending_chapters) {
      lines.push(`- Chapter ${ch}: awaiting sign-off`);
    }
  }

  if (h.flagged_chapters.length > 0) {
    lines.push("", "## 🔴 Flagged for Revision", "");
    for (const ch of h.flagged_chapters) {
      lines.push(`- Chapter ${ch}: flagged for revision`);
    }
  }

  return lines.join("\n");
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Run pre-flight check before export.
 */
export async function preflightCheck(
  projectId: string,
  options?: Partial<AssemblyOptions>,
): Promise<ExportPreflightResult> {
  const manuscript = await assembleManuscript(projectId, options);
  const w = manuscript.warnings;
  return {
    unsigned_chapters: manuscript.health.unsigned_chapters,
    flagged_chapters: manuscript.health.flagged_chapters.length,
    missing_chapters: w.filter((wn) => wn.type === "MISSING_CHAPTER").length,
    total_chapters: manuscript.chapters_included.length,
    ready: manuscript.health.unsigned_chapters === 0 && w.length === 0,
  };
}

/**
 * Export manuscript in specified format — triggers browser download.
 */
export async function exportManuscript(
  projectId: string,
  format: ExportFormat,
  options?: Partial<AssemblyOptions>,
): Promise<ExportResult> {
  const manuscript = await assembleManuscript(projectId, options);
  const now = new Date().toISOString();
  const dateSlug = now.slice(0, 10).replace(/-/g, "");
  let content: string;
  let filename: string;
  let mimeType: string;

  switch (format) {
    case "plain_text":
      content = buildPlainText(manuscript);
      filename = `${projectId}_${dateSlug}.txt`;
      mimeType = "text/plain";
      break;

    case "markdown":
      content = buildMarkdown(manuscript);
      filename = `${projectId}_${dateSlug}.md`;
      mimeType = "text/markdown";
      break;

    case "formatted_document":
      content = buildFormattedDocument(manuscript, projectId);
      filename = `${projectId}_formatted_${dateSlug}.md`;
      mimeType = "text/markdown";
      break;

    case "chapter_export":
      content = await buildChapterExport(projectId, manuscript.chapters_included);
      filename = `${projectId}_chapters_${dateSlug}.json`;
      mimeType = "application/json";
      break;

    case "quality_report":
      content = await buildQualityReport(projectId, manuscript);
      filename = `${projectId}_quality_${dateSlug}.md`;
      mimeType = "text/markdown";
      break;
  }

  // Trigger browser download
  triggerDownload(content, filename, mimeType);

  // Log export
  const log = await loadExportLog(projectId);
  const entry: ExportLogEntry = {
    format,
    filename,
    exported_at: now,
    word_count: countWords(content),
    chapter_count: manuscript.chapters_included.length,
  };
  log.push(entry);
  await saveExportLog(projectId, log);

  return {
    format,
    filename,
    content,
    exported_at: now,
    word_count: countWords(content),
    chapter_count: manuscript.chapters_included.length,
  };
}

/**
 * Get export history for a project.
 */
export async function getExportHistory(projectId: string): Promise<ExportLogEntry[]> {
  return loadExportLog(projectId);
}
