/**
 * Character Database — full CRUD with MIC v2.0 fields, GitHub persistence.
 * GHOSTLY v2.2 · S24
 *
 * Extends the Prompt 02 characterDB module with per-project storage,
 * 7-dimension psychological sliders, and contradiction matrix validation.
 */

import { githubStorage } from "@/storage/githubStorage";
import type { ContradictionMatrix } from "@/modules/characterDB/types";

// ── Types ───────────────────────────────────────────────────────────────

export type CharacterRole = "protagonist" | "antagonist" | "supporting";
export type VoiceCorpusStatus = "COMPLETE" | "PARTIAL" | "MISSING";
export type VoiceReliability = "HIGH" | "MISSING";

export interface PsychologicalSliders {
  openness: number;            // -10 to +10
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  machiavellianism: number;
  empathy: number;
}

export interface FullCharacterRecord {
  id: string;
  name: string;
  role: CharacterRole;
  classification?: string;

  // Psychological core
  wound: string;
  flaw: string;
  want: string;
  need: string;
  self_deception: string;
  fear: string;

  // Arc
  arc_start: string;
  arc_end: string;
  arc_lesson: string;

  // Voice DNA
  compressed_voice_dna: string;  // max 150 tokens

  // v1.9 additions
  external_goal: string;
  internal_desire: string;
  goal_desire_gap: string;

  // v2.0 addition — contradiction matrix
  contradiction_matrix?: ContradictionMatrix;

  // Psychological sliders (7 dimensions, -10 to +10)
  psychological_sliders?: PsychologicalSliders;

  // Voice corpus gate
  voice_corpus_status: VoiceCorpusStatus;
  voice_reliability: VoiceReliability;
  corpus_approved: boolean;
}

// Required fields for protagonist/antagonist
const REQUIRED_FIELDS: (keyof FullCharacterRecord)[] = [
  "id", "name", "role", "wound", "flaw", "want", "need",
  "self_deception", "fear", "arc_start", "arc_end", "arc_lesson",
  "compressed_voice_dna", "external_goal", "internal_desire", "goal_desire_gap",
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

  if (record.role && !["protagonist", "antagonist", "supporting"].includes(record.role)) {
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

// ── CRUD ────────────────────────────────────────────────────────────────

export function addCharacter(record: FullCharacterRecord): { ok: boolean; errors?: CharacterValidationError[] } {
  const errors = validateCharacter(record);
  if (errors.length > 0) return { ok: false, errors };
  if (characters.has(record.id)) {
    return { ok: false, errors: [{ field: "id", message: `Character "${record.id}" already exists` }] };
  }
  characters.set(record.id, {
    ...record,
    voice_corpus_status: record.voice_corpus_status ?? "MISSING",
    voice_reliability: record.voice_reliability ?? "MISSING",
    corpus_approved: record.corpus_approved ?? false,
  });
  notify();
  return { ok: true };
}

export function updateCharacter(id: string, updates: Partial<FullCharacterRecord>): { ok: boolean; errors?: CharacterValidationError[] } {
  const existing = characters.get(id);
  if (!existing) return { ok: false, errors: [{ field: "id", message: `Character "${id}" not found` }] };
  const merged = { ...existing, ...updates, id };
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
  // Also save individual files
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
  byRole: { protagonist: number; antagonist: number; supporting: number };
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
