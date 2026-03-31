/**
 * Editorial Annotation System — GAP3
 * GHOSTLY v2.2
 *
 * Barrel re-export — all consumers can continue importing from this path.
 */

// Types
export type {
  AnnotationTarget,
  AnnotationSeverity,
  EditorialAnnotation,
  ChapterReplacementRecord,
  CalibrationPatternResult,
  ChapterStatus,
} from "./editorialAnnotationTypes";

// Annotation CRUD
export {
  createAnnotation,
  loadAnnotations,
  getAnnotationForChapter,
  saveAnnotations,
} from "./annotationCRUD";

// Brief Injection
export {
  generateDerivedInstruction,
  buildAnnotationBriefInjection,
  getAnnotationsForBriefInjection,
  markAnnotationsInjected,
} from "./briefInjection";

// Chapter Replacement
export {
  loadReplacements,
  initiateChapterReplacement,
  buildReplacementBriefHeader,
  resolveReplacement,
  getActiveReplacement,
  getReplacementLoopCount,
} from "./chapterReplacement";

// Calibration Pattern
export {
  shouldRunCalibrationPattern,
  runCalibrationPatternDetector,
} from "./calibrationPattern";

// ── Console Exposure ────────────────────────────────────────────────────

import { createAnnotation, loadAnnotations, getAnnotationForChapter } from "./annotationCRUD";
import { initiateChapterReplacement } from "./chapterReplacement";
import { resolveReplacement } from "./chapterReplacement";
import { runCalibrationPatternDetector } from "./calibrationPattern";

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
