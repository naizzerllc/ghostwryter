/**
 * Voice Corpus Quality Gate — 4-dimension evaluation engine.
 * GHOSTLY v2.2 · Prompt 02 · MSG-2
 *
 * Evaluates character voice corpus samples across four dimensions:
 *   1. Distinctiveness — how unique is the voice vs other characters
 *   2. Consistency — how stable is the voice across samples
 *   3. Register range — appropriate variation within the character's range
 *   4. Dialogue authenticity — does dialogue sound like natural speech
 *
 * Gate result: APPROVED (>= 7.0) | REVIEW (5.0–6.9) | REJECTED (< 5.0)
 * Characters with REJECTED or PENDING corpus are blocked from generation.
 *
 * Matches voice_corpus_gate_result schema from MIC v2.1.
 */

import {
  getCharacter,
  updateCharacter,
  getAllCharacters,
} from "@/modules/characterDB/characterDB";
import type { CharacterRecord } from "@/modules/characterDB/types";

// ---------------------------------------------------------------------------
// Types (matches MIC v2.1 voice_corpus_gate_result)
// ---------------------------------------------------------------------------

export type GateResult = "APPROVED" | "REVIEW" | "REJECTED";

export interface DimensionScore {
  score: number;        // 0–10
  confidence: number;   // 0–1
  notes: string;
}

export interface VoiceCorpusScores {
  distinctiveness: DimensionScore;
  consistency: DimensionScore;
  register_range: DimensionScore;
  dialogue_authenticity: DimensionScore;
}

export interface VoiceCorpusGateResult {
  character_id: string;
  character_name: string;
  scores: VoiceCorpusScores;
  composite_score: number;
  gate_result: GateResult;
  generation_blocked: boolean;
  evaluated_at: string;
  sample_count: number;
  notes: string;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const THRESHOLDS = {
  approve: 7.0,
  review: 5.0,
  // Below review = REJECTED
  min_samples: 3,
} as const;

const DIMENSION_WEIGHTS = {
  distinctiveness: 0.30,
  consistency: 0.25,
  register_range: 0.20,
  dialogue_authenticity: 0.25,
} as const;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const gateResults: Map<string, VoiceCorpusGateResult> = new Map();
const listeners: Set<() => void> = new Set();
let snapshotVersion = 0;

function notify() {
  snapshotVersion++;
  listeners.forEach((fn) => fn());
}

// ---------------------------------------------------------------------------
// Scoring engine
// ---------------------------------------------------------------------------

function computeComposite(scores: VoiceCorpusScores): number {
  const weighted =
    scores.distinctiveness.score * DIMENSION_WEIGHTS.distinctiveness +
    scores.consistency.score * DIMENSION_WEIGHTS.consistency +
    scores.register_range.score * DIMENSION_WEIGHTS.register_range +
    scores.dialogue_authenticity.score * DIMENSION_WEIGHTS.dialogue_authenticity;

  return Math.round(weighted * 100) / 100;
}

function determineGateResult(composite: number): GateResult {
  if (composite >= THRESHOLDS.approve) return "APPROVED";
  if (composite >= THRESHOLDS.review) return "REVIEW";
  return "REJECTED";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a character's voice corpus and produce a gate result.
 * Scores are provided externally (from LLM quality analysis or manual input).
 */
export function evaluateCorpus(
  characterId: string,
  scores: VoiceCorpusScores,
  sampleCount: number,
  notes?: string
): { ok: boolean; result?: VoiceCorpusGateResult; error?: string } {
  const character = getCharacter(characterId);
  if (!character) {
    return { ok: false, error: `Character "${characterId}" not found` };
  }

  // Validate scores are in range
  for (const [dim, score] of Object.entries(scores)) {
    if (score.score < 0 || score.score > 10) {
      return { ok: false, error: `${dim} score must be 0–10, got ${score.score}` };
    }
    if (score.confidence < 0 || score.confidence > 1) {
      return { ok: false, error: `${dim} confidence must be 0–1, got ${score.confidence}` };
    }
  }

  const composite = computeComposite(scores);
  const gate_result = determineGateResult(composite);
  const generation_blocked = gate_result !== "APPROVED";

  const result: VoiceCorpusGateResult = {
    character_id: characterId,
    character_name: character.name,
    scores,
    composite_score: composite,
    gate_result,
    generation_blocked,
    evaluated_at: new Date().toISOString(),
    sample_count: sampleCount,
    notes: notes ?? "",
  };

  // Store result
  gateResults.set(characterId, result);

  // Update character record
  updateCharacter(characterId, {
    voice_corpus_status: gate_result === "APPROVED" ? "APPROVED" : gate_result === "REVIEW" ? "PENDING" : "REJECTED",
    voice_reliability: gate_result === "APPROVED" ? "HIGH" : "MISSING",
    corpus_approved: gate_result === "APPROVED",
  });

  notify();

  console.log(
    `[Voice Corpus Gate] ${character.name}: ${composite.toFixed(2)} → ${gate_result}${generation_blocked ? " (BLOCKED)" : ""}`
  );

  return { ok: true, result };
}

/**
 * Check if a character is cleared for generation.
 */
export function isGenerationAllowed(characterId: string): boolean {
  const result = gateResults.get(characterId);
  if (!result) return false; // No evaluation = blocked
  return !result.generation_blocked;
}

/**
 * Get gate result for a character.
 */
export function getGateResult(characterId: string): VoiceCorpusGateResult | null {
  return gateResults.get(characterId) ?? null;
}

/**
 * Get all gate results.
 */
export function getAllGateResults(): VoiceCorpusGateResult[] {
  return Array.from(gateResults.values());
}

/**
 * Get characters blocked from generation.
 */
export function getBlockedCharacters(): CharacterRecord[] {
  return getAllCharacters().filter((c) => !isGenerationAllowed(c.id));
}

/**
 * Get generation-ready characters.
 */
export function getApprovedCharacters(): CharacterRecord[] {
  return getAllCharacters().filter((c) => isGenerationAllowed(c.id));
}

// ---------------------------------------------------------------------------
// React integration
// ---------------------------------------------------------------------------

export interface VoiceCorpusGateSnapshot {
  results: VoiceCorpusGateResult[];
  totalEvaluated: number;
  approved: number;
  review: number;
  rejected: number;
  blocked: number;
  _v: number;
}

let cachedSnapshot: VoiceCorpusGateSnapshot | null = null;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): VoiceCorpusGateSnapshot {
  if (cachedSnapshot && cachedSnapshot._v === snapshotVersion) return cachedSnapshot;

  const all = getAllGateResults();
  cachedSnapshot = {
    results: all,
    totalEvaluated: all.length,
    approved: all.filter((r) => r.gate_result === "APPROVED").length,
    review: all.filter((r) => r.gate_result === "REVIEW").length,
    rejected: all.filter((r) => r.gate_result === "REJECTED").length,
    blocked: all.filter((r) => r.generation_blocked).length,
    _v: snapshotVersion,
  };
  return cachedSnapshot;
}

// ---------------------------------------------------------------------------
// Window registration for console testing
// ---------------------------------------------------------------------------
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_voiceCorpusGate = {
    evaluateCorpus,
    isGenerationAllowed,
    getGateResult,
    getAllGateResults,
    getBlockedCharacters,
    getApprovedCharacters,
    getSnapshot,
    THRESHOLDS,
    DIMENSION_WEIGHTS,
  };
}
