/**
 * Character Database — full CRUD with 02C fields, GitHub persistence.
 * GHOSTLY v2.2 · S24
 *
 * Extends the characterDB module with per-project storage,
 * 7-dimension psychological sliders, and contradiction matrix validation.
 * Aligned to 02C character_record schema.
 */

import { githubStorage } from "@/storage/githubStorage";
import type {
  ContradictionMatrix,
  CharacterRole,
  VoiceCorpusStatus,
  VoiceReliability,
  PsychologicalSliders,
} from "@/modules/characterDB/types";

// Re-export types from canonical source
export type { CharacterRole, VoiceCorpusStatus, VoiceReliability, PsychologicalSliders };

// ── Extended Types (adds 7-dim sliders + full 02C fields) ───────────────

export interface FullPsychologicalSliders extends PsychologicalSliders {
  machiavellianism: number;
  empathy: number;
}

export interface FullCharacterRecord {
  id: string;
  project_id?: string;              // 02C
  name: string;
  role: CharacterRole;
  classification?: string;

  // Psychological core
  wound: string | null;
  flaw?: string | null;             // legacy compat
  want: string | null;
  need: string | null;
  self_deception: string | null;
  fear: string | null;

  // v1.9 additions
  external_goal: string | null;
  internal_desire: string | null;
  goal_desire_gap: string | null;

  // v2.0 — contradiction matrix
  contradiction_matrix?: ContradictionMatrix;

  // Antagonist-specific fields (null for non-antagonists) — 02C
  mirror_relationship?: string | null;
  antagonist_self_deception?: string | null;
  antagonist_limit?: string | null;
  antagonist_inversion_chapter?: number | null;
  antagonist_inversion_truth?: string | null;
  threat_arc?: string | null;

  // Arc tracking (02C)
  arc_entry_state?: string | null;
  arc_exit_state?: string | null;
  karma_arc?: string | null;
  // Legacy arc fields
  arc_start?: string;
  arc_end?: string;
  arc_lesson?: string;

  // Voice DNA
  compressed_voice_dna: string | null;

  // Psychological sliders (7 dimensions, -10 to +10)
  psychological_sliders?: FullPsychologicalSliders;

  // Voice corpus gate
  voice_corpus_status: VoiceCorpusStatus;
  voice_reliability: VoiceReliability;
  corpus_approved: boolean;
  corpus_approval_date?: string | null;  // 02C

  // Meta — 02C
  created_at?: string;
  last_updated?: string;
}

// Required fields — only hard requirements
const REQUIRED_FIELDS: (keyof FullCharacterRecord)[] = [
  "id", "name", "role",
];

export interface CharacterValidationError {
  field: string;
  message: string;
}

// ── State ───────────────────────────────────────────────────────────────

const characters: Map<string, FullCharacterRecord> = new Map();
const listeners: Set<() => void> = new Set();
let snapshotVersion = 0;

function notify() {
  snapshotVersion++;
  listeners.forEach(fn => fn());
}

// ── Validation ──────────────────────────────────────────────────────────

export function validateCharacter(record: Partial<FullCharacterRecord>): CharacterValidationError[] {
  const errors: CharacterValidationError[] = [];

  for (const field of REQUIRED_FIELDS) {
    const value = record[field];
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
      errors.push({ field, message: `${field} is required` });
    }
  }

  const validRoles: CharacterRole[] = ["protagonist", "antagonist", "major_supporting", "minor_supporting", "supporting"];
  if (record.role && !validRoles.includes(record.role)) {
    errors.push({ field: "role", message: `Invalid role: ${record.role}` });
  }

  if (record.compressed_voice_dna && record.compressed_voice_dna.length < 20) {
    errors.push({ field: "compressed_voice_dna", message: "Voice DNA too short — minimum 20 characters" });
  }

  // Voice DNA max 150 tokens (~600 chars rough estimate)
  if (record.compressed_voice_dna && record.compressed_voice_dna.length > 600) {
    errors.push({ field: "compressed_voice_dna", message: "Voice DNA exceeds ~150 token limit" });
  }

  // Psychological sliders range check
  if (record.psychological_sliders) {
    const s = record.psychological_sliders;
    for (const [key, val] of Object.entries(s)) {
      if (typeof val !== "number" || val < -10 || val > 10) {
        errors.push({ field: `psychological_sliders.${key}`, message: `Must be -10 to +10, got ${val}` });
      }
    }
  }

  // Contradiction matrix validation (v2.0)
  const cmErrors = validateContradictionMatrix(record);
  errors.push(...cmErrors);

  return errors;
}

// ── Contradiction Matrix Validation (v2.0) ──────────────────────────────

export function validateContradictionMatrix(record: Partial<FullCharacterRecord>): CharacterValidationError[] {
  const role = record.role;
  const matrix = record.contradiction_matrix;
  const errors: CharacterValidationError[] = [];

  if (role === "protagonist" || role === "antagonist") {
    if (!matrix?.behavioural?.stated_belief || !matrix?.behavioural?.actual_behaviour) {
      errors.push({ field: "contradiction_matrix.behavioural", message: `[${role}] stated_belief and actual_behaviour required` });
    }
    if (!matrix?.moral?.stated_principle || !matrix?.moral?.collapse_condition) {
      errors.push({ field: "contradiction_matrix.moral", message: `[${role}] stated_principle and collapse_condition required` });
    }
    if (!matrix?.historical?.past_action || !matrix?.historical?.self_narrative) {
      errors.push({ field: "contradiction_matrix.historical", message: `[${role}] past_action and self_narrative required` });
    }
    if (role === "protagonist") {
      if (!matrix?.historical?.gap) {
        errors.push({ field: "contradiction_matrix.historical.gap", message: "[protagonist] historical.gap required" });
      }
      if (!matrix?.competence?.exceptional_at || !matrix?.competence?.humiliated_by) {
        errors.push({ field: "contradiction_matrix.competence", message: "[protagonist] exceptional_at and humiliated_by required" });
      }
    }
  }

  return errors;
}

// ── CRUD ────────────────────────────────────────────────────────────────

export function addCharacter(record: FullCharacterRecord): { ok: boolean; errors?: CharacterValidationError[] } {
  const errors = validateCharacter(record);
  if (errors.length > 0) return { ok: false, errors };
  if (characters.has(record.id)) {
    return { ok: false, errors: [{ field: "id", message: `Character "${record.id}" already exists` }] };
  }
  const now = new Date().toISOString();
  characters.set(record.id, {
    ...record,
    voice_corpus_status: record.voice_corpus_status ?? "MISSING" as VoiceCorpusStatus,
    voice_reliability: record.voice_reliability ?? "MISSING",
    corpus_approved: record.corpus_approved ?? false,
    created_at: record.created_at ?? now,
    last_updated: record.last_updated ?? now,
  });
  notify();
  return { ok: true };
}

/**
 * Import-safe add — skips contradiction matrix validation so outline imports
 * can create protagonist/antagonist stubs that display "CM incomplete" badges.
 */
export function addCharacterFromImport(record: FullCharacterRecord): { ok: boolean; errors?: CharacterValidationError[] } {
  // Only validate basic required fields, not CM
  const errors: CharacterValidationError[] = [];
  for (const field of ["id", "name", "role"] as (keyof FullCharacterRecord)[]) {
    const value = record[field];
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
      errors.push({ field, message: `${field} is required` });
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  if (characters.has(record.id)) {
    return { ok: false, errors: [{ field: "id", message: `Character "${record.id}" already exists` }] };
  }
  const now = new Date().toISOString();
  characters.set(record.id, {
    ...record,
    voice_corpus_status: record.voice_corpus_status ?? "MISSING" as VoiceCorpusStatus,
    voice_reliability: record.voice_reliability ?? "MISSING",
    corpus_approved: record.corpus_approved ?? false,
    created_at: record.created_at ?? now,
    last_updated: record.last_updated ?? now,
  });
  notify();
  return { ok: true };
}

export function updateCharacter(id: string, updates: Partial<FullCharacterRecord>): { ok: boolean; errors?: CharacterValidationError[] } {
  const existing = characters.get(id);
  if (!existing) return { ok: false, errors: [{ field: "id", message: `Character "${id}" not found` }] };
  const merged = { ...existing, ...updates, id, last_updated: new Date().toISOString() };
  const errors = validateCharacter(merged);
  if (errors.length > 0) return { ok: false, errors };
  characters.set(id, merged);
  notify();
  return { ok: true };
}

export function removeCharacter(id: string): boolean {
  const deleted = characters.delete(id);
  if (deleted) notify();
  return deleted;
}

export function getCharacter(id: string): FullCharacterRecord | null {
  return characters.get(id) ?? null;
}

export function getAllCharacters(): FullCharacterRecord[] {
  return Array.from(characters.values());
}

export function getCharactersByRole(role: CharacterRole): FullCharacterRecord[] {
  return getAllCharacters().filter(c => c.role === role);
}

// ── Persistence ─────────────────────────────────────────────────────────

export async function saveCharacters(projectId: string): Promise<{ storage: string }> {
  const all = getAllCharacters();
  const result = await githubStorage.saveFile(
    `story-data/${projectId}/characters/character_db.json`,
    JSON.stringify(all, null, 2),
  );
  for (const c of all) {
    await githubStorage.saveFile(
      `story-data/${projectId}/characters/${c.id}.json`,
      JSON.stringify(c, null, 2),
    );
  }
  return { storage: result.storage };
}

export async function loadCharacters(projectId: string): Promise<{ loaded: number; errors: string[] }> {
  const raw = await githubStorage.loadFile(`story-data/${projectId}/characters/character_db.json`);
  if (!raw) return { loaded: 0, errors: [] };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { loaded: 0, errors: ["character_db.json is not an array"] };
    const errors: string[] = [];
    let loaded = 0;
    for (const record of parsed) {
      const validation = validateCharacter(record);
      if (validation.length > 0) {
        errors.push(`${record.id ?? "unknown"}: ${validation.map(v => v.message).join(", ")}`);
        continue;
      }
      characters.set(record.id, {
        ...record,
        voice_corpus_status: record.voice_corpus_status ?? "MISSING",
        voice_reliability: record.voice_reliability ?? "MISSING",
        corpus_approved: record.corpus_approved ?? false,
      });
      loaded++;
    }
    if (loaded > 0) notify();
    return { loaded, errors };
  } catch (err) {
    return { loaded: 0, errors: [err instanceof Error ? err.message : "Parse error"] };
  }
}

// ── React integration ───────────────────────────────────────────────────

export interface CharacterDBSnapshot {
  characters: FullCharacterRecord[];
  count: number;
  byRole: { protagonist: number; antagonist: number; major_supporting: number; minor_supporting: number; supporting: number };
  corpusApproved: number;
  corpusBlocked: number;
  _v: number;
}

let cachedSnapshot: CharacterDBSnapshot | null = null;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getSnapshot(): CharacterDBSnapshot {
  if (cachedSnapshot && cachedSnapshot._v === snapshotVersion) return cachedSnapshot;
  const all = getAllCharacters();
  cachedSnapshot = {
    characters: all,
    count: all.length,
    byRole: {
      protagonist: all.filter(c => c.role === "protagonist").length,
      antagonist: all.filter(c => c.role === "antagonist").length,
      major_supporting: all.filter(c => c.role === "major_supporting").length,
      minor_supporting: all.filter(c => c.role === "minor_supporting").length,
      supporting: all.filter(c => c.role === "supporting").length,
    },
    corpusApproved: all.filter(c => c.corpus_approved).length,
    corpusBlocked: all.filter(c => !c.corpus_approved).length,
    _v: snapshotVersion,
  };
  return cachedSnapshot;
}

// ── Window registration ─────────────────────────────────────────────────
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_characterDatabase = {
    addCharacter, updateCharacter, removeCharacter, getCharacter,
    getAllCharacters, getCharactersByRole, validateCharacter,
    saveCharacters, loadCharacters, getSnapshot,
  };
}
