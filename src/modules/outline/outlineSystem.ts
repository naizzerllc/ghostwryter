/**
 * Outline System — Loads and navigates the chapter outline.
 * GHOSTLY v2.2 · Session 13
 */

import { githubStorage } from "@/storage/githubStorage";

// ── Types ───────────────────────────────────────────────────────────────

export interface StructuralAnchor {
  type: "inciting_incident" | "all_is_lost" | "revelation";
  chapter_number: number;
  label: string;
}

export interface ChapterOutlineRecord {
  chapter_number: number;
  timeline_id: string;
  scene_purpose: string;
  hook_type: string;
  hook_seed: string;
  opening_type: string;
  opening_seed: string;
  tension_score_target: number;
  narrator_deception_gesture?: string;
  collision_specification: string;
  permanent_change: string;
  protagonist_decision_type: string;
  reader_information_mode?: string;
  compulsion_floor_note?: string;
  act: 1 | 2 | 3;
  scene_type?: string;
  approved?: boolean;
  emotional_resonance_target?: string | null;
  relationship_pivot?: boolean;
  pivot_pair?: "PAIR_1" | "PAIR_2" | "PAIR_3" | null;
  pivot_act?: 1 | 2 | 3 | null;
  [key: string]: unknown;
}

export interface RelationshipPivotRecord {
  chapter: number;
  surface_event: string;
  beneath_surface: string;
  subtext_exchange: string;
  what_changes: string;
}

export interface RelationshipPairRecord {
  characters: string;
  relationship_type: "TRUST_EROSION_ARC" | "EMOTIONAL_BALLAST" | "THEMATIC_WEIGHT";
  act_1_pivot: RelationshipPivotRecord;
  act_2_pivot: RelationshipPivotRecord;
  act_3_pivot: RelationshipPivotRecord;
}

export interface RelationshipArchitecture {
  PAIR_1: RelationshipPairRecord;
  PAIR_2: RelationshipPairRecord;
  PAIR_3: RelationshipPairRecord;
}

interface OutlineData {
  schema_version?: string;
  relationship_architecture?: RelationshipArchitecture;
  project_config?: {
    genre_mode?: string;
    revelation_chapter?: number;
    inciting_incident_chapter?: number;
    all_is_lost_chapter?: number;
    [key: string]: unknown;
  };
  chapters?: ChapterOutlineRecord[];
  subplot_registry?: SubplotRecord[];
  [key: string]: unknown;
}

export interface SubplotRecord {
  subplot_id: string;
  subplot_description: string;
  introduced_chapter: number;
  subplot_type: string;
  resolution_chapter: number;
  act_2_touch_minimum: number;
  act_2_touch_log: number[];
  touch_count_total: number;
}

// ── Storage ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "ghostly_outline_data";

function loadOutlineData(): OutlineData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOutlineData(data: OutlineData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Populate the outline system from imported raw JSON.
 * Parses chapters, project_config, subplot_registry, and relationship_architecture.
 * Returns the number of chapters stored.
 */
export function populateFromImport(rawJson: string): number {
  try {
    const parsed = JSON.parse(rawJson);
    const data: OutlineData = {};

    if (parsed.project_config && typeof parsed.project_config === "object") {
      data.project_config = parsed.project_config;
    }

    if (Array.isArray(parsed.chapters)) {
      data.chapters = parsed.chapters;
    }

    if (Array.isArray(parsed.subplot_registry)) {
      data.subplot_registry = parsed.subplot_registry;
    }

    if (parsed.relationship_architecture && typeof parsed.relationship_architecture === "object") {
      data.relationship_architecture = parsed.relationship_architecture;
    }

    if (parsed.schema_version) {
      data.schema_version = parsed.schema_version;
    }

    saveOutlineData(data);
    return data.chapters?.length ?? 0;
  } catch {
    return 0;
  }
}

// ── Public API ──────────────────────────────────────────────────────────

export function getChapter(chapterNumber: number): ChapterOutlineRecord | undefined {
  const data = loadOutlineData();
  return data.chapters?.find((c) => c.chapter_number === chapterNumber);
}

export function getAllChapters(): ChapterOutlineRecord[] {
  const data = loadOutlineData();
  return (data.chapters ?? []).sort((a, b) => a.chapter_number - b.chapter_number);
}

export function getActChapters(act: 1 | 2 | 3): ChapterOutlineRecord[] {
  return getAllChapters().filter((c) => c.act === act);
}

export function updateChapterField(
  chapterNumber: number,
  field: string,
  value: unknown
): void {
  const data = loadOutlineData();
  if (!data.chapters) return;
  const idx = data.chapters.findIndex((c) => c.chapter_number === chapterNumber);
  if (idx === -1) return;
  (data.chapters[idx] as Record<string, unknown>)[field] = value;
  saveOutlineData(data);
}

export function getRevelationChapter(): number {
  const data = loadOutlineData();
  return data.project_config?.revelation_chapter ?? 22;
}

export function getStructuralAnchors(): StructuralAnchor[] {
  const data = loadOutlineData();
  const config = data.project_config;
  const anchors: StructuralAnchor[] = [];

  if (config?.inciting_incident_chapter) {
    anchors.push({
      type: "inciting_incident",
      chapter_number: config.inciting_incident_chapter,
      label: "Inciting Incident",
    });
  }
  if (config?.all_is_lost_chapter) {
    anchors.push({
      type: "all_is_lost",
      chapter_number: config.all_is_lost_chapter,
      label: "All Is Lost",
    });
  }
  if (config?.revelation_chapter) {
    anchors.push({
      type: "revelation",
      chapter_number: config.revelation_chapter,
      label: "Revelation",
    });
  }

  return anchors.sort((a, b) => a.chapter_number - b.chapter_number);
}

export function getGenreMode(): string {
  const data = loadOutlineData();
  return data.project_config?.genre_mode ?? "psychological_thriller";
}

export function getSubplotRegistry(): SubplotRecord[] {
  const data = loadOutlineData();
  return data.subplot_registry ?? [];
}

/**
 * Load outline from GitHub storage into localStorage.
 */
export async function loadOutlineFromGitHub(projectId: string): Promise<boolean> {
  try {
    const raw = await githubStorage.loadFile(`story-data/${projectId}/outline.json`);
    if (raw) {
      const parsed = JSON.parse(raw);
      saveOutlineData(parsed);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ── Relationship Architecture Approval Gate (S24D) ──────────────────────

export interface OutlineApprovalError {
  type: string;
  severity: "BLOCKING" | "WARNING";
  message: string;
}

export function validateRelationshipArchitecture(): OutlineApprovalError[] {
  const errors: OutlineApprovalError[] = [];
  const data = loadOutlineData();
  const relArch = data.relationship_architecture;

  if (!relArch) {
    errors.push({
      type: "RELATIONSHIP_ARCHITECTURE_ABSENT",
      severity: "BLOCKING",
      message: "Outline approval blocked: relationship_architecture block is absent. Complete all three relationship pairs with nine pivot moments before approval.",
    });
    return errors;
  }

  const pairs = ["PAIR_1", "PAIR_2", "PAIR_3"] as const;
  const acts = ["act_1_pivot", "act_2_pivot", "act_3_pivot"] as const;

  for (const pair of pairs) {
    const pairData = relArch[pair];
    if (!pairData) {
      errors.push({
        type: "RELATIONSHIP_PIVOT_INCOMPLETE",
        severity: "BLOCKING",
        message: `Outline approval blocked: ${pair} is missing entirely.`,
      });
      continue;
    }
    for (const act of acts) {
      const pivot = pairData[act];
      if (!pivot || !pivot.chapter || !pivot.what_changes) {
        errors.push({
          type: "RELATIONSHIP_PIVOT_INCOMPLETE",
          severity: "BLOCKING",
          message: `Outline approval blocked: ${pair} ${act} is incomplete. All nine pivot moments must be fully specified.`,
        });
      }
    }
  }

  // Check PAIR_2 Act 2 specifically (emotional ballast priority)
  const pair2Act2 = relArch.PAIR_2?.act_2_pivot;
  if (!pair2Act2 || !pair2Act2.chapter) {
    errors.push({
      type: "EMOTIONAL_BALLAST_ACT2_ABSENT",
      severity: "WARNING",
      message: "No PAIR_2 (emotional ballast) pivot specified for Act 2. This is the act's highest-resonance chapter requirement.",
    });
  }

  return errors;
}
