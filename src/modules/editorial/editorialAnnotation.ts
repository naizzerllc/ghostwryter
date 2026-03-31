/**
 * Editorial Annotation System — GAP3
 * GHOSTLY v2.2
 *
 * Per-chapter editorial annotations, brief injection, chapter replacement flow,
 * and calibration pattern detection.
 */

import { callWithFallback } from "@/api/llmRouter";
import { githubStorage } from "@/storage/githubStorage";

// ── Types ───────────────────────────────────────────────────────────────

export type AnnotationTarget =
  | "PROSE_TEXTURE"
  | "PACING"
  | "VOICE_CONSISTENCY"
  | "EMOTIONAL_FLATNESS"
  | "DIALOGUE"
  | "TENSION_DELIVERY"
  | "HOOK"
  | "TWIST_ARCHITECTURE"
  | "OTHER";

export type AnnotationSeverity = "MINOR" | "NOTABLE" | "SIGNIFICANT";

export interface EditorialAnnotation {
  annotation_present: boolean;
  annotation_text: string | null;
  annotation_target: AnnotationTarget | null;
  annotation_severity: AnnotationSeverity | null;
  annotation_chapter: number;
  brief_injected: boolean;
  injected_into_chapter: number | null;
  replacement_triggered: boolean;
  replacement_chapter_number: number | null;
}

export interface ChapterReplacementRecord {
  original_chapter_number: number;
  replacement_reason: string;
  replacement_annotation_target: string;
  original_chapter_archived: boolean;
  original_chapter_archive_id: string;
  replacement_generation_timestamp: string;
  replacement_approved: boolean | null;
  replacement_loops: number;
}

export interface CalibrationPatternResult {
  most_common_gap: string;
  gap_frequency: number;
  module_divergence_suspected: string | null;
  divergence_evidence: string | null;
  recommended_adjustment: string;
}

export type ChapterStatus =
  | "GENERATING"
  | "QUALITY_CHECK"
  | "HUMAN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "REPLACEMENT_PENDING"
  | "REPLACED";

// ── Storage Keys ────────────────────────────────────────────────────────

const ANNOTATIONS_KEY = "ghostly_editorial_annotations";
const REPLACEMENTS_KEY = "ghostly_chapter_replacements";

// ── Annotation CRUD ─────────────────────────────────────────────────────

export function createAnnotation(
  chapterNumber: number,
  text: string | null,
  target: AnnotationTarget | null,
  severity: AnnotationSeverity | null,
): EditorialAnnotation {
  const annotation: EditorialAnnotation = {
    annotation_present: text !== null && text.trim().length > 0,
    annotation_text: text?.trim() ?? null,
    annotation_target: target,
    annotation_severity: severity,
    annotation_chapter: chapterNumber,
    brief_injected: false,
    injected_into_chapter: null,
    replacement_triggered: false,
    replacement_chapter_number: null,
  };

  // Persist
  const all = loadAnnotations();
  // Replace existing for same chapter, or add new
  const idx = all.findIndex(a => a.annotation_chapter === chapterNumber);
  if (idx >= 0) all[idx] = annotation;
  else all.push(annotation);
  localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(all));

  console.log(`[EditorialAnnotation] Annotation ${annotation.annotation_present ? "created" : "skipped (empty)"} for chapter ${chapterNumber}`);
  return annotation;
}

export function loadAnnotations(): EditorialAnnotation[] {
  try {
    const raw = localStorage.getItem(ANNOTATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getAnnotationForChapter(chapterNumber: number): EditorialAnnotation | null {
  return loadAnnotations().find(a => a.annotation_chapter === chapterNumber) ?? null;
}

// ── Derived Instruction (Gemini Flash) ──────────────────────────────────

export async function generateDerivedInstruction(
  annotationText: string,
  annotationTarget: AnnotationTarget,
): Promise<string> {
  const prompt = `You are a craft assistant for a professional fiction production platform.
The platform owner reviewed a chapter and wrote this editorial note:
"${annotationText}"
Target area: ${annotationTarget}

Generate a 2-3 sentence generation instruction that tells the next chapter's LLM
what to do differently based on this observation. Be specific. Do not repeat the
note — translate it into a forward-looking craft instruction.
Format: plain prose. No headers. No lists. 2-3 sentences only.`;

  try {
    const response = await callWithFallback("quality_analysis", prompt, {
      temperature: 0.3,
      max_tokens: 200,
    });
    return response.content.trim();
  } catch (error) {
    console.error("[EditorialAnnotation] Derived instruction generation failed:", error);
    // Fallback: use the annotation text directly
    return `Based on editorial observation: ${annotationText}. Address the identified gap in ${annotationTarget.toLowerCase().replace(/_/g, " ")}.`;
  }
}

// ── Brief Injection ─────────────────────────────────────────────────────

export async function buildAnnotationBriefInjection(
  annotation: EditorialAnnotation,
): Promise<string | null> {
  if (!annotation.annotation_present || !annotation.annotation_text || !annotation.annotation_target) {
    return null;
  }

  const derivedInstruction = await generateDerivedInstruction(
    annotation.annotation_text,
    annotation.annotation_target,
  );

  return `## EDITORIAL CALIBRATION NOTE — carry forward from Chapter ${annotation.annotation_chapter}

The platform owner reviewed Chapter ${annotation.annotation_chapter} and noted the following:
"${annotation.annotation_text}"

Target area: ${annotation.annotation_target}
Significance: ${annotation.annotation_severity}

This note is not a revision instruction for the current chapter. It is a calibration
signal: the owner's editorial judgment identified a gap in Chapter ${annotation.annotation_chapter} that the quality
scores did not fully capture. In generating this chapter, be aware of the following:

${derivedInstruction}`;
}

/**
 * Get annotations that should be injected into a given chapter's brief.
 * Normal: inject from chapter N-1 only.
 * Exception: SIGNIFICANT + VOICE_CONSISTENCY/EMOTIONAL_FLATNESS → inject from N-1 AND N-2.
 */
export function getAnnotationsForBriefInjection(targetChapter: number): EditorialAnnotation[] {
  const all = loadAnnotations();
  const results: EditorialAnnotation[] = [];

  // Check N-1
  const prevAnnotation = all.find(a =>
    a.annotation_chapter === targetChapter - 1 &&
    a.annotation_present &&
    !a.brief_injected
  );
  if (prevAnnotation) results.push(prevAnnotation);

  // Check N-2 for SIGNIFICANT + VOICE_CONSISTENCY or EMOTIONAL_FLATNESS
  const prev2Annotation = all.find(a =>
    a.annotation_chapter === targetChapter - 2 &&
    a.annotation_present &&
    a.annotation_severity === "SIGNIFICANT" &&
    (a.annotation_target === "VOICE_CONSISTENCY" || a.annotation_target === "EMOTIONAL_FLATNESS")
  );
  if (prev2Annotation) results.push(prev2Annotation);

  return results;
}

/**
 * Mark annotations as injected into a target chapter.
 */
export function markAnnotationsInjected(annotations: EditorialAnnotation[], targetChapter: number): void {
  const all = loadAnnotations();
  for (const annotation of annotations) {
    const stored = all.find(a => a.annotation_chapter === annotation.annotation_chapter);
    if (stored) {
      stored.brief_injected = true;
      stored.injected_into_chapter = targetChapter;
    }
  }
  localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(all));
}

// ── Chapter Replacement Flow ────────────────────────────────────────────

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
  // Step 1 — Archive original
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

  // Create replacement record
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

  // Mark annotation as replacement trigger
  const all = loadAnnotations();
  const stored = all.find(a => a.annotation_chapter === chapterNumber);
  if (stored) {
    stored.replacement_triggered = true;
    stored.replacement_chapter_number = chapterNumber;
    localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(all));
  }

  // Persist replacement record
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
    record.replacement_approved = null; // Reset for next attempt
    if (record.replacement_loops >= 3) {
      console.warn(`[Replacement] Chapter ${chapterNumber} has been replaced ${record.replacement_loops} times — consider outline revision`);
    }
  }

  localStorage.setItem(REPLACEMENTS_KEY, JSON.stringify(replacements));
  return record;
}

/**
 * Get the current replacement record for a chapter (if any pending).
 */
export function getActiveReplacement(chapterNumber: number): ChapterReplacementRecord | null {
  return loadReplacements().find(r =>
    r.original_chapter_number === chapterNumber && r.replacement_approved === null
  ) ?? null;
}

/**
 * Get the total replacement loop count for a chapter.
 */
export function getReplacementLoopCount(chapterNumber: number): number {
  const records = loadReplacements().filter(r => r.original_chapter_number === chapterNumber);
  return records.reduce((max, r) => Math.max(max, r.replacement_loops), 0);
}

// ── Calibration Pattern Detector ────────────────────────────────────────

export function shouldRunCalibrationPattern(): boolean {
  const annotations = loadAnnotations().filter(a => a.annotation_present);
  return annotations.length > 0 && annotations.length % 5 === 0;
}

export async function runCalibrationPatternDetector(): Promise<CalibrationPatternResult | null> {
  const annotations = loadAnnotations().filter(a => a.annotation_present);
  if (annotations.length < 5) return null;

  const annotationSummary = annotations.map(a =>
    `Chapter ${a.annotation_chapter}: "${a.annotation_text}" | Target: ${a.annotation_target} | Severity: ${a.annotation_severity}`
  ).join("\n");

  const prompt = `You are a calibration analyst for a professional fiction production platform.
The platform owner has reviewed and annotated ${annotations.length} chapters. Here are all annotations:

${annotationSummary}

Identify:
1. Which annotation_target appears most frequently (the most common gap the owner is noticing)
2. Whether any quality module appears to be scoring chapters higher than the owner's
   annotations suggest (evidence: SIGNIFICANT annotations on chapters with high module scores)
3. One specific adjustment the platform could make to better align with the owner's
   editorial standard — stated as a concrete action, not a general observation

Output JSON only:
{
  "most_common_gap": "annotation_target string",
  "gap_frequency": number,
  "module_divergence_suspected": "module name | null",
  "divergence_evidence": "string | null",
  "recommended_adjustment": "string"
}`;

  try {
    const response = await callWithFallback("quality_analysis", prompt, {
      temperature: 0.2,
      max_tokens: 500,
    });

    const parsed = JSON.parse(response.content) as CalibrationPatternResult;
    console.log(`[CalibrationPattern] Analysis complete — most common gap: ${parsed.most_common_gap}`);
    return parsed;
  } catch (error) {
    console.error("[CalibrationPattern] Pattern analysis failed:", error);
    return null;
  }
}

// ── Console Exposure ────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_editorialAnnotation = {
    createAnnotation,
    loadAnnotations,
    getAnnotationForChapter,
    initiateChapterReplacement,
    resolveReplacement,
    runCalibrationPatternDetector,
  };
}
