/**
 * Developmental Editor — Structural quality analysis module.
 * GHOSTLY v2.2 · Session 19
 *
 * Checks: scene purpose, false progression (CRITICAL), scene collision,
 * protagonist agency, goal/desire arc, arc delivery, opening doctrine.
 * Uses Gemini Flash via callWithFallback('quality_analysis', ...) — NO Prose DNA.
 * Output: structured JSON (DevEditorResult).
 */

import { callWithFallback } from "@/api/llmRouter";

// ── Types ───────────────────────────────────────────────────────────────

export type FlagSeverity = "CRITICAL" | "WARNING" | "NOTE";

export type IrreversibleChangeType =
  | "CHARACTER_REVELATION"
  | "RELATIONSHIP_SHIFT"
  | "INFORMATION_DISCLOSED"
  | "PHYSICAL_CONSEQUENCE"
  | "POWER_TRANSFER"
  | "COMMITMENT_MADE";

export type CollisionType =
  | "CHARACTER_GOAL_COLLISION"
  | "INFORMATION_COLLISION"
  | "LOYALTY_COLLISION"
  | "TIMELINE_COLLISION"
  | "EXPECTATION_COLLISION"
  | "NO_COLLISION"
  | "COLLISION_WEAK";

export type DecisionType = "PROACTIVE" | "REACTIVE" | "NEUTRAL";

export type GapMovement = "CLOSING" | "WIDENING" | "NEUTRAL";

export type OpeningType =
  | "MID_ACTION"
  | "SENSORY_DETAIL"
  | "DIALOGUE_IN_PROGRESS"
  | "MICRO_MYSTERY"
  | "BANNED";

export interface DevEditorFlag {
  code: string;
  severity: FlagSeverity;
  message: string;
  instruction?: string;
}

export interface ScenePurposeCheck {
  scene_purpose_delivered: boolean;
  explanation: string;
}

export interface FalseProgressionCheck {
  irreversible_change_delivered: boolean;
  change_type: IrreversibleChangeType | null;
  change_description: string;
}

export interface SceneCollisionCheck {
  collision_present: boolean;
  collision_type: CollisionType;
  collision_description: string;
}

export interface ProtagonistAgencyCheck {
  decision_type_delivered: DecisionType;
  consecutive_reactive_count: number;
  explanation: string;
}

export interface GoalDesireArcCheck {
  gap_movement: GapMovement;
  consecutive_neutral_count: number;
  explanation: string;
}

export interface ArcDeliveryCheck {
  arc_transformation_visible: boolean;
  outcome_earned: boolean;
  explanation: string;
}

export interface OpeningCheck {
  opening_type_delivered: OpeningType;
  first_sentence: string;
  explanation: string;
}

export type ResonanceConfidence = "HIGH" | "MEDIUM" | "LOW";
export type ResonanceFlag = "RESONANCE_ABSENT" | "RESONANCE_WEAK" | null;

export interface EmotionalResonanceAssessment {
  active: boolean;
  target: string | null;
  resonance_delivered: boolean;
  resonance_confidence: ResonanceConfidence;
  resonance_note: string;
  flag: ResonanceFlag;
}

export interface DevEditorResult {
  chapter_number: number;
  scene_purpose_check: ScenePurposeCheck;
  false_progression_check: FalseProgressionCheck;
  scene_collision_check: SceneCollisionCheck;
  protagonist_agency_check: ProtagonistAgencyCheck | null;
  goal_desire_arc_check: GoalDesireArcCheck | null;
  arc_delivery_check: ArcDeliveryCheck | null;
  opening_check: OpeningCheck;
  emotional_resonance_assessment: EmotionalResonanceAssessment;
  flags: DevEditorFlag[];
  score: number;
  veto_scene_purpose: boolean;
}

// ── Structured Output Schema ────────────────────────────────────────────

const DEV_EDITOR_SCHEMA = {
  scene_purpose_check: {
    scene_purpose_delivered: "boolean",
    explanation: "string",
  },
  false_progression_check: {
    irreversible_change_delivered: "boolean",
    change_type: "CHARACTER_REVELATION|RELATIONSHIP_SHIFT|INFORMATION_DISCLOSED|PHYSICAL_CONSEQUENCE|POWER_TRANSFER|COMMITMENT_MADE|null",
    change_description: "string",
  },
  scene_collision_check: {
    collision_present: "boolean",
    collision_type: "CHARACTER_GOAL_COLLISION|INFORMATION_COLLISION|LOYALTY_COLLISION|TIMELINE_COLLISION|EXPECTATION_COLLISION|NO_COLLISION|COLLISION_WEAK",
    collision_description: "string",
  },
  protagonist_agency_check: {
    decision_type_delivered: "PROACTIVE|REACTIVE|NEUTRAL",
    explanation: "string",
  },
  goal_desire_arc_check: {
    gap_movement: "CLOSING|WIDENING|NEUTRAL",
    explanation: "string",
  },
  arc_delivery_check: {
    arc_transformation_visible: "boolean",
    outcome_earned: "boolean",
    explanation: "string",
  },
  opening_check: {
    opening_type_delivered: "MID_ACTION|SENSORY_DETAIL|DIALOGUE_IN_PROGRESS|MICRO_MYSTERY|BANNED",
    first_sentence: "string",
    explanation: "string",
  },
};

// ── System Prompt ───────────────────────────────────────────────────────

function buildSystemPrompt(
  scenePurpose: string,
  chapterNumber: number,
  act: number,
  isConsequenceChapter: boolean,
  consecutiveReactiveCount: number,
  consecutiveNeutralCount: number,
  emotionalResonanceTarget?: string | null,
): string {
  const conditionalChecks: string[] = [];

  if (act === 2) {
    conditionalChecks.push(`
PROTAGONIST AGENCY CHECK (Act 2 — active):
Evaluate whether the protagonist makes a PROACTIVE, REACTIVE, or NEUTRAL decision.
The current consecutive REACTIVE count is ${consecutiveReactiveCount}.
If REACTIVE, increment the count. If 3+ consecutive REACTIVE → flag PASSIVITY_PATTERN WARNING.`);
  }

  if (chapterNumber >= 10) {
    conditionalChecks.push(`
GOAL/DESIRE ARC CHECK (Chapter 10+ — active):
Evaluate whether the gap between the protagonist's external goal and internal desire is CLOSING, WIDENING, or NEUTRAL.
The current consecutive NEUTRAL count is ${consecutiveNeutralCount}.
If NEUTRAL, increment. If 3+ consecutive NEUTRAL → flag GOAL_DESIRE_NEUTRAL NOTE.`);
  }

  if (isConsequenceChapter) {
    conditionalChecks.push(`
ARC DELIVERY CHECK (consequence chapter — active):
Is the arc transformation visible (shown, not stated)?
Is the outcome earned by prior chapter events?
If not visible → ARC_DELIVERY_STATED_NOT_SHOWN WARNING
If not earned → ARC_DELIVERY_UNEARNED CRITICAL`);
  }

  return `You are a developmental editor for commercial psychological thrillers. Analyze the chapter structurally.

DECLARED SCENE PURPOSE: "${scenePurpose}"

Perform ALL of these checks:

1. SCENE PURPOSE CHECK: Did this chapter deliver its declared scene purpose? Be rigorous — partial delivery is not delivery.

2. FALSE PROGRESSION CHECK (HIGHEST PRIORITY):
Did something genuinely change in this chapter that CANNOT be undone? Check for these irreversible change types:
- CHARACTER_REVELATION: A character reveals something about themselves that changes how they are understood
- RELATIONSHIP_SHIFT: A relationship fundamentally changes (trust broken, alliance formed, betrayal committed)
- INFORMATION_DISCLOSED: Information is revealed that changes the landscape of the story
- PHYSICAL_CONSEQUENCE: A physical event occurs that cannot be reversed
- POWER_TRANSFER: Power dynamics between characters shift
- COMMITMENT_MADE: A character commits to a course of action they cannot easily withdraw from
If NO irreversible change → this is FALSE PROGRESSION. The chapter advanced plot events but the reader leaves in the same position they entered.

3. SCENE COLLISION CHECK: Is there a collision of forces in this scene?
Types: CHARACTER_GOAL_COLLISION, INFORMATION_COLLISION, LOYALTY_COLLISION, TIMELINE_COLLISION, EXPECTATION_COLLISION.
If none → NO_COLLISION. If present but weak → COLLISION_WEAK.

4. OPENING CHECK: What type is the opening sentence?
Permitted: MID_ACTION, SENSORY_DETAIL, DIALOGUE_IN_PROGRESS, MICRO_MYSTERY
Banned (R12 violation): weather/setting description opening, protagonist waking up, generic time/date stamp.
If banned → BANNED.
${conditionalChecks.join("\n")}

Return ONLY valid JSON matching this exact schema:
${JSON.stringify(DEV_EDITOR_SCHEMA, null, 2)}

All fields are required. For conditional checks not active, omit them (they will be null in the result).
Do NOT include any text outside the JSON object.`;
}

// ── Parse & Validate ────────────────────────────────────────────────────

function extractJSON(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown code blocks or surrounding text
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    // Try to find JSON object in the text
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      return JSON.parse(braceMatch[0]);
    }
    throw new Error("No valid JSON found in response");
  }
}

function validateDevEditorResponse(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (!d.scene_purpose_check || !d.false_progression_check || !d.scene_collision_check || !d.opening_check) {
    return false;
  }
  const spc = d.scene_purpose_check as Record<string, unknown>;
  if (typeof spc.scene_purpose_delivered !== "boolean") return false;
  const fpc = d.false_progression_check as Record<string, unknown>;
  if (typeof fpc.irreversible_change_delivered !== "boolean") return false;
  return true;
}

// ── Main Function ───────────────────────────────────────────────────────

export interface DevEditorInput {
  chapterNumber: number;
  chapterContent: string;
  scenePurpose: string;
  act: number;
  isConsequenceChapter: boolean;
  consecutiveReactiveCount: number;
  consecutiveNeutralCount: number;
  emotionalResonanceTarget?: string | null;
}

const MAX_RETRIES = 2;

export async function runDevelopmentalEditor(
  input: DevEditorInput
): Promise<DevEditorResult> {
  const systemPrompt = buildSystemPrompt(
    input.scenePurpose,
    input.chapterNumber,
    input.act,
    input.isConsequenceChapter,
    input.consecutiveReactiveCount,
    input.consecutiveNeutralCount,
  );

  const fullPrompt = `${systemPrompt}\n\n--- CHAPTER CONTENT ---\n\n${input.chapterContent}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callWithFallback("quality_analysis", fullPrompt, {
        temperature: 0.2,
        max_tokens: 2048,
      });

      const parsed = extractJSON(response.content);

      if (!validateDevEditorResponse(parsed)) {
        throw new Error("Schema validation failed — response does not match DevEditor schema");
      }

      const data = parsed as Record<string, unknown>;
      return assembleResult(data, input);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `[DevEditor] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`,
        lastError.message
      );
    }
  }

  throw new Error(
    `[DevEditor] All ${MAX_RETRIES + 1} attempts failed. Last error: ${lastError?.message}`
  );
}

// ── Result Assembly ─────────────────────────────────────────────────────

function assembleResult(
  data: Record<string, unknown>,
  input: DevEditorInput
): DevEditorResult {
  const spc = data.scene_purpose_check as Record<string, unknown>;
  const fpc = data.false_progression_check as Record<string, unknown>;
  const scc = data.scene_collision_check as Record<string, unknown>;
  const oc = data.opening_check as Record<string, unknown>;

  const flags: DevEditorFlag[] = [];
  let score = 10;

  // ── Scene Purpose ──
  const scenePurposeCheck: ScenePurposeCheck = {
    scene_purpose_delivered: spc.scene_purpose_delivered as boolean,
    explanation: (spc.explanation as string) ?? "",
  };

  if (!scenePurposeCheck.scene_purpose_delivered) {
    flags.push({
      code: "SCENE_PURPOSE_FAILED",
      severity: "CRITICAL",
      message: "Scene did not deliver its declared purpose.",
      instruction: "This chapter must be regenerated with a clear delivery of the scene purpose.",
    });
    score -= 4;
  }

  // ── False Progression (CRITICAL — highest weight) ──
  const falseProgressionCheck: FalseProgressionCheck = {
    irreversible_change_delivered: fpc.irreversible_change_delivered as boolean,
    change_type: (fpc.change_type as IrreversibleChangeType) ?? null,
    change_description: (fpc.change_description as string) ?? "",
  };

  if (!falseProgressionCheck.irreversible_change_delivered) {
    flags.push({
      code: "FALSE_PROGRESSION",
      severity: "CRITICAL",
      message: "No irreversible change delivered. Reader leaves in the same position they entered.",
      instruction: "This chapter advanced plot events but delivered no irreversible change. The reader leaves in the same position they entered. Identify the single most load-bearing change this chapter could make and rebuild around it.",
    });
    score -= 3.5;
  }

  // ── Scene Collision ──
  const collisionType = (scc.collision_type as CollisionType) ?? "NO_COLLISION";
  const sceneCollisionCheck: SceneCollisionCheck = {
    collision_present: (scc.collision_present as boolean) ?? false,
    collision_type: collisionType,
    collision_description: (scc.collision_description as string) ?? "",
  };

  if (collisionType === "NO_COLLISION") {
    flags.push({
      code: "NO_COLLISION",
      severity: "WARNING",
      message: "No collision of forces detected. Scene may be missing its structural function.",
    });
    score -= 1.5;
  } else if (collisionType === "COLLISION_WEAK") {
    flags.push({
      code: "COLLISION_WEAK",
      severity: "NOTE",
      message: "Collision present but weak. Consider strengthening the opposing forces.",
    });
    score -= 0.5;
  }

  // ── Protagonist Agency (Act 2 only) ──
  let protagonistAgencyCheck: ProtagonistAgencyCheck | null = null;
  if (input.act === 2 && data.protagonist_agency_check) {
    const pac = data.protagonist_agency_check as Record<string, unknown>;
    const decisionType = (pac.decision_type_delivered as DecisionType) ?? "NEUTRAL";
    let reactiveCount = input.consecutiveReactiveCount;

    if (decisionType === "REACTIVE") {
      reactiveCount += 1;
    } else {
      reactiveCount = 0;
    }

    protagonistAgencyCheck = {
      decision_type_delivered: decisionType,
      consecutive_reactive_count: reactiveCount,
      explanation: (pac.explanation as string) ?? "",
    };

    if (reactiveCount >= 3) {
      flags.push({
        code: "PASSIVITY_PATTERN",
        severity: "WARNING",
        message: `Protagonist has been REACTIVE for ${reactiveCount} consecutive chapters. Pacing-intolerant readers will disengage.`,
        instruction: "The protagonist must make a proactive decision in the next chapter. Passivity beyond 3 chapters breaks the compulsion loop.",
      });
      score -= 1.5;
    }
  }

  // ── Goal/Desire Arc (Chapter 10+) ──
  let goalDesireArcCheck: GoalDesireArcCheck | null = null;
  if (input.chapterNumber >= 10 && data.goal_desire_arc_check) {
    const gdac = data.goal_desire_arc_check as Record<string, unknown>;
    const movement = (gdac.gap_movement as GapMovement) ?? "NEUTRAL";
    let neutralCount = input.consecutiveNeutralCount;

    if (movement === "NEUTRAL") {
      neutralCount += 1;
    } else {
      neutralCount = 0;
    }

    goalDesireArcCheck = {
      gap_movement: movement,
      consecutive_neutral_count: neutralCount,
      explanation: (gdac.explanation as string) ?? "",
    };

    if (neutralCount >= 3) {
      flags.push({
        code: "GOAL_DESIRE_NEUTRAL",
        severity: "NOTE",
        message: `Goal/desire gap has been NEUTRAL for ${neutralCount} consecutive chapters. Arc may be stalling.`,
      });
      score -= 0.5;
    }
  }

  // ── Arc Delivery (consequence chapter only) ──
  let arcDeliveryCheck: ArcDeliveryCheck | null = null;
  if (input.isConsequenceChapter && data.arc_delivery_check) {
    const adc = data.arc_delivery_check as Record<string, unknown>;
    arcDeliveryCheck = {
      arc_transformation_visible: (adc.arc_transformation_visible as boolean) ?? false,
      outcome_earned: (adc.outcome_earned as boolean) ?? false,
      explanation: (adc.explanation as string) ?? "",
    };

    if (!arcDeliveryCheck.outcome_earned) {
      flags.push({
        code: "ARC_DELIVERY_UNEARNED",
        severity: "CRITICAL",
        message: "Arc outcome is not earned by prior chapter events.",
        instruction: "The arc transformation must be supported by events in preceding chapters. If it reads as unearned, the reader's investment collapses.",
      });
      score -= 2;
    } else if (!arcDeliveryCheck.arc_transformation_visible) {
      flags.push({
        code: "ARC_DELIVERY_STATED_NOT_SHOWN",
        severity: "WARNING",
        message: "Arc transformation is stated but not shown through behaviour or consequence.",
      });
      score -= 1;
    }
  }

  // ── Opening Check ──
  const openingType = (oc.opening_type_delivered as OpeningType) ?? "MID_ACTION";
  const openingCheck: OpeningCheck = {
    opening_type_delivered: openingType,
    first_sentence: (oc.first_sentence as string) ?? "",
    explanation: (oc.explanation as string) ?? "",
  };

  if (openingType === "BANNED") {
    flags.push({
      code: "OPENING_BANNED",
      severity: "CRITICAL",
      message: "Opening sentence uses a banned pattern (R12 violation).",
      instruction: "Chapter must open with one of: MID_ACTION, SENSORY_DETAIL, DIALOGUE_IN_PROGRESS, or MICRO_MYSTERY. Never weather/setting description, protagonist waking, or generic time/date.",
    });
    score -= 2;
  }

  // Clamp score
  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));

  return {
    chapter_number: input.chapterNumber,
    scene_purpose_check: scenePurposeCheck,
    false_progression_check: falseProgressionCheck,
    scene_collision_check: sceneCollisionCheck,
    protagonist_agency_check: protagonistAgencyCheck,
    goal_desire_arc_check: goalDesireArcCheck,
    arc_delivery_check: arcDeliveryCheck,
    opening_check: openingCheck,
    flags,
    score,
    veto_scene_purpose: !scenePurposeCheck.scene_purpose_delivered,
  };
}

// ── Console exposure ────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_devEditor = {
    runDevelopmentalEditor,
  };
}
