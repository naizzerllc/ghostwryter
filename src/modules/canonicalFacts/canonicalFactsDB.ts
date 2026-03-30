/**
 * Canonical Facts Database — immutable story facts extracted from outline/chapters.
 * GHOSTLY v2.2 · S11
 *
 * Categories: CHARACTER_FACT, TIMELINE_FACT, LOCATION_FACT, REVELATION_FACT, BACKSTORY_FACT
 * REVELATION_FACTs are hidden from fact-check context until chapter ≥ revelation_chapter.
 * Persisted to story-data/{projectId}/canonical_facts.json.
 */

import { githubStorage } from "@/storage/githubStorage";
import { callWithFallback, type TaskType } from "@/api/llmRouter";

// ── Types ───────────────────────────────────────────────────────────────

export type FactCategory =
  | "CHARACTER_FACT"
  | "TIMELINE_FACT"
  | "LOCATION_FACT"
  | "REVELATION_FACT"
  | "BACKSTORY_FACT";

export interface CanonicalFact {
  fact_id: string;
  category: FactCategory;
  statement: string;
  source_chapter: number | null;
  established_at_chapter: number;
  revelation_chapter?: number; // REVELATION_FACTs only — hidden until this chapter
  characters_involved: string[];
  confidence: "CONFIRMED" | "INFERRED";
  created_at: string;
  updated_at: string;
}

export interface FactCheckResult {
  consistent: boolean;
  conflicting_facts: CanonicalFact[];
  explanation: string;
  checked_against_count: number;
}

export interface ExtractionResult {
  facts: CanonicalFact[];
  extraction_errors: string[];
}

// ── State ───────────────────────────────────────────────────────────────

const facts: Map<string, CanonicalFact> = new Map();
const listeners: Set<() => void> = new Set();
let snapshotVersion = 0;
let currentProjectId = "";

function notify() {
  snapshotVersion++;
  listeners.forEach(fn => fn());
}

// ── Persistence ─────────────────────────────────────────────────────────

function storagePath(): string {
  return `story-data/${currentProjectId || "default"}/canonical_facts.json`;
}

async function persist(): Promise<void> {
  const data = JSON.stringify(Array.from(facts.values()), null, 2);
  await githubStorage.saveFile(storagePath(), data);
}

export async function loadFacts(projectId: string): Promise<{ loaded: number; errors: string[] }> {
  currentProjectId = projectId;
  const raw = await githubStorage.loadFile(storagePath());
  if (!raw) return { loaded: 0, errors: [] };

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { loaded: 0, errors: ["canonical_facts.json is not an array"] };

    const errors: string[] = [];
    let loaded = 0;

    for (const f of parsed) {
      if (!f.fact_id || !f.statement) {
        errors.push("Invalid fact record: missing fact_id or statement");
        continue;
      }
      facts.set(f.fact_id, f as CanonicalFact);
      loaded++;
    }

    if (loaded > 0) notify();
    return { loaded, errors };
  } catch (err) {
    return { loaded: 0, errors: [err instanceof Error ? err.message : "Parse error"] };
  }
}

// ── CRUD ────────────────────────────────────────────────────────────────

export function addFact(fact: CanonicalFact): { ok: boolean; error?: string } {
  if (!fact.fact_id || !fact.statement) {
    return { ok: false, error: "fact_id and statement are required" };
  }
  if (facts.has(fact.fact_id)) {
    return { ok: false, error: `Fact "${fact.fact_id}" already exists` };
  }

  const now = new Date().toISOString();
  facts.set(fact.fact_id, {
    ...fact,
    created_at: fact.created_at || now,
    updated_at: now,
  });
  notify();
  persist();
  return { ok: true };
}

export function updateFact(
  factId: string,
  updates: Partial<Omit<CanonicalFact, "fact_id">>,
): { ok: boolean; error?: string } {
  const existing = facts.get(factId);
  if (!existing) return { ok: false, error: `Fact "${factId}" not found` };

  facts.set(factId, {
    ...existing,
    ...updates,
    fact_id: factId,
    updated_at: new Date().toISOString(),
  });
  notify();
  persist();
  return { ok: true };
}

export function removeFact(factId: string): boolean {
  const deleted = facts.delete(factId);
  if (deleted) {
    notify();
    persist();
  }
  return deleted;
}

export function getFact(factId: string): CanonicalFact | null {
  return facts.get(factId) ?? null;
}

export function getAllFacts(): CanonicalFact[] {
  return Array.from(facts.values());
}

export function getFactsByCategory(category: FactCategory): CanonicalFact[] {
  return getAllFacts().filter(f => f.category === category);
}

// ── Fact Check ──────────────────────────────────────────────────────────

/**
 * Check a claim against canonical facts for a given chapter number.
 * REVELATION_FACTs are excluded from context if chapterNumber < revelation_chapter.
 */
export function checkFact(claim: string, chapterNumber: number): FactCheckResult {
  const visibleFacts = getAllFacts().filter(f => {
    // REVELATION_FACTs are hidden until narrator reaches revelation_chapter
    if (f.category === "REVELATION_FACT" && f.revelation_chapter) {
      return chapterNumber >= f.revelation_chapter;
    }
    // Facts established after the current chapter are not yet known
    if (f.established_at_chapter > chapterNumber) return false;
    return true;
  });

  const claimLower = claim.toLowerCase();
  const conflicting: CanonicalFact[] = [];

  for (const fact of visibleFacts) {
    const factLower = fact.statement.toLowerCase();
    // Simple conflict detection: check for contradictory claims about the same entities
    const sharedCharacters = fact.characters_involved.some(c =>
      claimLower.includes(c.toLowerCase()),
    );
    if (!sharedCharacters) continue;

    // If the claim directly references a character from this fact,
    // check for obvious contradictions (name, role, relationship mismatches)
    // This is a heuristic — full LLM-based checking happens in quality pipeline
    const claimWords = new Set(claimLower.split(/\s+/));
    const factWords = new Set(factLower.split(/\s+/));

    // Detect negation conflicts
    const hasNegation =
      (claimLower.includes("not ") && !factLower.includes("not ")) ||
      (!claimLower.includes("not ") && factLower.includes("not "));

    // Detect direct contradiction keywords
    const contradictionPairs = [
      ["alive", "dead"],
      ["married", "single"],
      ["divorced", "married"],
      ["brother", "sister"],
      ["mother", "father"],
      ["young", "old"],
    ];

    let contradicted = false;
    for (const [a, b] of contradictionPairs) {
      if (
        (claimWords.has(a) && factWords.has(b)) ||
        (claimWords.has(b) && factWords.has(a))
      ) {
        contradicted = true;
        break;
      }
    }

    if (hasNegation || contradicted) {
      conflicting.push(fact);
    }
  }

  return {
    consistent: conflicting.length === 0,
    conflicting_facts: conflicting,
    explanation:
      conflicting.length === 0
        ? "No contradictions found against visible canonical facts."
        : `Found ${conflicting.length} potential contradiction(s): ${conflicting.map(f => f.statement).join("; ")}`,
    checked_against_count: visibleFacts.length,
  };
}

// ── LLM-based Fact Extraction ───────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a story fact extractor. Given a novel outline (JSON), extract ALL immutable canonical facts.

Return a JSON array of objects with these fields:
- fact_id: string (format: "fact_{category_initial}_{index}" e.g. "fact_c_001")
- category: one of CHARACTER_FACT, TIMELINE_FACT, LOCATION_FACT, REVELATION_FACT, BACKSTORY_FACT
- statement: string (the immutable fact, clear and unambiguous)
- source_chapter: number or null (chapter where this fact is first established)
- established_at_chapter: number (earliest chapter where this becomes established)
- revelation_chapter: number or null (for REVELATION_FACT only — chapter where revelation occurs)
- characters_involved: string[] (character names referenced)
- confidence: "CONFIRMED" or "INFERRED"

Rules:
- REVELATION_FACTs: These are truths revealed at the twist/revelation. Set revelation_chapter to the chapter where the reveal happens.
- CHARACTER_FACTs: Name, appearance, profession, key relationships
- TIMELINE_FACTs: When events occurred, temporal relationships
- LOCATION_FACTs: Place details, geography, setting specifics
- BACKSTORY_FACTs: Historical events before the story begins

Return ONLY the JSON array, no other text.`;

export async function extractFacts(
  outline: Record<string, unknown>,
): Promise<ExtractionResult> {
  const taskType: TaskType = "quality_analysis"; // Uses Gemini Flash, no Prose DNA

  try {
    const response = await callWithFallback(
      taskType,
      EXTRACTION_PROMPT + "\n\n" + JSON.stringify(outline),
    );

    const content = response.content.trim();
    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { facts: [], extraction_errors: ["No JSON array found in LLM response"] };
    }

    const parsed = JSON.parse(jsonMatch[0]) as CanonicalFact[];
    const now = new Date().toISOString();
    const extractedFacts: CanonicalFact[] = [];
    const errors: string[] = [];

    for (const raw of parsed) {
      if (!raw.fact_id || !raw.statement || !raw.category) {
        errors.push(`Invalid extracted fact: ${JSON.stringify(raw).slice(0, 100)}`);
        continue;
      }
      const fact: CanonicalFact = {
        fact_id: raw.fact_id,
        category: raw.category,
        statement: raw.statement,
        source_chapter: raw.source_chapter ?? null,
        established_at_chapter: raw.established_at_chapter ?? 1,
        revelation_chapter: raw.revelation_chapter ?? undefined,
        characters_involved: raw.characters_involved ?? [],
        confidence: raw.confidence ?? "INFERRED",
        created_at: now,
        updated_at: now,
      };
      extractedFacts.push(fact);
    }

    return { facts: extractedFacts, extraction_errors: errors };
  } catch (err) {
    return {
      facts: [],
      extraction_errors: [err instanceof Error ? err.message : "Extraction failed"],
    };
  }
}

/**
 * Extract facts and add them all to the database.
 */
export async function extractAndStoreFacts(
  outline: Record<string, unknown>,
  projectId: string,
): Promise<{ stored: number; errors: string[] }> {
  currentProjectId = projectId;
  const result = await extractFacts(outline);
  let stored = 0;

  for (const fact of result.facts) {
    const addResult = addFact(fact);
    if (addResult.ok) stored++;
    else result.extraction_errors.push(addResult.error || "Add failed");
  }

  return { stored, errors: result.extraction_errors };
}

// ── React Integration ───────────────────────────────────────────────────

export interface CanonicalFactsSnapshot {
  facts: CanonicalFact[];
  count: number;
  byCategory: Record<FactCategory, number>;
  _v: number;
}

let cachedSnapshot: CanonicalFactsSnapshot | null = null;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getSnapshot(): CanonicalFactsSnapshot {
  if (cachedSnapshot && cachedSnapshot._v === snapshotVersion) return cachedSnapshot;

  const all = getAllFacts();
  const byCategory: Record<FactCategory, number> = {
    CHARACTER_FACT: 0,
    TIMELINE_FACT: 0,
    LOCATION_FACT: 0,
    REVELATION_FACT: 0,
    BACKSTORY_FACT: 0,
  };
  for (const f of all) byCategory[f.category]++;

  cachedSnapshot = { facts: all, count: all.length, byCategory, _v: snapshotVersion };
  return cachedSnapshot;
}

// ── Window Registration ─────────────────────────────────────────────────
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_canonicalFacts = {
    addFact, updateFact, removeFact, getFact, getAllFacts,
    checkFact, extractFacts, extractAndStoreFacts, loadFacts,
    getSnapshot,
  };
}
