/**
 * Karma Tracker — Tracks moral-consequence events per character.
 * GHOSTLY v2.2 · Session 13
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface KarmaEvent {
  character_id: string;
  chapter: number;
  event_type: "moral_debt" | "consequence_pending" | "consequence_delivered";
  description: string;
  logged_at: string;
}

export interface KarmaPosition {
  character_id: string;
  moral_debt: string;
  consequence_pending: boolean;
  consequence_chapter: number | null;
  consequence_delivered: boolean;
  events: KarmaEvent[];
}

export interface KarmaCheckResult {
  chapter: number;
  undelivered: KarmaPosition[];
  overdue: KarmaPosition[];
  compliant: boolean;
  message: string;
}

// ── Storage ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "ghostly_karma_tracker";

function loadKarma(): KarmaPosition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveKarma(positions: KarmaPosition[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

// ── Public API ──────────────────────────────────────────────────────────

export function getAllKarmaPositions(): KarmaPosition[] {
  return loadKarma();
}

export function getKarmaForCharacter(characterId: string): KarmaPosition | undefined {
  return loadKarma().find((k) => k.character_id === characterId);
}

export function updateKarma(
  characterId: string,
  chapter: number,
  event: {
    event_type: KarmaEvent["event_type"];
    description: string;
    consequence_chapter?: number;
  }
): void {
  const positions = loadKarma();
  let pos = positions.find((k) => k.character_id === characterId);

  if (!pos) {
    pos = {
      character_id: characterId,
      moral_debt: "",
      consequence_pending: false,
      consequence_chapter: null,
      consequence_delivered: false,
      events: [],
    };
    positions.push(pos);
  }

  const karmaEvent: KarmaEvent = {
    character_id: characterId,
    chapter,
    event_type: event.event_type,
    description: event.description,
    logged_at: new Date().toISOString(),
  };

  pos.events.push(karmaEvent);

  switch (event.event_type) {
    case "moral_debt":
      pos.moral_debt = event.description;
      pos.consequence_pending = true;
      if (event.consequence_chapter) {
        pos.consequence_chapter = event.consequence_chapter;
      }
      break;
    case "consequence_pending":
      pos.consequence_pending = true;
      if (event.consequence_chapter) {
        pos.consequence_chapter = event.consequence_chapter;
      }
      break;
    case "consequence_delivered":
      pos.consequence_delivered = true;
      pos.consequence_pending = false;
      break;
  }

  saveKarma(positions);
}

/**
 * Check karma delivery at a given chapter.
 * Returns overdue consequences (consequence_chapter <= chapterNumber but not delivered).
 */
export function checkKarmaDelivery(chapterNumber: number): KarmaCheckResult {
  const positions = loadKarma();

  const undelivered = positions.filter(
    (p) => p.consequence_pending && !p.consequence_delivered
  );

  const overdue = undelivered.filter(
    (p) =>
      p.consequence_chapter !== null && p.consequence_chapter <= chapterNumber
  );

  return {
    chapter: chapterNumber,
    undelivered,
    overdue,
    compliant: overdue.length === 0,
    message:
      overdue.length > 0
        ? `⚠ ${overdue.length} overdue karma consequence(s) at Chapter ${chapterNumber}`
        : `✓ All karma consequences on track at Chapter ${chapterNumber}`,
  };
}

/**
 * Remove all karma data (for project reset).
 */
export function clearKarma(): void {
  localStorage.removeItem(STORAGE_KEY);
}
