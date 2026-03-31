/**
 * Character DB Types — Matches character_record schema from MIC v2.1 (fields v2.0).
 * GHOSTLY v2.2 · S24
 */

export type CharacterRole = "protagonist" | "antagonist" | "supporting";
export type VoiceCorpusStatus = "PENDING" | "APPROVED" | "REJECTED";
export type VoiceReliability = "HIGH" | "MISSING";

export interface PsychologicalSliders {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

// ── Contradiction Matrix (v2.0) ─────────────────────────────────────────

export interface ContradictionBehavioural {
  stated_belief: string;
  actual_behaviour: string;
  blind_spot: boolean;
}

export interface ContradictionMoral {
  stated_principle: string;
  collapse_condition: string;
  guilt_residue: string | null;
}

export interface ContradictionHistorical {
  past_action: string;
  self_narrative: string;
  gap: string | null;
}

export interface ContradictionCompetence {
  exceptional_at: string;
  humiliated_by: string;
  origin: string | null;
}

export interface ContradictionMatrix {
  behavioural?: ContradictionBehavioural;
  moral?: ContradictionMoral;
  historical?: ContradictionHistorical;
  competence?: ContradictionCompetence;
}

export interface CharacterRecord {
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
  compressed_voice_dna: string;

  // v1.9 additions
  external_goal: string;
  internal_desire: string;
  goal_desire_gap: string;

  // v2.0 addition — contradiction matrix
  contradiction_matrix?: ContradictionMatrix;

  // Optional enrichment
  psychological_sliders?: PsychologicalSliders;

  // Voice corpus gate
  voice_corpus_status: VoiceCorpusStatus;
  voice_reliability: VoiceReliability;
  corpus_approved: boolean;
}

/** Required fields for validation — must be non-empty strings. */
export const CHARACTER_REQUIRED_FIELDS: (keyof CharacterRecord)[] = [
  "id", "name", "role", "wound", "flaw", "want", "need",
  "self_deception", "fear", "arc_start", "arc_end", "arc_lesson",
  "compressed_voice_dna", "external_goal", "internal_desire", "goal_desire_gap",
];
