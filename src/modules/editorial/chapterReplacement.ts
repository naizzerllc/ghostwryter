/**
 * Chapter Replacement Flow — GAP3
 * GHOSTLY v2.2
 */

import { githubStorage } from "@/storage/githubStorage";
import type { ChapterReplacementRecord, EditorialAnnotation } from "./editorialAnnotationTypes";
import { loadAnnotations, saveAnnotations } from "./annotationCRUD";
import { generateDerivedInstruction } from "./briefInjection";

const REPLACEMENTS_KEY = "ghostly_chapter_replacements";

export function loadReplacements(): ChapterReplacementRecord[] {
  try {
    const raw = localStorage.getItem(REPLACEMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function initiateChapterReplacement(
  chapterNumber: number,
  projectId: string,
  annotation: EditorialAnnotation,
  originalProse: string,
): Promise<ChapterReplacementRecord> {
  const timestamp = Date.now();
  const archivePath = `story-data/${projectId}/chapters/archive/chapter-${chapterNumber}-v${timestamp}.json`;

  try {
    await githubStorage.saveFile(archivePath, JSON.stringify({
      chapter_number: chapterNumber,
      prose: originalProse,
      archived_at: new Date().toISOString(),
      reason: annotation.annotation_text,
    }, null, 2));
    console.log(`[Replacement] Original chapter ${chapterNumber} archived to ${archivePath}`);
  } catch (error) {
    console.error(`[Replacement] Archive failed:`, error);
  }

  const record: ChapterReplacementRecord = {
    original_chapter_number: chapterNumber,
    replacement_reason: annotation.annotation_text ?? "",
    replacement_annotation_target: annotation.annotation_target ?? "OTHER",
    original_chapter_archived: true,
    original_chapter_archive_id: archivePath,
    replacement_generation_timestamp: new Date().toISOString(),
    replacement_approved: null,
    replacement_loops: 1,
  };

  const all = loadAnnotations();
  const stored = all.find(a => a.annotation_chapter === chapterNumber);
  if (stored) {
    stored.replacement_triggered = true;
    stored.replacement_chapter_number = chapterNumber;
    saveAnnotations(all);
  }

  const replacements = loadReplacements();
  replacements.push(record);
  localStorage.setItem(REPLACEMENTS_KEY, JSON.stringify(replacements));

  return record;
}

/**
 * Build the replacement brief header that goes at the TOP of the dynamic brief.
 */
export async function buildReplacementBriefHeader(
  annotation: EditorialAnnotation,
  originalScoresSummary: string,
): Promise<string> {
  const derivedInstruction = await generateDerivedInstruction(
    annotation.annotation_text!,
    annotation.annotation_target!,
  );

  return `## REPLACEMENT GENERATION — Chapter ${annotation.annotation_chapter}
## Reason: "${annotation.annotation_text}"
## Target: ${annotation.annotation_target} | Severity: SIGNIFICANT

The previous generation of this chapter was reviewed and found to have a significant
gap in ${annotation.annotation_target?.toLowerCase().replace(/_/g, " ")}. The quality scores were ${originalScoresSummary}. The
owner's judgment identified: "${annotation.annotation_text}".

This replacement must address this specifically. Do not reproduce the prior chapter
with minor adjustments. Generate this chapter with full awareness of the identified
gap. The outline brief, voice corpus, and Prose DNA requirements below are unchanged
— the gap to close is specifically: ${derivedInstruction}`;
}

/**
 * Approve or re-replace a replacement chapter.
 */
export function resolveReplacement(
  chapterNumber: number,
  approved: boolean,
): ChapterReplacementRecord | null {
  const replacements = loadReplacements();
  const record = replacements.find(r => r.original_chapter_number === chapterNumber && r.replacement_approved === null);
  if (!record) return null;

  if (approved) {
    record.replacement_approved = true;
    console.log(`[Replacement] Chapter ${chapterNumber} replacement approved`);
  } else {
    record.replacement_loops += 1;
    record.replacement_approved = null;
    if (record.replacement_loops >= 3) {
      console.warn(`[Replacement] Chapter ${chapterNumber} has been replaced ${record.replacement_loops} times — consider outline revision`);
    }
  }

  localStorage.setItem(REPLACEMENTS_KEY, JSON.stringify(replacements));
  return record;
}

export function getActiveReplacement(chapterNumber: number): ChapterReplacementRecord | null {
  return loadReplacements().find(r =>
    r.original_chapter_number === chapterNumber && r.replacement_approved === null
  ) ?? null;
}

export function getReplacementLoopCount(chapterNumber: number): number {
  const records = loadReplacements().filter(r => r.original_chapter_number === chapterNumber);
  return records.reduce((max, r) => Math.max(max, r.replacement_loops), 0);
}
