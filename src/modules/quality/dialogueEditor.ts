/**
 * Dialogue Editor — Dialogue quality analysis module.
 * GHOSTLY v2.2 · Session 20
 *
 * Checks: subtext delivery, character voice consistency, information load,
 * dialogue drives (R2 compliance).
 * Uses Gemini Flash via callWithFallback('quality_analysis', ...) — NO Prose DNA.
 */

import { callWithFallback } from "@/api/llmRouter";

// ── Types ───────────────────────────────────────────────────────────────

export type DialogueFlagSeverity = "CRITICAL" | "WARNING" | "NOTE";

export interface DialogueEditorFlag {
  code: string;
  severity: DialogueFlagSeverity;
  message: string;
  line_reference?: string;
  instruction?: string;
}

export interface SubtextTarget {
  target_id: string;
  description: string;
  character_id: string;
}

export interface SubtextDeliveryResult {
  target_id: string;
  description: string;
  subtext_delivered: boolean;
  subtext_surfaced: boolean;
  explanation: string;
}

export interface SubtextDeliveryCheck {
  results: SubtextDeliveryResult[];
  undelivered_count: number;
  surfaced_count: number;
}

export interface VoiceInconsistency {
  character_id: string;
  line_reference: string;
  expected_register: string;
  actual_register: string;
  explanation: string;
}

export interface CharacterVoiceConsistencyCheck {
  inconsistencies: VoiceInconsistency[];
  overall_consistent: boolean;
}

export interface InformationDumpInstance {
  location: string;
  fact_count: number;
  excerpt: string;
}

export interface InformationLoadCheck {
  dump_instances: InformationDumpInstance[];
  total_dumps: number;
}

export interface DialogueDrivesLine {
  line_reference: string;
  functions_served: number;
  functions_list: string[];
  needs_tightening: boolean;
}

export interface DialogueDrivesCheck {
  weak_lines: DialogueDrivesLine[];
  total_dialogue_lines: number;
  multi_function_percentage: number;
}

export interface DialogueEditorResult {
  chapter_number: number;
  subtext_delivery_check: SubtextDeliveryCheck;
  character_voice_consistency: CharacterVoiceConsistencyCheck;
  information_load_check: InformationLoadCheck;
  dialogue_drives_check: DialogueDrivesCheck;
  flags: DialogueEditorFlag[];
  score: number;
}

// ── System Prompt Builder ───────────────────────────────────────────────

function buildSystemPrompt(
  subtextTargets: SubtextTarget[],
  characterVoiceDNA: Record<string, string>,
): string {
  const subtextSection = subtextTargets.length > 0
    ? `SUBTEXT TARGETS to check:\n${subtextTargets.map(t => `- [${t.target_id}] ${t.description} (character: ${t.character_id})`).join("\n")}`
    : "No subtext targets declared for this scene.";

  const voiceSection = Object.keys(characterVoiceDNA).length > 0
    ? `CHARACTER VOICE DNA:\n${Object.entries(characterVoiceDNA).map(([id, dna]) => `- ${id}: ${dna}`).join("\n")}`
    : "No character voice DNA available.";

  return `You are a dialogue editor for commercial psychological thrillers. Analyze all dialogue in this chapter.

${subtextSection}

${voiceSection}

Perform ALL checks:

1. SUBTEXT DELIVERY CHECK:
For each SubtextTarget: was the subtext delivered through dialogue WITHOUT being stated explicitly?
- subtext_delivered: true if the subtext is present beneath the surface dialogue
- subtext_surfaced: true if the subtext was named/stated explicitly (this is a FAILURE — subtext must remain beneath)
Report per target.

2. CHARACTER VOICE CONSISTENCY:
Compare each character's dialogue against their voice DNA. Flag lines where a character breaks register:
- Protagonist speaking warmly/openly in a crisis moment
- Antagonist speaking uncertainly when they should project control
- Any character whose dialogue contradicts their compressed_voice_dna
Provide specific line references.

3. INFORMATION LOAD CHECK:
Flag any dialogue exchange that delivers > 3 new facts in a single back-and-forth. This is an information dump disguised as conversation.

4. DIALOGUE DRIVES CHECK (R2 compliance):
Each dialogue line should serve at least 2 of these functions: reveal character / escalate tension / deliver information.
Lines serving only 1 function need tightening.

Return ONLY valid JSON:
{
  "subtext_delivery_check": {
    "results": [{ "target_id": string, "description": string, "subtext_delivered": boolean, "subtext_surfaced": boolean, "explanation": string }],
    "undelivered_count": number,
    "surfaced_count": number
  },
  "character_voice_consistency": {
    "inconsistencies": [{ "character_id": string, "line_reference": string, "expected_register": string, "actual_register": string, "explanation": string }],
    "overall_consistent": boolean
  },
  "information_load_check": {
    "dump_instances": [{ "location": string, "fact_count": number, "excerpt": string }],
    "total_dumps": number
  },
  "dialogue_drives_check": {
    "weak_lines": [{ "line_reference": string, "functions_served": number, "functions_list": [string], "needs_tightening": boolean }],
    "total_dialogue_lines": number,
    "multi_function_percentage": number
  }
}

Do NOT include any text outside the JSON object.`;
}

// ── Parse & Validate ────────────────────────────────────────────────────

function extractJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1].trim());
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) return JSON.parse(braceMatch[0]);
    throw new Error("No valid JSON found in response");
  }
}

function validateResponse(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return !!(d.subtext_delivery_check && d.character_voice_consistency && d.information_load_check && d.dialogue_drives_check);
}

// ── Main Function ───────────────────────────────────────────────────────

export interface DialogueEditorInput {
  chapterNumber: number;
  chapterContent: string;
  subtextTargets: SubtextTarget[];
  characterVoiceDNA: Record<string, string>;
}

const MAX_RETRIES = 2;

export async function runDialogueEditor(
  input: DialogueEditorInput
): Promise<DialogueEditorResult> {
  const systemPrompt = buildSystemPrompt(input.subtextTargets, input.characterVoiceDNA);
  const fullPrompt = `${systemPrompt}\n\n--- CHAPTER CONTENT ---\n\n${input.chapterContent}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callWithFallback("quality_analysis", fullPrompt, {
        temperature: 0.2,
        max_tokens: 3000,
      });
      const parsed = extractJSON(response.content);
      if (!validateResponse(parsed)) {
        throw new Error("Schema validation failed — response does not match DialogueEditor schema");
      }
      return assembleResult(parsed as Record<string, unknown>, input);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[DialogueEditor] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, lastError.message);
    }
  }

  throw new Error(`[DialogueEditor] All ${MAX_RETRIES + 1} attempts failed. Last error: ${lastError?.message}`);
}

// ── Result Assembly ─────────────────────────────────────────────────────

function assembleResult(
  data: Record<string, unknown>,
  input: DialogueEditorInput
): DialogueEditorResult {
  const flags: DialogueEditorFlag[] = [];

  // ── Subtext Delivery ──
  const sdcRaw = data.subtext_delivery_check as Record<string, unknown>;
  const subtextResults = (sdcRaw.results as SubtextDeliveryResult[]) ?? [];
  const subtextDeliveryCheck: SubtextDeliveryCheck = {
    results: subtextResults,
    undelivered_count: (sdcRaw.undelivered_count as number) ?? subtextResults.filter(r => !r.subtext_delivered).length,
    surfaced_count: (sdcRaw.surfaced_count as number) ?? subtextResults.filter(r => r.subtext_surfaced).length,
  };

  for (const r of subtextResults) {
    if (!r.subtext_delivered) {
      flags.push({
        code: "SUBTEXT_MISSING",
        severity: "WARNING",
        message: `Subtext target "${r.target_id}" not delivered: ${r.description}`,
      });
    }
    if (r.subtext_surfaced) {
      flags.push({
        code: "SUBTEXT_SURFACED",
        severity: "WARNING",
        message: `Subtext target "${r.target_id}" was stated explicitly — subtext must remain beneath the surface.`,
      });
    }
  }

  // ── Voice Consistency ──
  const vccRaw = data.character_voice_consistency as Record<string, unknown>;
  const inconsistencies = (vccRaw.inconsistencies as VoiceInconsistency[]) ?? [];
  const characterVoiceConsistency: CharacterVoiceConsistencyCheck = {
    inconsistencies,
    overall_consistent: (vccRaw.overall_consistent as boolean) ?? inconsistencies.length === 0,
  };

  for (const inc of inconsistencies) {
    flags.push({
      code: "VOICE_INCONSISTENCY",
      severity: "WARNING",
      message: `Character "${inc.character_id}" breaks register at ${inc.line_reference}: expected ${inc.expected_register}, got ${inc.actual_register}.`,
      line_reference: inc.line_reference,
    });
  }

  // ── Information Load ──
  const ilcRaw = data.information_load_check as Record<string, unknown>;
  const dumpInstances = (ilcRaw.dump_instances as InformationDumpInstance[]) ?? [];
  const informationLoadCheck: InformationLoadCheck = {
    dump_instances: dumpInstances,
    total_dumps: (ilcRaw.total_dumps as number) ?? dumpInstances.length,
  };

  for (const dump of dumpInstances) {
    flags.push({
      code: "INFORMATION_DUMP",
      severity: "NOTE",
      message: `Information dump at ${dump.location}: ${dump.fact_count} facts in one exchange.`,
    });
  }

  // ── Dialogue Drives ──
  const ddcRaw = data.dialogue_drives_check as Record<string, unknown>;
  const weakLines = (ddcRaw.weak_lines as DialogueDrivesLine[]) ?? [];
  const dialogueDrivesCheck: DialogueDrivesCheck = {
    weak_lines: weakLines.filter(l => l.needs_tightening),
    total_dialogue_lines: (ddcRaw.total_dialogue_lines as number) ?? 0,
    multi_function_percentage: (ddcRaw.multi_function_percentage as number) ?? 100,
  };

  if (weakLines.filter(l => l.needs_tightening).length > 3) {
    flags.push({
      code: "DIALOGUE_WEAK_LINES",
      severity: "NOTE",
      message: `${weakLines.filter(l => l.needs_tightening).length} dialogue lines serve only one function — consider tightening.`,
    });
  }

  // ── Composite Score ──
  // Weight: subtext (0.35), voice consistency (0.30), info load (0.15), drives (0.20)
  const subtextScore = subtextResults.length === 0 ? 10 :
    10 * (1 - (subtextDeliveryCheck.undelivered_count + subtextDeliveryCheck.surfaced_count) / Math.max(subtextResults.length, 1));
  const voiceScore = inconsistencies.length === 0 ? 10 : Math.max(0, 10 - inconsistencies.length * 2);
  const infoScore = dumpInstances.length === 0 ? 10 : Math.max(0, 10 - dumpInstances.length * 1.5);
  const drivesScore = dialogueDrivesCheck.multi_function_percentage >= 80 ? 10 :
    dialogueDrivesCheck.multi_function_percentage >= 60 ? 7 : 4;

  const score = Math.max(0, Math.min(10, Math.round(
    (subtextScore * 0.35 + voiceScore * 0.30 + infoScore * 0.15 + drivesScore * 0.20) * 10
  ) / 10));

  return {
    chapter_number: input.chapterNumber,
    subtext_delivery_check: subtextDeliveryCheck,
    character_voice_consistency: characterVoiceConsistency,
    information_load_check: informationLoadCheck,
    dialogue_drives_check: dialogueDrivesCheck,
    flags,
    score,
  };
}

// ── Console exposure ────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_dialogueEditor = {
    runDialogueEditor,
  };
}
