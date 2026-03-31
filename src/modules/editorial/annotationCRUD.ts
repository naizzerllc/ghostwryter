/**
 * Editorial Annotation CRUD — GAP3
 * GHOSTLY v2.2
 */

import type {
  AnnotationTarget,
  AnnotationSeverity,
  EditorialAnnotation,
} from "./editorialAnnotationTypes";

const ANNOTATIONS_KEY = "ghostly_editorial_annotations";

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

  const all = loadAnnotations();
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

export function saveAnnotations(annotations: EditorialAnnotation[]): void {
  localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(annotations));
}
