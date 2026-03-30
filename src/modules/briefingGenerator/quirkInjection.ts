/**
 * Quirk Injection + Suppressed Evidence Brief — Briefing Generator injections.
 * GHOSTLY v2.2 · Session 15
 *
 * Quirk Injection: Injects character quirks into Tier 2 ONLY for warmth/calm scene types.
 * Suppressed Evidence Brief: R15 support — shows what the narrator must visibly avoid.
 */

import { ChapterOutlineRecord, getAllChapters } from "@/modules/outline/outlineSystem";
import { CharacterRecord } from "@/modules/characterDB/types";

// ── Types ───────────────────────────────────────────────────────────────

export interface QuirkInjectionResult {
  active: boolean;
  injections: string[];
  suppressed_scene_types: string[];
}

export interface SuppressedEvidenceItem {
  item: string;
  instruction: string;
  source_chapter_range: string;
}

export interface SuppressedEvidenceBrief {
  active: boolean;
  items: SuppressedEvidenceItem[];
}

// ── Constants ───────────────────────────────────────────────────────────

const QUIRK_PERMITTED_SCENE_TYPES = new Set([
  "WARMTH", "FALSE_CALM", "INTIMACY",
]);

const QUIRK_SUPPRESSED_SCENE_TYPES = new Set([
  "CRISIS", "ACTION", "CONFRONTATION", "REVELATION",
]);

// ── Quirk Injection ────────────────────────────────────────────────────

export function injectQuirks(
  chapter: ChapterOutlineRecord,
  characters: CharacterRecord[]
): QuirkInjectionResult {
  const sceneType = (chapter.scene_type ?? "").toUpperCase();

  // Check if scene type permits quirk injection
  if (!QUIRK_PERMITTED_SCENE_TYPES.has(sceneType)) {
    return {
      active: false,
      injections: [],
      suppressed_scene_types: QUIRK_SUPPRESSED_SCENE_TYPES.has(sceneType)
        ? [sceneType]
        : [],
    };
  }

  const injections: string[] = [];

  for (const character of characters) {
    // Check for quirk field on character record (extended field)
    const quirk = (character as Record<string, unknown>).quirk as string | undefined;
    if (quirk && quirk.trim().length > 0) {
      injections.push(
        `Character texture active: ${character.name} — ${quirk}. Allow this to surface naturally in behaviour or speech.`
      );
    }
  }

  return {
    active: injections.length > 0,
    injections,
    suppressed_scene_types: [],
  };
}

// ── Suppressed Evidence Brief (R15) ────────────────────────────────────

/**
 * From misdirection_map.suppressed_evidence for current act:
 * items the narrator must visibly avoid within ±3 chapters.
 */
export function buildSuppressedEvidenceBrief(
  currentChapter: number,
  projectId: string
): SuppressedEvidenceBrief {
  // Load suppressed evidence from outline data
  const allChapters = getAllChapters();
  const items: SuppressedEvidenceItem[] = [];

  // Look for chapters with suppressed_evidence field within ±3 range
  const rangeMin = currentChapter - 3;
  const rangeMax = currentChapter + 3;

  for (const ch of allChapters) {
    if (ch.chapter_number < rangeMin || ch.chapter_number > rangeMax) continue;
    if (ch.chapter_number === currentChapter) continue;

    const suppressed = (ch as Record<string, unknown>).suppressed_evidence as string | undefined;
    if (suppressed && suppressed.trim().length > 0) {
      items.push({
        item: suppressed,
        instruction: `Suppressed evidence active: ${suppressed}. The narrator must visibly not-look-at this. Show the avoidance — the deliberate turn away, the reframing, the deflection. Do not execute the suppressed content invisibly.`,
        source_chapter_range: `Ch${ch.chapter_number} (±3 of Ch${currentChapter})`,
      });
    }
  }

  // Also check current chapter's own suppressed_evidence
  const currentCh = allChapters.find(c => c.chapter_number === currentChapter);
  if (currentCh) {
    const suppressed = (currentCh as Record<string, unknown>).suppressed_evidence as string | undefined;
    if (suppressed && suppressed.trim().length > 0) {
      items.push({
        item: suppressed,
        instruction: `Suppressed evidence active: ${suppressed}. The narrator must visibly not-look-at this. Show the avoidance — the deliberate turn away, the reframing, the deflection. Do not execute the suppressed content invisibly.`,
        source_chapter_range: `Ch${currentChapter} (current)`,
      });
    }
  }

  return {
    active: items.length > 0,
    items,
  };
}
