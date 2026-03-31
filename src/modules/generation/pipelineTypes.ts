/**
 * Pipeline Types — Shared type definitions for the chapter pipeline.
 * Extracted from chapterPipeline.ts for modularity.
 */

import type { GenerationResult } from "./generationCore";
import type { MedicalFactCheckResult } from "@/modules/quality/medicalFactChecker";
import type { TexturePassRecord } from "@/modules/texturePass/texturePass";
import type { AntiAIDetectorResult } from "@/modules/quality/antiAIDetector";
import type { EditorialAnnotation } from "@/modules/editorial/editorialAnnotation";

// ── Types ───────────────────────────────────────────────────────────────

export type PipelineStage =
  | "IDLE"
  | "GENERATING"
  | "QUALITY_CHECK"
  | "HUMAN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "BLOCKED"
  | "REPLACEMENT_PENDING"
  | "REPLACED";

export type SignOffStatus =
  | "PENDING"
  | "SIGNED_OFF"
  | "FLAGGED_FOR_REVISION"
  | "SKIPPED";

export interface HumanEditorialSignOff {
  status: SignOffStatus;
  signed_by: string | null;
  signed_at: string | null;
  notes: string | null;
}

export interface ApprovedChapterRecord {
  chapter_number: number;
  approved_draft: string;
  composite_score: number | null;
  human_editorial_override: boolean;
  override_note: string | null;
  emotional_state_at_chapter_end: string | null;
  generation_truncation_suspected: boolean;
  human_editorial_sign_off: HumanEditorialSignOff;
  model_used: string;
  tokens_used: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  approved_at: string;
}

export interface PipelineState {
  chapter_number: number;
  project_id: string;
  stage: PipelineStage;
  generation_result: GenerationResult | null;
  approved_record: ApprovedChapterRecord | null;
  quality_score: number | null;
  medical_fact_check_result: MedicalFactCheckResult | null;
  medical_advisory_required: boolean;
  texture_pass_record: TexturePassRecord | null;
  anti_ai_result: AntiAIDetectorResult | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface PipelineResult {
  success: boolean;
  state: PipelineState;
}
