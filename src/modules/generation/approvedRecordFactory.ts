/**
 * Approved Record Factory — Creates ApprovedChapterRecord from generation output.
 * Extracted from chapterPipeline.ts for modularity.
 */

import type { GenerationSuccess } from "./generationCore";
import type { ApprovedChapterRecord, HumanEditorialSignOff } from "./pipelineTypes";

/**
 * Create an approved chapter record from a successful generation result.
 * INVARIANT [A16-1]: status always defaults to PENDING. No chapter born SIGNED_OFF.
 */
export function createApprovedRecord(
  chapterNumber: number,
  generationResult: GenerationSuccess,
): ApprovedChapterRecord {
  const signOff: HumanEditorialSignOff = {
    status: "PENDING",
    signed_by: null,
    signed_at: null,
    notes: null,
  };

  // If truncation suspected: SKIPPED is not permitted for sign-off
  if (generationResult.truncation_suspected) {
    signOff.notes = "TRUNCATION_SUSPECTED — mandatory human review. SKIPPED not permitted.";
  }

  return {
    chapter_number: chapterNumber,
    approved_draft: generationResult.content,
    composite_score: null,
    human_editorial_override: false,
    override_note: null,
    emotional_state_at_chapter_end: null,
    generation_truncation_suspected: generationResult.truncation_suspected,
    human_editorial_sign_off: signOff,
    model_used: generationResult.model_used,
    tokens_used: generationResult.tokens_used,
    cache_read_tokens: generationResult.cache_read_tokens,
    cache_write_tokens: generationResult.cache_write_tokens,
    approved_at: new Date().toISOString(),
  };
}
