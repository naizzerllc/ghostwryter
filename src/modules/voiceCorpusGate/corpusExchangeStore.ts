/**
 * Voice Corpus Exchange Store — manages corpus exchange entries per character.
 * GHOSTLY v2.2 · Prompt 02
 *
 * Exchanges are tagged with pressure_state (arc point or pressure type).
 * Persisted to story-data/{projectId}/corpus/{characterId}.json via GitHub storage.
 * Chapter 1 generation blocked if ARC_START < 5 exchanges.
 */

import { githubStorage } from "@/storage/githubStorage";

// ── Types ───────────────────────────────────────────────────────────────

export type PressureState =
  | "ARC_START"
  | "ARC_MID"
  | "ARC_END"
  | "DEFLECTION"
  | "DECEPTION"
  | "COLLAPSE";

export const PRESSURE_STATES: PressureState[] = [
  "ARC_START", "ARC_MID", "ARC_END",
  "DEFLECTION", "DECEPTION", "COLLAPSE",
];

export interface CorpusExchange {
  id: string;
  pressure_state: PressureState;
  prompt: string;
  response: string;
  created_at: string;
}

export interface CharacterCorpus {
  character_id: string;
  exchanges: CorpusExchange[];
}

// ── State ───────────────────────────────────────────────────────────────

const corpora: Map<string, CharacterCorpus> = new Map();
const listeners: Set<() => void> = new Set();
let snapshotVersion = 0;

function notify() {
  snapshotVersion++;
  listeners.forEach(fn => fn());
}

// ── Persistence ─────────────────────────────────────────────────────────

function storagePath(characterId: string): string {
  const projectId = localStorage.getItem("ghostly_active_project") || "default";
  return `story-data/${projectId}/corpus/${characterId}.json`;
}

async function persist(characterId: string): Promise<void> {
  const corpus = corpora.get(characterId);
  if (!corpus) return;
  await githubStorage.saveFile(storagePath(characterId), JSON.stringify(corpus, null, 2));
}

export async function loadCorpus(characterId: string): Promise<CharacterCorpus> {
  const existing = corpora.get(characterId);
  if (existing) return existing;

  const raw = await githubStorage.loadFile(storagePath(characterId));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as CharacterCorpus;
      corpora.set(characterId, parsed);
      notify();
      return parsed;
    } catch {
      // corrupt — start fresh
    }
  }

  const fresh: CharacterCorpus = { character_id: characterId, exchanges: [] };
  corpora.set(characterId, fresh);
  return fresh;
}

// ── CRUD ────────────────────────────────────────────────────────────────

export async function addExchange(
  characterId: string,
  pressureState: PressureState,
  prompt: string,
  response: string,
): Promise<CorpusExchange> {
  let corpus = corpora.get(characterId);
  if (!corpus) {
    corpus = await loadCorpus(characterId);
  }

  const exchange: CorpusExchange = {
    id: `ex_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    pressure_state: pressureState,
    prompt,
    response,
    created_at: new Date().toISOString(),
  };

  corpus.exchanges.push(exchange);
  notify();
  await persist(characterId);
  return exchange;
}

export function removeExchange(characterId: string, exchangeId: string): boolean {
  const corpus = corpora.get(characterId);
  if (!corpus) return false;

  const idx = corpus.exchanges.findIndex(e => e.id === exchangeId);
  if (idx < 0) return false;

  corpus.exchanges.splice(idx, 1);
  notify();
  persist(characterId);
  return true;
}

// ── Queries ─────────────────────────────────────────────────────────────

export function getCorpus(characterId: string): CharacterCorpus | null {
  return corpora.get(characterId) ?? null;
}

export function getExchangeCount(characterId: string, pressureState: PressureState): number {
  const corpus = corpora.get(characterId);
  if (!corpus) return 0;
  return corpus.exchanges.filter(e => e.pressure_state === pressureState).length;
}

export function getArcCounts(characterId: string): Record<PressureState, number> {
  const result = {} as Record<PressureState, number>;
  for (const ps of PRESSURE_STATES) {
    result[ps] = getExchangeCount(characterId, ps);
  }
  return result;
}

/**
 * Check if Chapter 1 generation is blocked due to insufficient ARC_START exchanges.
 * Returns true if blocked (ARC_START < 5).
 */
export function isChapter1Blocked(characterId: string): boolean {
  return getExchangeCount(characterId, "ARC_START") < 5;
}

/**
 * Get full corpus text for gate evaluation — concatenates all exchanges.
 */
export function getCorpusText(characterId: string): string {
  const corpus = corpora.get(characterId);
  if (!corpus || corpus.exchanges.length === 0) return "";

  return corpus.exchanges
    .map(e => `[${e.pressure_state}]\nPrompt: ${e.prompt}\nResponse: ${e.response}`)
    .join("\n\n---\n\n");
}

// ── React integration ───────────────────────────────────────────────────

export interface CorpusSnapshot {
  corpora: Map<string, CharacterCorpus>;
  _v: number;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

let cachedSnapshot: CorpusSnapshot | null = null;

export function getSnapshot(): CorpusSnapshot {
  if (cachedSnapshot && cachedSnapshot._v === snapshotVersion) return cachedSnapshot;
  cachedSnapshot = { corpora, _v: snapshotVersion };
  return cachedSnapshot;
}

// ── Window registration ─────────────────────────────────────────────────
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_corpusExchange = {
    addExchange,
    removeExchange,
    loadCorpus,
    getCorpus,
    getArcCounts,
    isChapter1Blocked,
    getCorpusText,
  };
}
