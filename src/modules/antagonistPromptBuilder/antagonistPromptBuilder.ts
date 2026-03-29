/**
 * Antagonist System Prompt Builder — Gemini Pro routing with voice DNA injection.
 * GHOSTLY v2.2 · Prompt 02 · MSG-4
 *
 * Builds system prompts for antagonist and supporting character generation.
 * Routes ONLY to Gemini Pro (primary) or OpenAI (fallback).
 * NEVER routes to Anthropic — voice homogeneity failure (anti-pattern #2).
 *
 * Voice DNA from the character's compressed_voice_dna is injected into the
 * system prompt to maintain character-specific voice differentiation.
 */

import { getCharacter } from "@/modules/characterDB/characterDB";
import { isGenerationAllowed } from "@/modules/voiceCorpusGate/voiceCorpusGate";
import { TASK_ROUTING, TASK_FALLBACK_OVERRIDES } from "@/api/llmRouter";
import type { CharacterRecord, CharacterRole } from "@/modules/characterDB/types";
import type { Provider, TaskType } from "@/api/llmRouter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AntagonistPromptConfig {
  character_id: string;
  scene_purpose: string;
  chapter_number: number;
  tension_target: number;
  collision_specification?: string;
  additional_context?: string;
}

export interface BuiltPrompt {
  system_prompt: string;
  task_type: TaskType;
  provider: Provider;
  fallback_chain: Provider[];
  voice_dna_injected: boolean;
  character_name: string;
  character_role: CharacterRole;
  generation_allowed: boolean;
  anthropic_blocked: true; // always true — invariant
  built_at: string;
  warnings: string[];
}

export interface BuildResult {
  ok: boolean;
  prompt?: BuiltPrompt;
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Providers that must NEVER be used for antagonist/supporting generation. */
const BLOCKED_PROVIDERS: Provider[] = ["anthropic"];

const ROLE_TASK_MAP: Record<string, TaskType> = {
  antagonist: "generation_antagonist",
  supporting: "generation_supporting",
};

// ---------------------------------------------------------------------------
// State (for UI reactivity)
// ---------------------------------------------------------------------------

const builtPrompts: Map<string, BuiltPrompt> = new Map();
const listeners: Set<() => void> = new Set();
let snapshotVersion = 0;

function notify() {
  snapshotVersion++;
  listeners.forEach((fn) => fn());
}

// ---------------------------------------------------------------------------
// Anti-Anthropic guard
// ---------------------------------------------------------------------------

function validateRouting(taskType: TaskType): { valid: boolean; warnings: string[] } {
  const route = TASK_ROUTING[taskType];
  const warnings: string[] = [];

  if (BLOCKED_PROVIDERS.includes(route.provider)) {
    return {
      valid: false,
      warnings: [`CRITICAL: ${taskType} primary provider is ${route.provider} — BLOCKED. Voice homogeneity failure.`],
    };
  }

  if (route.inject_prose_dna) {
    warnings.push(`WARNING: ${taskType} has inject_prose_dna=true — antagonist/supporting should NOT receive Prose DNA`);
  }

  const fallbacks = TASK_FALLBACK_OVERRIDES[taskType] ?? [];
  for (const fb of fallbacks) {
    if (BLOCKED_PROVIDERS.includes(fb)) {
      warnings.push(`CRITICAL: Fallback chain for ${taskType} contains ${fb} — MUST be removed`);
      return { valid: false, warnings };
    }
  }

  return { valid: true, warnings };
}

// ---------------------------------------------------------------------------
// Voice DNA injection
// ---------------------------------------------------------------------------

function buildVoiceDNABlock(character: CharacterRecord): string {
  const lines = [
    `=== VOICE DNA: ${character.name} (${character.role}) ===`,
    `Compressed Voice DNA: ${character.compressed_voice_dna}`,
    ``,
    `Character Core:`,
    `  Wound: ${character.wound}`,
    `  Flaw: ${character.flaw}`,
    `  Want: ${character.want}`,
    `  Need: ${character.need}`,
    `  Self-deception: ${character.self_deception}`,
    `  Fear: ${character.fear}`,
    ``,
    `Arc:`,
    `  Start: ${character.arc_start}`,
    `  End: ${character.arc_end}`,
    `  Lesson: ${character.arc_lesson}`,
    ``,
    `Goals:`,
    `  External goal: ${character.external_goal}`,
    `  Internal desire: ${character.internal_desire}`,
    `  Goal-desire gap: ${character.goal_desire_gap}`,
    `=== END VOICE DNA ===`,
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// System prompt assembly
// ---------------------------------------------------------------------------

function assembleSystemPrompt(
  character: CharacterRecord,
  config: AntagonistPromptConfig
): string {
  const voiceDNA = buildVoiceDNABlock(character);

  const sections = [
    `You are generating prose for the character "${character.name}" (${character.role}).`,
    `This character's voice must be DISTINCT from the protagonist. Do NOT adopt the protagonist's tone, cadence, or internal register.`,
    ``,
    voiceDNA,
    ``,
    `=== SCENE CONTEXT ===`,
    `Chapter: ${config.chapter_number}`,
    `Scene purpose: ${config.scene_purpose}`,
    `Tension target: ${config.tension_target}/10`,
  ];

  if (config.collision_specification) {
    sections.push(`Collision: ${config.collision_specification}`);
  }

  if (config.additional_context) {
    sections.push(``, `Additional context: ${config.additional_context}`);
  }

  sections.push(
    ``,
    `=== GENERATION RULES ===`,
    `1. Write in the voice specified by the Voice DNA above — not the protagonist's voice.`,
    `2. Maintain the character's psychological profile: wound, flaw, self-deception.`,
    `3. Dialogue must reflect this character's specific register and speech patterns.`,
    `4. The character's external goal and internal desire should create visible tension.`,
    `5. Show don't tell — interiority through action and observation, never labels.`,
  );

  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a system prompt for antagonist or supporting character generation.
 * Validates routing, injects voice DNA, and enforces anti-Anthropic guard.
 */
export function buildPrompt(config: AntagonistPromptConfig): BuildResult {
  const character = getCharacter(config.character_id);
  if (!character) {
    return { ok: false, error: `Character "${config.character_id}" not found` };
  }

  // Only antagonist and supporting roles
  if (character.role === "protagonist") {
    return {
      ok: false,
      error: `Character "${character.name}" is a protagonist — use generation_protagonist (Anthropic) instead`,
    };
  }

  const taskType = ROLE_TASK_MAP[character.role];
  if (!taskType) {
    return { ok: false, error: `No task mapping for role "${character.role}"` };
  }

  // Validate routing — anti-Anthropic guard
  const routeValidation = validateRouting(taskType);
  if (!routeValidation.valid) {
    return {
      ok: false,
      error: `Routing validation failed: ${routeValidation.warnings.join("; ")}`,
    };
  }

  // Check voice corpus gate
  const genAllowed = isGenerationAllowed(config.character_id);
  const warnings = [...routeValidation.warnings];
  if (!genAllowed) {
    warnings.push(`Voice corpus gate: ${character.name} is NOT approved — generation will be blocked at call time`);
  }

  // Check voice DNA presence
  if (!character.compressed_voice_dna || character.compressed_voice_dna.trim() === "") {
    warnings.push(`Voice DNA is empty for ${character.name} — prompt will lack voice differentiation`);
  }

  const route = TASK_ROUTING[taskType];
  const fallbacks = TASK_FALLBACK_OVERRIDES[taskType] ?? [];

  const system_prompt = assembleSystemPrompt(character, config);

  const result: BuiltPrompt = {
    system_prompt,
    task_type: taskType,
    provider: route.provider,
    fallback_chain: [...fallbacks],
    voice_dna_injected: true,
    character_name: character.name,
    character_role: character.role,
    generation_allowed: genAllowed,
    anthropic_blocked: true,
    built_at: new Date().toISOString(),
    warnings,
  };

  builtPrompts.set(config.character_id, result);
  notify();

  console.log(
    `[Antagonist Prompt Builder] Built prompt for ${character.name} (${character.role}) → ${route.provider}, fallback: [${fallbacks.join(", ")}], anthropic: BLOCKED`
  );

  return { ok: true, prompt: result };
}

/**
 * Get the last built prompt for a character.
 */
export function getBuiltPrompt(characterId: string): BuiltPrompt | null {
  return builtPrompts.get(characterId) ?? null;
}

/**
 * Get all built prompts.
 */
export function getAllBuiltPrompts(): BuiltPrompt[] {
  return Array.from(builtPrompts.values());
}

/**
 * Verify that the routing table is safe — no Anthropic in antagonist/supporting paths.
 */
export function auditRouting(): { safe: boolean; issues: string[] } {
  const issues: string[] = [];

  for (const role of ["antagonist", "supporting"] as const) {
    const taskType = ROLE_TASK_MAP[role] as TaskType;
    const route = TASK_ROUTING[taskType];

    if (BLOCKED_PROVIDERS.includes(route.provider)) {
      issues.push(`${taskType}: primary provider ${route.provider} is BLOCKED`);
    }

    const fallbacks = TASK_FALLBACK_OVERRIDES[taskType] ?? [];
    for (const fb of fallbacks) {
      if (BLOCKED_PROVIDERS.includes(fb)) {
        issues.push(`${taskType}: fallback ${fb} is BLOCKED`);
      }
    }

    if (route.inject_prose_dna) {
      issues.push(`${taskType}: inject_prose_dna should be false`);
    }
  }

  return { safe: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// React integration (useSyncExternalStore)
// ---------------------------------------------------------------------------

export interface AntagonistPromptSnapshot {
  prompts: BuiltPrompt[];
  totalBuilt: number;
  routingAudit: { safe: boolean; issues: string[] };
  _v: number;
}

let cachedSnapshot: AntagonistPromptSnapshot | null = null;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getSnapshot(): AntagonistPromptSnapshot {
  if (cachedSnapshot && cachedSnapshot._v === snapshotVersion) return cachedSnapshot;

  const all = getAllBuiltPrompts();
  cachedSnapshot = {
    prompts: all,
    totalBuilt: all.length,
    routingAudit: auditRouting(),
    _v: snapshotVersion,
  };
  return cachedSnapshot;
}

// ---------------------------------------------------------------------------
// Window registration for console testing
// ---------------------------------------------------------------------------

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_antagonistPrompt = {
    buildPrompt,
    getBuiltPrompt,
    getAllBuiltPrompts,
    auditRouting,
    getSnapshot,
    BLOCKED_PROVIDERS,
  };
}
