/**
 * Forbidden Words Checker — Four-tier post-generation enforcement.
 * GHOSTLY v2.2 · Session 4
 *
 * CRITICAL: This is code-enforced ONLY. Never injected into any LLM call.
 * Tier order: hard_ban → dialogue_exempt → soft_ban → context_flag
 * A word cleared by dialogue_exempt in dialogue is NOT re-evaluated by context_flag.
 * No word appears in more than one tier.
 */

import FORBIDDEN_WORDS from "@/constants/FORBIDDEN_WORDS.json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViolationTier = "hard_ban" | "dialogue_exempt" | "soft_ban" | "context_flag";
export type TextContext = "narration" | "dialogue";

export interface Violation {
  word: string;
  tier: ViolationTier;
  position: number;
  context: TextContext;
  suggestion?: string;
}

export interface ForbiddenWordsResult {
  violations: Violation[];
  hardBanCount: number;
  softBanCount: number;
  contextFlagCount: number;
  dialogueExemptCleared: number;
}

// ---------------------------------------------------------------------------
// Dialogue detection
// ---------------------------------------------------------------------------

interface TextSegment {
  text: string;
  context: TextContext;
  offset: number;
}

function segmentText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Match quoted speech: "..." or '...' (single-line)
  const quoteRegex = /[""\u201C\u201D]([^""\u201C\u201D]*)[""\u201C\u201D]|['\u2018\u2019]([^'\u2018\u2019]*)['\u2018\u2019]/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = quoteRegex.exec(text)) !== null) {
    // Narration before this quote
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        context: "narration",
        offset: lastIndex,
      });
    }
    // The quoted dialogue
    segments.push({
      text: match[0],
      context: "dialogue",
      offset: match.index,
    });
    lastIndex = match.index + match[0].length;
  }

  // Remaining narration
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      context: "narration",
      offset: lastIndex,
    });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Word matching with word-boundary regex
// ---------------------------------------------------------------------------

function findWordPositions(
  text: string,
  word: string,
  globalOffset: number
): number[] {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "gi");
  const positions: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    positions.push(globalOffset + m.index);
  }
  return positions;
}

// ---------------------------------------------------------------------------
// checkChapter
// ---------------------------------------------------------------------------

export function checkChapter(text: string, _chapterId?: string): ForbiddenWordsResult {
  const violations: Violation[] = [];
  let dialogueExemptCleared = 0;

  const segments = segmentText(text);

  // Track positions already handled by dialogue_exempt to prevent context_flag re-evaluation
  const exemptedPositions = new Set<number>();

  // --- Tier 1: hard_ban (all contexts) ---
  for (const word of FORBIDDEN_WORDS.tiers.hard_ban) {
    for (const seg of segments) {
      const positions = findWordPositions(seg.text, word, seg.offset);
      for (const pos of positions) {
        violations.push({
          word,
          tier: "hard_ban",
          position: pos,
          context: seg.context,
          suggestion: `Remove "${word}" — auto-flagged for removal`,
        });
      }
    }
  }

  // --- Tier 2: dialogue_exempt (flag in narration, permit in dialogue) ---
  for (const word of FORBIDDEN_WORDS.tiers.dialogue_exempt) {
    for (const seg of segments) {
      const positions = findWordPositions(seg.text, word, seg.offset);
      for (const pos of positions) {
        if (seg.context === "dialogue") {
          // Permitted in dialogue — track as cleared
          dialogueExemptCleared++;
          exemptedPositions.add(pos);
        } else {
          violations.push({
            word,
            tier: "dialogue_exempt",
            position: pos,
            context: "narration",
            suggestion: `"${word}" is banned in narration — permitted only in dialogue`,
          });
        }
      }
    }
  }

  // --- Tier 3: soft_ban (flag if count > threshold per chapter) ---
  const softBanConfig = FORBIDDEN_WORDS.tiers.soft_ban;
  for (const word of softBanConfig.words) {
    let totalCount = 0;
    const allPositions: { pos: number; ctx: TextContext }[] = [];

    for (const seg of segments) {
      const positions = findWordPositions(seg.text, word, seg.offset);
      totalCount += positions.length;
      for (const pos of positions) {
        allPositions.push({ pos, ctx: seg.context });
      }
    }

    if (totalCount > softBanConfig.threshold) {
      for (const { pos, ctx } of allPositions) {
        violations.push({
          word,
          tier: "soft_ban",
          position: pos,
          context: ctx,
          suggestion: `"${word}" appears ${totalCount}× (threshold: ${softBanConfig.threshold})`,
        });
      }
    }
  }

  // --- Tier 4: context_flag (flag in all contexts for human review — do NOT auto-remove) ---
  for (const word of FORBIDDEN_WORDS.tiers.context_flag) {
    for (const seg of segments) {
      const positions = findWordPositions(seg.text, word, seg.offset);
      for (const pos of positions) {
        // Skip if this position was already cleared by dialogue_exempt
        if (exemptedPositions.has(pos)) continue;

        violations.push({
          word,
          tier: "context_flag",
          position: pos,
          context: seg.context,
          suggestion: `"${word}" flagged for human review`,
        });
      }
    }
  }

  return {
    violations,
    hardBanCount: violations.filter((v) => v.tier === "hard_ban").length,
    softBanCount: violations.filter((v) => v.tier === "soft_ban").length,
    contextFlagCount: violations.filter((v) => v.tier === "context_flag").length,
    dialogueExemptCleared,
  };
}

// ---------------------------------------------------------------------------
// Expose for console testing
// ---------------------------------------------------------------------------

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_forbiddenWords = {
    checkChapter,
  };
}
