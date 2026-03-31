/**
 * Calibration Pattern Detector — GAP3
 * GHOSTLY v2.2
 */

import { callWithFallback } from "@/api/llmRouter";
import type { CalibrationPatternResult } from "./editorialAnnotationTypes";
import { loadAnnotations } from "./annotationCRUD";

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
