/**
 * Chapter Archive + Version Control — S23
 * Stores all versions of every chapter, supports pin/compare/revert.
 *
 * GitHub structure:
 *   story-data/{projectId}/chapters/{chapterNumber}/
 *     draft.md, approved.json, quality.json, versions/v1.md..., pinned.json
 */

import { githubStorage } from "@/storage/githubStorage";

// ── Types ───────────────────────────────────────────────────────────────

export interface ChapterVersion {
  version_id: number;
  content: string;
  word_count: number;
  saved_at: string;
}

export interface VersionMeta {
  version_id: number;
  word_count: number;
  saved_at: string;
}

export interface PinnedVersion {
  version_id: number;
  pinned_by: string;
  pinned_at: string;
  note: string;
}

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  line_number_old: number | null;
  line_number_new: number | null;
}

export interface VersionDiff {
  chapter_number: number;
  v1_id: number;
  v2_id: number;
  lines: DiffLine[];
  additions: number;
  deletions: number;
}

export interface ChapterArchiveSummary {
  chapter_number: number;
  version_count: number;
  latest_version: number;
  has_pinned: boolean;
  pinned_version: number | null;
  has_approved: boolean;
  quality_score: number | null;
}

// ── Paths ───────────────────────────────────────────────────────────────

function chapterDir(projectId: string, chapterNumber: number): string {
  return `story-data/${projectId}/chapters/${chapterNumber}`;
}

function versionPath(projectId: string, chapterNumber: number, versionId: number): string {
  return `${chapterDir(projectId, chapterNumber)}/versions/v${versionId}.md`;
}

function draftPath(projectId: string, chapterNumber: number): string {
  return `${chapterDir(projectId, chapterNumber)}/draft.md`;
}

function approvedPath(projectId: string, chapterNumber: number): string {
  return `${chapterDir(projectId, chapterNumber)}/approved.json`;
}

function qualityPath(projectId: string, chapterNumber: number): string {
  return `${chapterDir(projectId, chapterNumber)}/quality.json`;
}

function pinnedPath(projectId: string, chapterNumber: number): string {
  return `${chapterDir(projectId, chapterNumber)}/pinned.json`;
}

function metaPath(projectId: string, chapterNumber: number): string {
  return `${chapterDir(projectId, chapterNumber)}/versions/_meta.json`;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function loadVersionMeta(projectId: string, chapterNumber: number): Promise<VersionMeta[]> {
  const raw = await githubStorage.loadFile(metaPath(projectId, chapterNumber));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as VersionMeta[];
  } catch {
    return [];
  }
}

async function saveVersionMeta(projectId: string, chapterNumber: number, meta: VersionMeta[]): Promise<void> {
  await githubStorage.saveFile(metaPath(projectId, chapterNumber), JSON.stringify(meta, null, 2));
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Archive a chapter draft — saves as new version and updates draft.md.
 */
export async function archiveChapter(
  chapterNumber: number,
  content: string,
  projectId: string,
): Promise<{ version_id: number }> {
  const meta = await loadVersionMeta(projectId, chapterNumber);
  const nextVersion = meta.length > 0 ? Math.max(...meta.map((m) => m.version_id)) + 1 : 1;
  const now = new Date().toISOString();
  const wc = countWords(content);

  // Save version file
  await githubStorage.saveFile(versionPath(projectId, chapterNumber, nextVersion), content);

  // Update meta
  meta.push({ version_id: nextVersion, word_count: wc, saved_at: now });
  await saveVersionMeta(projectId, chapterNumber, meta);

  // Update draft.md to latest
  await githubStorage.saveFile(draftPath(projectId, chapterNumber), content);

  return { version_id: nextVersion };
}

/**
 * Save approved chapter record JSON.
 */
export async function saveApprovedRecord(
  chapterNumber: number,
  record: unknown,
  projectId: string,
): Promise<void> {
  await githubStorage.saveFile(approvedPath(projectId, chapterNumber), JSON.stringify(record, null, 2));
}

/**
 * Save quality gate result JSON.
 */
export async function saveQualityResult(
  chapterNumber: number,
  result: unknown,
  projectId: string,
): Promise<void> {
  await githubStorage.saveFile(qualityPath(projectId, chapterNumber), JSON.stringify(result, null, 2));
}

/**
 * Get full version history for a chapter.
 */
export async function getVersionHistory(
  chapterNumber: number,
  projectId: string,
): Promise<VersionMeta[]> {
  return loadVersionMeta(projectId, chapterNumber);
}

/**
 * Load a specific version's content.
 */
export async function loadVersion(
  chapterNumber: number,
  versionId: number,
  projectId: string,
): Promise<string | null> {
  return githubStorage.loadFile(versionPath(projectId, chapterNumber, versionId));
}

/**
 * Pin a version as stable.
 */
export async function pinVersion(
  chapterNumber: number,
  versionId: number,
  note: string,
  projectId: string,
): Promise<void> {
  const pinned: PinnedVersion = {
    version_id: versionId,
    pinned_by: "operator",
    pinned_at: new Date().toISOString(),
    note,
  };
  await githubStorage.saveFile(pinnedPath(projectId, chapterNumber), JSON.stringify(pinned, null, 2));
}

/**
 * Get pinned version info if any.
 */
export async function getPinnedVersion(
  chapterNumber: number,
  projectId: string,
): Promise<PinnedVersion | null> {
  const raw = await githubStorage.loadFile(pinnedPath(projectId, chapterNumber));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PinnedVersion;
  } catch {
    return null;
  }
}

/**
 * Revert to a specific version — sets it as current draft.
 */
export async function revertToVersion(
  chapterNumber: number,
  versionId: number,
  projectId: string,
): Promise<boolean> {
  const content = await loadVersion(chapterNumber, versionId, projectId);
  if (!content) return false;
  await githubStorage.saveFile(draftPath(projectId, chapterNumber), content);
  return true;
}

/**
 * Compare two versions — returns line-level diff.
 */
export async function compareVersions(
  chapterNumber: number,
  v1Id: number,
  v2Id: number,
  projectId: string,
): Promise<VersionDiff | null> {
  const [content1, content2] = await Promise.all([
    loadVersion(chapterNumber, v1Id, projectId),
    loadVersion(chapterNumber, v2Id, projectId),
  ]);

  if (!content1 || !content2) return null;

  const lines1 = content1.split("\n");
  const lines2 = content2.split("\n");
  const diffLines: DiffLine[] = [];
  let additions = 0;
  let deletions = 0;

  // Simple LCS-based diff
  const lcs = computeLCS(lines1, lines2);
  let i = 0;
  let j = 0;
  let k = 0;
  let oldLine = 1;
  let newLine = 1;

  while (k < lcs.length) {
    // Lines removed from v1
    while (i < lines1.length && lines1[i] !== lcs[k]) {
      diffLines.push({ type: "removed", content: lines1[i], line_number_old: oldLine++, line_number_new: null });
      deletions++;
      i++;
    }
    // Lines added in v2
    while (j < lines2.length && lines2[j] !== lcs[k]) {
      diffLines.push({ type: "added", content: lines2[j], line_number_old: null, line_number_new: newLine++ });
      additions++;
      j++;
    }
    // Unchanged
    diffLines.push({ type: "unchanged", content: lcs[k], line_number_old: oldLine++, line_number_new: newLine++ });
    i++;
    j++;
    k++;
  }

  // Remaining lines after LCS
  while (i < lines1.length) {
    diffLines.push({ type: "removed", content: lines1[i], line_number_old: oldLine++, line_number_new: null });
    deletions++;
    i++;
  }
  while (j < lines2.length) {
    diffLines.push({ type: "added", content: lines2[j], line_number_old: null, line_number_new: newLine++ });
    additions++;
    j++;
  }

  return { chapter_number: chapterNumber, v1_id: v1Id, v2_id: v2Id, lines: diffLines, additions, deletions };
}

/**
 * Get archive summary for all chapters in a project.
 */
export async function getArchiveSummary(projectId: string): Promise<ChapterArchiveSummary[]> {
  const entries = await githubStorage.listFiles(`story-data/${projectId}/chapters`);
  const summaries: ChapterArchiveSummary[] = [];

  for (const entry of entries) {
    if (entry.type !== "dir") continue;
    const chNum = parseInt(entry.name, 10);
    if (isNaN(chNum)) continue;

    const [meta, pinned, approvedRaw] = await Promise.all([
      loadVersionMeta(projectId, chNum),
      getPinnedVersion(chNum, projectId),
      githubStorage.loadFile(approvedPath(projectId, chNum)),
    ]);

    let qualityScore: number | null = null;
    if (approvedRaw) {
      try {
        const record = JSON.parse(approvedRaw);
        qualityScore = record.composite_score ?? null;
      } catch { /* ignore */ }
    }

    summaries.push({
      chapter_number: chNum,
      version_count: meta.length,
      latest_version: meta.length > 0 ? Math.max(...meta.map((m) => m.version_id)) : 0,
      has_pinned: !!pinned,
      pinned_version: pinned?.version_id ?? null,
      has_approved: !!approvedRaw,
      quality_score: qualityScore,
    });
  }

  return summaries.sort((a, b) => a.chapter_number - b.chapter_number);
}

/**
 * Load approved chapter record.
 */
export async function loadApprovedRecord(chapterNumber: number, projectId: string): Promise<unknown | null> {
  const raw = await githubStorage.loadFile(approvedPath(projectId, chapterNumber));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── LCS helper ──────────────────────────────────────────────────────────

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}
