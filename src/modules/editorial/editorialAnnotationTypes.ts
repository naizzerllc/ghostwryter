/**
 * Editorial Annotation Types — GAP3
 * GHOSTLY v2.2
 */

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
