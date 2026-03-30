/**
 * Voice Corpus Quality Gate — LLM-evaluated 4-dimension corpus assessment.
 * GHOSTLY v2.2 · DOC_F specification
 *
 * Calls Gemini Flash (quality_analysis route) to evaluate character voice corpus
 * exchanges against the Leila Rex clinical-dissociative register definition.
 *
 * Four dimensions (1–5 each, max composite 20):
 *   1. Register consistency (0.25)
 *   2. Voice distinctiveness from protagonist (0.25)
 *   3. Tell operationalisation (0.30)
 *   4. Pressure state coverage (0.20)
 *
 * Gate: PASSED >= 16 | CONDITIONAL 12–15 | FAILED < 12
 * Protagonist: additional arc coherence check (>= 9/15) required.
 */

import {
  getCharacter,
  updateCharacter,
  getAllCharacters,
} from "@/modules/characterDB/characterDB";
import type { CharacterRecord } from "@/modules/characterDB/types";
import { callWithFallback } from "@/api/llmRouter";
import BENCHMARKS from "@/constants/VOICE_CORPUS_BENCHMARKS.json";

// ── Types ───────────────────────────────────────────────────────────────

export type GateResult = "PASSED" | "CONDITIONAL" | "FAILED";

export interface DimensionScore {
  score: number;          // 1–5
  revision_note: string;  // specific revision instruction if score < 4
}

export interface VoiceCorpusScores {
  register_consistency: DimensionScore;
  voice_distinctiveness: DimensionScore;
  tell_operationalisation: DimensionScore;
  pressure_state_coverage: DimensionScore;
}

export interface ArcCoherenceResult {
  q1_wound_rendered: number;     // 1–5
  q2_wound_under_pressure: number; // 1–5
  q3_transformation_shown: number; // 1–5
  composite: number;             // sum
  passed: boolean;               // >= 9
}

export interface VoiceCorpusGateResult {
  character_id: string;
  character_name: string;
  character_role: string;
  scores: VoiceCorpusScores;
  composite_score: number;       // weighted, max 20
  gate_result: GateResult;
  generation_blocked: boolean;
  arc_coherence?: ArcCoherenceResult; // protagonist only
  evaluated_at: string;
  evaluation_method: "llm_gemini_flash";
  notes: string;
}

// ── Constants ───────────────────────────────────────────────────────────

const WEIGHTS = {
  register_consistency: 0.25,
  voice_distinctiveness: 0.25,
  tell_operationalisation: 0.30,
  pressure_state_coverage: 0.20,
} as const;

const THRESHOLDS = {
  passed: 16,
  conditional: 12,
  arc_coherence: 9,
} as const;

export { THRESHOLDS, WEIGHTS as DIMENSION_WEIGHTS };

// ── Dimension labels for UI ─────────────────────────────────────────────

export const DIMENSION_LABELS: Record<keyof VoiceCorpusScores, string> = {
  register_consistency: "Register Consistency",
  voice_distinctiveness: "Voice Distinctiveness",
  tell_operationalisation: "Tell Operationalisation",
  pressure_state_coverage: "Pressure State Coverage",
};

export const DIMENSION_SHORT: Record<keyof VoiceCorpusScores, string> = {
  register_consistency: "REG",
  voice_distinctiveness: "DIST",
  tell_operationalisation: "TELL",
  pressure_state_coverage: "COV",
};

// ── State ───────────────────────────────────────────────────────────────

const gateResults: Map<string, VoiceCorpusGateResult> = new Map();
const listeners: Set<() => void> = new Set();
let snapshotVersion = 0;

function notify() {
  snapshotVersion++;
  listeners.forEach((fn) => fn());
}

// ── System prompt builder ───────────────────────────────────────────────

function buildEvaluationPrompt(character: CharacterRecord, corpusText: string): string {
  // Derive pressure state descriptions from benchmark exchanges
  const deflectionExchange = BENCHMARKS.exchanges.find(e => e.pressure_state === "DEFLECTION");
  const deceptionExchange = BENCHMARKS.exchanges.find(e => e.pressure_state === "DECEPTION");
  const collapseExchange = BENCHMARKS.exchanges.find(e => e.pressure_state === "COLLAPSE");

  return `You are evaluating a voice corpus for the character "${character.name}" (role: ${character.role}) in a psychological thriller novel series by Leila Rex.

## CALIBRATION ANCHOR — Clinical-Dissociative Register
Register: ${BENCHMARKS.register} — controlled, precise, slightly detached. Flat emotional affect, precise observation, physical response over named emotion.

Traits:
- Flat emotional affect under pressure
- Precise sensory observation replacing emotional labelling
- Physical response over named emotion
- Slightly detached clinical control

Anti-patterns (these should NOT appear):
- Direct emotional labelling ("I felt angry")
- Melodramatic escalation
- Performed anxiety as deception tell

## CHARACTER CONTEXT
- Wound: ${character.wound}
- Flaw: ${character.flaw}
- Self-deception: ${character.self_deception}
- Compressed Voice DNA: ${character.compressed_voice_dna}
- Role: ${character.role}

## PRESSURE STATES
- DEFLECTION: ${deflectionExchange?.register_notes ?? "Escalating layers of redirect, feigned ignorance, rationalisation, hard shutdown"}
- DECEPTION: ${deceptionExchange?.register_notes ?? "Performed competence, not performed anxiety. Sensory distortion as tell."}
- COLLAPSE: ${collapseExchange?.register_notes ?? "Total structural failure. Sentences fragment. System powers down before feeling floods in."}

## ARC POINTS
- ARC_START (min 5 exchanges): Establishes baseline voice under normal and low-pressure conditions
- ARC_MID (min 3 exchanges): Voice under escalating pressure — tells intensify, cracks appear
- ARC_END (min 2 exchanges): Post-revelation voice — register shift after truth surfaces

## EVALUATION TASK
Score this corpus on FOUR dimensions (1–5 each):

1. **register_consistency** (weight 0.25): Does every exchange maintain the clinical-dissociative register? Flat emotional affect, precise observation, physical response over named emotion, slightly detached control. Inconsistency = low score. Brand-critical dimension.

2. **voice_distinctiveness** (weight 0.25): ${character.role === "protagonist"
    ? "How purely does this voice embody the clinical-dissociative register? Score the purity of the register itself."
    : "How clearly differentiated is this character's voice from the protagonist's clinical-dissociative register? Identical registers = low score."
  }

3. **tell_operationalisation** (weight 0.30): Are the character's pressure-state tells specific, consistent, and unique to this character? A tell is a specific verbal or behavioural pattern under a particular pressure state (DEFLECTION, DECEPTION, COLLAPSE). Vague responses that could work for any character = low score. Tells specific to this character's wound and self-deception = high score.

4. **pressure_state_coverage** (weight 0.20): Are required arc points covered? Min 5 ARC_START exchanges required. ARC_MID and ARC_END required before their respective generation gates. Score based on coverage completeness.

${character.role === "protagonist" ? `## ARC COHERENCE CHECK (protagonist only)
Also answer three questions (1–5 each):
- q1_wound_rendered: Does ARC_START establish the baseline wound in voice — not stated, rendered?
- q2_wound_under_pressure: Does ARC_MID show the wound under pressure without resolving it?
- q3_transformation_shown: Does ARC_END show transformation without naming it — register shift not explanation?
` : ""}

## RESPONSE FORMAT
Return ONLY valid JSON (no markdown fencing):
{
  "register_consistency": { "score": <1-5>, "revision_note": "<specific instruction if score < 4, empty string if >= 4>" },
  "voice_distinctiveness": { "score": <1-5>, "revision_note": "<specific instruction if score < 4, empty string if >= 4>" },
  "tell_operationalisation": { "score": <1-5>, "revision_note": "<specific instruction if score < 4, empty string if >= 4>" },
  "pressure_state_coverage": { "score": <1-5>, "revision_note": "<specific instruction if score < 4, empty string if >= 4>" }${character.role === "protagonist" ? `,
  "arc_coherence": {
    "q1_wound_rendered": <1-5>,
    "q2_wound_under_pressure": <1-5>,
    "q3_transformation_shown": <1-5>
  }` : ""}
}

## CORPUS TEXT
${corpusText}`;
}

// ── Score computation ───────────────────────────────────────────────────

function computeComposite(scores: VoiceCorpusScores): number {
  // Each dimension is 1–5, weighted, then scaled to 20
  const weighted =
    scores.register_consistency.score * WEIGHTS.register_consistency +
    scores.voice_distinctiveness.score * WEIGHTS.voice_distinctiveness +
    scores.tell_operationalisation.score * WEIGHTS.tell_operationalisation +
    scores.pressure_state_coverage.score * WEIGHTS.pressure_state_coverage;

  // weighted is 1–5 scale, multiply by 4 to get 4–20 scale
  return Math.round(weighted * 4 * 100) / 100;
}

function determineGateResult(composite: number): GateResult {
  if (composite >= THRESHOLDS.passed) return "PASSED";
  if (composite >= THRESHOLDS.conditional) return "CONDITIONAL";
  return "FAILED";
}

// ── Parse LLM response ─────────────────────────────────────────────────

function parseLLMResponse(raw: string, isProtagonist: boolean): {
  scores: VoiceCorpusScores;
  arcCoherence?: ArcCoherenceResult;
} {
  // Strip markdown fencing if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  const clamp = (v: unknown, min: number, max: number): number => {
    const n = typeof v === "number" ? v : 1;
    return Math.max(min, Math.min(max, n));
  };

  const dimScore = (d: unknown): DimensionScore => {
    const obj = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
    return {
      score: clamp(obj.score, 1, 5),
      revision_note: typeof obj.revision_note === "string" ? obj.revision_note : "",
    };
  };

  const scores: VoiceCorpusScores = {
    register_consistency: dimScore(parsed.register_consistency),
    voice_distinctiveness: dimScore(parsed.voice_distinctiveness),
    tell_operationalisation: dimScore(parsed.tell_operationalisation),
    pressure_state_coverage: dimScore(parsed.pressure_state_coverage),
  };

  let arcCoherence: ArcCoherenceResult | undefined;
  if (isProtagonist && parsed.arc_coherence) {
    const ac = parsed.arc_coherence;
    const q1 = clamp(ac.q1_wound_rendered, 1, 5);
    const q2 = clamp(ac.q2_wound_under_pressure, 1, 5);
    const q3 = clamp(ac.q3_transformation_shown, 1, 5);
    const composite = q1 + q2 + q3;
    arcCoherence = {
      q1_wound_rendered: q1,
      q2_wound_under_pressure: q2,
      q3_transformation_shown: q3,
      composite,
      passed: composite >= THRESHOLDS.arc_coherence,
    };
  }

  return { scores, arcCoherence };
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Evaluate a character's voice corpus using Gemini Flash (quality_analysis route).
 * This is an async LLM call — NOT manual score entry.
 */
export async function evaluateCorpus(
  characterId: string,
  corpusText: string,
): Promise<{ ok: boolean; result?: VoiceCorpusGateResult; error?: string }> {
  const character = getCharacter(characterId);
  if (!character) {
    return { ok: false, error: `Character "${characterId}" not found` };
  }

  if (!corpusText || corpusText.trim().length < 50) {
    return { ok: false, error: "Corpus text too short — provide actual exchange samples" };
  }

  const isProtagonist = character.role === "protagonist";

  try {
    // Build evaluation prompt and call Gemini Flash via quality_analysis route
    const prompt = buildEvaluationPrompt(character, corpusText);

    console.log(`[Voice Corpus Gate] Calling Gemini Flash for ${character.name}...`);

    const llmResponse = await callWithFallback("quality_analysis", prompt, {
      temperature: 0.2,
      max_tokens: 2048,
    });

    console.log(`[Voice Corpus Gate] LLM response received (${llmResponse.tokens_used} tokens, provider: ${llmResponse.provider})`);

    // Parse structured response
    const { scores, arcCoherence } = parseLLMResponse(llmResponse.content, isProtagonist);

    const composite = computeComposite(scores);
    const gateFromScore = determineGateResult(composite);

    // For protagonist: both gate score AND arc coherence must pass
    let finalGateResult = gateFromScore;
    if (isProtagonist && gateFromScore === "PASSED") {
      if (!arcCoherence || !arcCoherence.passed) {
        finalGateResult = "CONDITIONAL";
      }
    }

    const generation_blocked = finalGateResult !== "PASSED";

    const result: VoiceCorpusGateResult = {
      character_id: characterId,
      character_name: character.name,
      character_role: character.role,
      scores,
      composite_score: composite,
      gate_result: finalGateResult,
      generation_blocked,
      arc_coherence: arcCoherence,
      evaluated_at: new Date().toISOString(),
      evaluation_method: "llm_gemini_flash",
      notes: llmResponse.fallback_used
        ? `Evaluated via fallback provider: ${llmResponse.provider}`
        : "",
    };

    // Store result
    gateResults.set(characterId, result);

    // Update character record
    updateCharacter(characterId, {
      voice_corpus_status: finalGateResult === "PASSED" ? "APPROVED" : "PENDING",
      voice_reliability: finalGateResult === "PASSED" ? "HIGH" : "MISSING",
      corpus_approved: finalGateResult === "PASSED",
    });

    notify();

    console.log(
      `[Voice Corpus Gate] ${character.name}: ${composite.toFixed(1)}/20 → ${finalGateResult}${generation_blocked ? " (BLOCKED)" : ""}`,
    );

    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown evaluation error";
    console.error(`[Voice Corpus Gate] Evaluation failed for ${character.name}:`, message);
    return { ok: false, error: message };
  }
}

/**
 * Check if a character is cleared for generation.
 */
export function isGenerationAllowed(characterId: string): boolean {
  const result = gateResults.get(characterId);
  if (!result) return false;
  return !result.generation_blocked;
}

/**
 * Intercept generation call — returns blocking message if any character is not approved.
 * Call this before any generation call.
 */
export function checkGenerationBlock(characterIds: string[]): {
  blocked: boolean;
  blockers: { character_id: string; character_name: string; reason: string }[];
} {
  const blockers: { character_id: string; character_name: string; reason: string }[] = [];

  for (const id of characterIds) {
    const character = getCharacter(id);
    if (!character) {
      blockers.push({ character_id: id, character_name: id, reason: "Character not found" });
      continue;
    }

    const result = gateResults.get(id);
    if (!result) {
      blockers.push({
        character_id: id,
        character_name: character.name,
        reason: "No corpus evaluation — run evaluateCorpus first",
      });
      continue;
    }

    if (result.generation_blocked) {
      const failingDims = Object.entries(result.scores)
        .filter(([, s]) => s.score < 4)
        .map(([dim, s]) => `${dim}: ${s.score}/5${s.revision_note ? ` — ${s.revision_note}` : ""}`)
        .join("; ");

      let reason = `Gate: ${result.gate_result} (${result.composite_score.toFixed(1)}/20)`;
      if (failingDims) reason += ` | Failing: ${failingDims}`;
      if (result.arc_coherence && !result.arc_coherence.passed) {
        reason += ` | Arc coherence: ${result.arc_coherence.composite}/15 (need 9)`;
      }

      blockers.push({ character_id: id, character_name: character.name, reason });
    }
  }

  return { blocked: blockers.length > 0, blockers };
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

// ── React integration ───────────────────────────────────────────────────

export interface VoiceCorpusGateSnapshot {
  results: VoiceCorpusGateResult[];
  totalEvaluated: number;
  passed: number;
  conditional: number;
  failed: number;
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
    passed: all.filter((r) => r.gate_result === "PASSED").length,
    conditional: all.filter((r) => r.gate_result === "CONDITIONAL").length,
    failed: all.filter((r) => r.gate_result === "FAILED").length,
    blocked: all.filter((r) => r.generation_blocked).length,
    _v: snapshotVersion,
  };
  return cachedSnapshot;
}

// ── Window registration ─────────────────────────────────────────────────
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_voiceCorpusGate = {
    evaluateCorpus,
    isGenerationAllowed,
    checkGenerationBlock,
    getGateResult,
    getAllGateResults,
    getBlockedCharacters,
    getApprovedCharacters,
    getSnapshot,
    THRESHOLDS,
    DIMENSION_WEIGHTS: WEIGHTS,
  };
}
