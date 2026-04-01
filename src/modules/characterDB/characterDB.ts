/**
 * Character DB — In-memory character store with GitHub persistence.
 * GHOSTLY v2.2 · Aligned to 02C character_record schema.
 *
 * All characters stored as character_record per MIC v2.1.
 * Voice DNA lives on each record as compressed_voice_dna.
 * Antagonist/supporting routing: gemini_pro (NEVER anthropic).
 */

import { githubStorage } from "@/storage/githubStorage";
import {
  CharacterRecord,
  CharacterRole,
  CHARACTER_REQUIRED_FIELDS,
  CHARACTER_RECOMMENDED_FIELDS,
} from "./types";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const characters: Map<string, CharacterRecord> = new Map();
const listeners: Set<() => void> = new Set();
let snapshotVersion = 0;

function notify() {
  snapshotVersion++;
  listeners.forEach((fn) => fn());
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationError {
  field: string;
  message: string;
}

export function validateCharacter(
  record: Partial<CharacterRecord>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of CHARACTER_REQUIRED_FIELDS) {
    const value = record[field];
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
      errors.push({ field, message: `${field} is required` });
    }
  }

  // Role validation — 02C subtypes
  const validRoles: CharacterRole[] = ["protagonist", "antagonist", "major_supporting", "minor_supporting", "supporting"];
  if (record.role && !validRoles.includes(record.role)) {
    errors.push({ field: "role", message: `Invalid role: ${record.role}` });
  }

  // Voice DNA minimum length check
  if (record.compressed_voice_dna && record.compressed_voice_dna.length < 20) {
    errors.push({
      field: "compressed_voice_dna",
      message: "Voice DNA too short — minimum 20 characters for meaningful fingerprint",
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function addCharacter(record: CharacterRecord): { ok: boolean; errors?: ValidationError[] } {
  const errors = validateCharacter(record);
  if (errors.length > 0) return { ok: false, errors };

  if (characters.has(record.id)) {
    return { ok: false, errors: [{ field: "id", message: `Character "${record.id}" already exists` }] };
  }

  const now = new Date().toISOString();
  const stored: CharacterRecord = {
    ...record,
    voice_corpus_status: record.voice_corpus_status ?? "PENDING",
    voice_reliability: record.voice_reliability ?? "MISSING",
    corpus_approved: record.corpus_approved ?? false,
    created_at: record.created_at ?? now,
    last_updated: record.last_updated ?? now,
  };

  characters.set(record.id, stored);
  notify();
  return { ok: true };
}

export function updateCharacter(
  id: string,
  updates: Partial<CharacterRecord>
): { ok: boolean; errors?: ValidationError[] } {
  const existing = characters.get(id);
  if (!existing) {
    return { ok: false, errors: [{ field: "id", message: `Character "${id}" not found` }] };
  }

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

export function getCharacter(id: string): CharacterRecord | null {
  return characters.get(id) ?? null;
}

export function getAllCharacters(): CharacterRecord[] {
  return Array.from(characters.values());
}

export function getCharactersByRole(role: CharacterRole): CharacterRecord[] {
  return getAllCharacters().filter((c) => c.role === role);
}

// ---------------------------------------------------------------------------
// Persistence (GitHub primary, localStorage fallback)
// ---------------------------------------------------------------------------

const STORAGE_PATH = "characters/character_db.json";

export async function saveToStorage(): Promise<{ storage: string }> {
  const data = JSON.stringify(getAllCharacters(), null, 2);
  const result = await githubStorage.saveFile(STORAGE_PATH, data);
  return { storage: result.storage };
}

export async function loadFromStorage(): Promise<{ loaded: number; errors: string[] }> {
  const raw = await githubStorage.loadFile(STORAGE_PATH);
  if (!raw) return { loaded: 0, errors: [] };

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { loaded: 0, errors: ["character_db.json is not an array"] };
    }

    const errors: string[] = [];
    let loaded = 0;

    for (const record of parsed) {
      const validation = validateCharacter(record);
      if (validation.length > 0) {
        errors.push(`${record.id ?? "unknown"}: ${validation.map((v) => v.message).join(", ")}`);
        continue;
      }
      characters.set(record.id, {
        ...record,
        voice_corpus_status: record.voice_corpus_status ?? "PENDING",
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

// ---------------------------------------------------------------------------
// React integration
// ---------------------------------------------------------------------------

export interface CharacterDBSnapshot {
  characters: CharacterRecord[];
  count: number;
  byRole: { protagonist: number; antagonist: number; major_supporting: number; minor_supporting: number; supporting: number };
  voiceDnaComplete: number;
  voiceDnaMissing: number;
  _v: number;
}

let cachedSnapshot: CharacterDBSnapshot | null = null;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): CharacterDBSnapshot {
  if (cachedSnapshot && cachedSnapshot._v === snapshotVersion) return cachedSnapshot;

  const all = getAllCharacters();
  cachedSnapshot = {
    characters: all,
    count: all.length,
    byRole: {
      protagonist: all.filter((c) => c.role === "protagonist").length,
      antagonist: all.filter((c) => c.role === "antagonist").length,
      major_supporting: all.filter((c) => c.role === "major_supporting").length,
      minor_supporting: all.filter((c) => c.role === "minor_supporting").length,
      supporting: all.filter((c) => c.role === "supporting").length,
    },
    voiceDnaComplete: all.filter((c) => c.voice_reliability === "HIGH").length,
    voiceDnaMissing: all.filter((c) => c.voice_reliability === "MISSING").length,
    _v: snapshotVersion,
  };
  return cachedSnapshot;
}

// ---------------------------------------------------------------------------
// Window registration for console testing
// ---------------------------------------------------------------------------
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_characterDB = {
    addCharacter,
    updateCharacter,
    removeCharacter,
    getCharacter,
    getAllCharacters,
    getCharactersByRole,
    validateCharacter,
    saveToStorage,
    loadFromStorage,
    getSnapshot,
  };
}
