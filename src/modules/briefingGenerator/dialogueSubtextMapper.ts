/**
 * Dialogue Subtext Mapper — Generates subtext targets for dialogue scenes.
 * GHOSTLY v2.2 · Session 15
 *
 * For each dialogue scene in a chapter, derives:
 * - Surface topic (what characters appear to discuss)
 * - Subtext topic (what the exchange is actually about)
 * - Carry requirement (who controls the subtext, what remains unsaid)
 * - No-subtext flag (surface === subtext → revision required)
 */

import { ChapterOutlineRecord } from "@/modules/outline/outlineSystem";
import { CharacterRecord } from "@/modules/characterDB/types";
import { LivingState } from "@/modules/livingState/livingState";

// ── Types ───────────────────────────────────────────────────────────────

export interface SubtextTarget {
  scene_position: "early" | "mid" | "late";
  surface_topic: string;
  subtext_topic: string;
  carrying_character: string;
  unsaid_requirement: string;
  subtext_check_instruction: string;
  corpus_tell_note?: string;
  no_subtext_flag: boolean;
}

// ── Subtext Derivation ─────────────────────────────────────────────────

const SUBTEXT_DOMAINS: Record<string, string[]> = {
  power: ["control", "authority", "dominance", "submission", "hierarchy", "command", "obey"],
  concealment: ["hide", "secret", "cover", "mask", "pretend", "conceal", "lie", "deny"],
  desire: ["want", "need", "crave", "long", "yearn", "hunger", "attract"],
  fear: ["afraid", "dread", "terror", "anxiety", "panic", "avoid", "flee", "threat"],
  betrayal: ["trust", "loyal", "betray", "deceive", "abandon", "manipulate"],
  guilt: ["blame", "shame", "regret", "responsible", "fault", "sorry", "atone"],
};

function inferSubtextDomain(scenePurpose: string, characters: CharacterRecord[]): string {
  const purposeLower = scenePurpose.toLowerCase();

  // Check scene purpose against domains
  for (const [domain, keywords] of Object.entries(SUBTEXT_DOMAINS)) {
    if (keywords.some(kw => purposeLower.includes(kw))) {
      return domain;
    }
  }

  // Infer from character psychology
  const protagonist = characters.find(c => c.role === "protagonist");
  if (protagonist) {
    const selfDeception = protagonist.self_deception.toLowerCase();
    for (const [domain, keywords] of Object.entries(SUBTEXT_DOMAINS)) {
      if (keywords.some(kw => selfDeception.includes(kw))) {
        return domain;
      }
    }
  }

  return "concealment"; // Default for psychological thriller
}

function deriveSurfaceTopic(chapter: ChapterOutlineRecord): string {
  const purpose = chapter.scene_purpose;
  // Extract the apparent topic — what it looks like the scene is about
  if (purpose.length > 80) return purpose.slice(0, 80);
  return purpose;
}

function deriveSubtextTopic(
  domain: string,
  chapter: ChapterOutlineRecord,
  characters: CharacterRecord[]
): string {
  const protagonist = characters.find(c => c.role === "protagonist");
  const selfDeception = protagonist?.self_deception ?? "unknown truth";

  const templates: Record<string, string> = {
    power: `Power negotiation — who controls this exchange and what leverage is being tested`,
    concealment: `Active concealment — protecting ${selfDeception.slice(0, 60)}`,
    desire: `Unspoken desire — what the protagonist actually wants vs. what they're asking for`,
    fear: `Fear management — the dread beneath the composure`,
    betrayal: `Trust architecture — loyalty being tested or weaponised`,
    guilt: `Guilt displacement — responsibility being deflected or absorbed`,
  };

  return templates[domain] ?? `Concealed emotional truth beneath surface exchange`;
}

function identifyCarryingCharacter(
  characters: CharacterRecord[],
  chapter: ChapterOutlineRecord,
  livingState: LivingState
): string {
  // The carrying character is whoever has the most to hide in this scene
  const protagonist = characters.find(c => c.role === "protagonist");
  const antagonist = characters.find(c => c.role === "antagonist");

  // Check living state for trust levels
  const protSlider = livingState.character_sliders.find(
    s => s.character_id === protagonist?.id
  );
  const antSlider = livingState.character_sliders.find(
    s => s.character_id === antagonist?.id
  );

  // If antagonist trust is high, protagonist carries (they're being deceived)
  // If antagonist trust is low, antagonist carries (they're managing perception)
  if (antSlider && antSlider.trust_level > 6) {
    return protagonist?.name ?? "protagonist";
  }

  return antagonist?.name ?? protagonist?.name ?? "protagonist";
}

function buildCorpusTellNote(character: CharacterRecord): string | undefined {
  // Check if character's voice DNA contains subtext tell patterns
  const dna = character.compressed_voice_dna.toLowerCase();
  const tellPatterns = [
    "deflects with", "avoids by", "redirects to", "masks with",
    "covers using", "tells through", "leaks via",
  ];

  for (const pattern of tellPatterns) {
    const idx = dna.indexOf(pattern);
    if (idx !== -1) {
      const excerpt = character.compressed_voice_dna.slice(idx, idx + 120);
      return `This character's subtext typically surfaces via: ${excerpt}. If subtext is too visible, revise using this tell.`;
    }
  }

  return undefined;
}

// ── Public API ──────────────────────────────────────────────────────────

export function buildSubtextTargets(
  chapterOutline: ChapterOutlineRecord,
  characters: CharacterRecord[],
  livingState: LivingState
): SubtextTarget[] {
  if (!chapterOutline || characters.length === 0) return [];

  const targets: SubtextTarget[] = [];
  const domain = inferSubtextDomain(chapterOutline.scene_purpose, characters);
  const surfaceTopic = deriveSurfaceTopic(chapterOutline);
  const subtextTopic = deriveSubtextTopic(domain, chapterOutline, characters);
  const carryingCharacter = identifyCarryingCharacter(characters, chapterOutline, livingState);

  // Determine if surface and subtext are effectively identical (no-subtext flag)
  const noSubtext = surfaceTopic.toLowerCase().trim() === subtextTopic.toLowerCase().trim();

  // Build corpus tell notes for relevant characters
  const protagonist = characters.find(c => c.role === "protagonist");
  const corpusTell = protagonist ? buildCorpusTellNote(protagonist) : undefined;

  // Generate subtext targets for scene positions
  const positions: Array<"early" | "mid" | "late"> = ["early", "mid", "late"];
  const scenePositionCount = chapterOutline.tension_score_target >= 7 ? 3 : 2;

  for (let i = 0; i < scenePositionCount; i++) {
    const position = positions[i];
    const unsaidReq = position === "early"
      ? `${carryingCharacter} must not acknowledge what they already know about the situation`
      : position === "mid"
        ? `The real question must remain unasked — pressure builds through proxy topics`
        : `Subtext surfaces through action or silence, never through direct statement`;

    targets.push({
      scene_position: position,
      surface_topic: surfaceTopic,
      subtext_topic: subtextTopic,
      carrying_character: carryingCharacter,
      unsaid_requirement: unsaidReq,
      subtext_check_instruction: `Verify dialogue carries ${domain} subtext. Surface topic should mask true exchange. If subtext is invisible on close read, strengthen. If subtext is obvious on first read, attenuate.`,
      corpus_tell_note: corpusTell,
      no_subtext_flag: noSubtext,
    });
  }

  return targets;
}
