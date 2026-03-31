/**
 * Editorial Brief Injection — GAP3
 * GHOSTLY v2.2
 */

import { callWithFallback } from "@/api/llmRouter";
import type { AnnotationTarget, EditorialAnnotation } from "./editorialAnnotationTypes";
import { loadAnnotations, saveAnnotations } from "./annotationCRUD";

// ── Derived Instruction ─────────────────────────────────────────────────

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

  const prevAnnotation = all.find(a =>
    a.annotation_chapter === targetChapter - 1 &&
    a.annotation_present &&
    !a.brief_injected
  );
  if (prevAnnotation) results.push(prevAnnotation);

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
  saveAnnotations(all);
}
