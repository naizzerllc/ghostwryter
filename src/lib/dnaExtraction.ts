/**
 * DNA Extraction Engine — LLM-powered extraction from braindump text.
 * Routes via Anthropic (dna_extraction task type) with Prose DNA injected.
 * GHOSTLY v2.2 · Session 6
 */

import { callAnthropic } from "@/api/llmRouter";
import type {
  DnaQuestion,
  DnaAnswer,
  DnaGap,
  ExtractionResult,
  SavedFragment,
  QuestionPhase,
  GapType,
} from "@/types/dna";

// ── The 12 DNA Questions ────────────────────────────────────────────────

export const DNA_QUESTIONS: DnaQuestion[] = [
  // Character phase
  {
    id: "protagonist_wound",
    label: "Protagonist Wound",
    phase: "character",
    description: "What is the protagonist's core wound — the thing they cannot look at directly?",
    gap_type: "OPEN",
  },
  {
    id: "medical_mechanism",
    label: "Medical Mechanism",
    phase: "character",
    description: "How is medicine weaponised in this story? What clinical mechanism enables the crime?",
    gap_type: "CANDIDATE_OPTIONS",
  },
  {
    id: "antagonist_type",
    label: "Antagonist Type",
    phase: "character",
    description: "What kind of antagonist drives this story? How do they exert pressure?",
    gap_type: "CANDIDATE_OPTIONS",
  },
  {
    id: "protagonist_complicity",
    label: "Protagonist Complicity Moment",
    phase: "character",
    description: "How is the protagonist complicit before they are victimised? What did they do or fail to do?",
    gap_type: "OPEN",
  },
  // World phase
  {
    id: "moral_question",
    label: "Moral Question",
    phase: "world",
    description: "What moral question does this novel force the reader to sit with? Not answered — asked.",
    gap_type: "OPEN",
  },
  {
    id: "self_deception_category",
    label: "Self-Deception Category",
    phase: "world",
    description: "What category of self-deception defines the narrator's unreliability? How do they lie to themselves?",
    gap_type: "CANDIDATE_OPTIONS",
  },
  {
    id: "revelation_mechanism",
    label: "Revelation Mechanism",
    phase: "world",
    description: "How does the truth surface? What is the mechanism of revelation?",
    gap_type: "CANDIDATE_OPTIONS",
  },
  // Structure phase
  {
    id: "active_tropes",
    label: "Active Tropes",
    phase: "structure",
    description: "Which rotating tropes (A/B/C) are active for this book?",
    gap_type: "FORCED_CHOICE",
  },
  {
    id: "narrator_frame",
    label: "Narrator Frame",
    phase: "structure",
    description: "What is the narrative frame? Is this a confession, a testimony, a reconstruction?",
    gap_type: "FORCED_CHOICE",
  },
  {
    id: "thematic_core",
    label: "Thematic Core",
    phase: "structure",
    description: "What is the single-sentence thematic core of this novel?",
    gap_type: "OPEN",
  },
  // Voice phase
  {
    id: "story_world_specificity",
    label: "Story World Specificity",
    phase: "voice",
    description: "What specific institutional or medical world does this story inhabit? Name the department, the protocol, the hierarchy.",
    gap_type: "OPEN",
  },
  {
    id: "opening_image",
    label: "Opening Image",
    phase: "voice",
    description: "What is the opening image — the first thing the reader sees, rendered in the clinical-dissociative register?",
    gap_type: "OPEN",
  },
];

// ── Extraction system prompt ────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are the DNA Extraction Engine for the Leila Rex fiction platform. Your job is to read a writer's raw braindump and extract structured answers to 12 DNA questions.

For each question, determine:
- FOUND: The braindump contains enough information to answer this question. Extract the answer and note source fragments.
- GAP: The braindump does not contain enough information. Mark as GAP.

Also identify any fragments in the braindump that don't fit the current book but might be useful for future books — save these as saved_fragments.

The 12 questions:
${DNA_QUESTIONS.map((q, i) => `${i + 1}. ${q.id}: ${q.description}`).join("\n")}

Respond in strict JSON format:
{
  "answers": [
    {
      "question_id": "protagonist_wound",
      "status": "FOUND" | "GAP",
      "answer": "extracted answer or empty string if GAP",
      "source_fragments": ["relevant quotes from braindump"]
    }
  ],
  "saved_fragments": [
    {
      "text": "fragment text",
      "possible_use": "what this might be useful for"
    }
  ]
}

Rules:
- Every question must appear in answers — no omissions
- FOUND requires a specific answer, not a vague restatement
- Source fragments must be actual quotes from the braindump
- Saved fragments are optional — only include genuinely useful ones
- Do not invent answers — if the braindump doesn't address it, mark GAP`;

// ── Extract DNA from braindump ──────────────────────────────────────────

export async function extractDna(
  braindumpText: string,
  projectId: string,
): Promise<ExtractionResult> {
  const response = await callAnthropic(
    "dna_extraction",
    EXTRACTION_SYSTEM_PROMPT,
    `BRAINDUMP:\n\n${braindumpText}`,
    { max_tokens: 4096, temperature: 0.3 },
  );

  // Parse LLM response
  let parsed: {
    answers: Array<{
      question_id: string;
      status: string;
      answer: string;
      source_fragments: string[];
    }>;
    saved_fragments?: Array<{
      text: string;
      possible_use: string;
    }>;
  };

  try {
    // Extract JSON from response (may have markdown wrapping)
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("[DNA Extraction] Failed to parse LLM response:", e);
    throw new Error("DNA extraction failed — invalid response from LLM");
  }

  // Map to typed structures
  const answers: DnaAnswer[] = DNA_QUESTIONS.map((q) => {
    const found = parsed.answers.find((a) => a.question_id === q.id);
    if (found && found.status === "FOUND" && found.answer) {
      return {
        question_id: q.id,
        status: "FOUND" as const,
        answer: found.answer,
        source_fragments: found.source_fragments || [],
      };
    }
    return {
      question_id: q.id,
      status: "GAP" as const,
      answer: "",
      source_fragments: [],
      gap_type: q.gap_type,
    };
  });

  const gaps: DnaGap[] = answers
    .filter((a) => a.status === "GAP")
    .map((a) => {
      const q = DNA_QUESTIONS.find((q) => q.id === a.question_id)!;
      return {
        question_id: q.id,
        label: q.label,
        gap_type: q.gap_type,
        phase: q.phase,
      };
    });

  const savedFragments: SavedFragment[] = (parsed.saved_fragments || []).map(
    (f) => ({
      text: f.text,
      possible_use: f.possible_use,
      status: "AVAILABLE" as const,
      source_project_id: projectId,
      captured_at: new Date().toISOString(),
    }),
  );

  return {
    answers,
    gaps,
    saved_fragments: savedFragments,
    raw_braindump: braindumpText,
    extracted_at: new Date().toISOString(),
  };
}

export function getQuestionsByPhase(
  phase: QuestionPhase,
): DnaQuestion[] {
  return DNA_QUESTIONS.filter((q) => q.phase === phase);
}

export function getQuestionById(id: string): DnaQuestion | undefined {
  return DNA_QUESTIONS.find((q) => q.id === id);
}
