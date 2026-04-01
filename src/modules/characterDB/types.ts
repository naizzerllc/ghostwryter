/**
 * Character DB Types — Aligned to 02C character_record schema.
 * GHOSTLY v2.2 · MIC v2.1 fields v2.0
 */

// 02C role subtypes: protagonist, antagonist, major_supporting, minor_supporting
// Legacy "supporting" kept as alias for backward compatibility
export type CharacterRole = "protagonist" | "antagonist" | "major_supporting" | "minor_supporting" | "supporting";
export type VoiceCorpusStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETE" | "PARTIAL" | "MISSING";
export type VoiceReliability = "HIGH" | "MISSING";

export interface PsychologicalSliders {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  machiavellianism?: number;   // extended in characterDatabase.ts
  empathy?: number;            // extended in characterDatabase.ts
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
  project_id?: string;             // 02C addition
  name: string;
  role: CharacterRole;
  classification?: string;

  // Psychological core
  wound: string | null;
  flaw?: string | null;            // legacy — not in 02C but kept for compat
  want: string | null;
  need: string | null;
  self_deception: string | null;
  fear: string | null;

  // v1.9 additions
  external_goal: string | null;
  internal_desire: string | null;
  goal_desire_gap: string | null;

  // v2.0 — contradiction matrix
  contradiction_matrix?: ContradictionMatrix;

  // Antagonist-specific fields (null for non-antagonists) — 02C
  mirror_relationship?: string | null;
  antagonist_self_deception?: string | null;
  antagonist_limit?: string | null;
  antagonist_inversion_chapter?: number | null;
  antagonist_inversion_truth?: string | null;
  threat_arc?: string | null;

  // Arc tracking (02C: arc_entry_state / arc_exit_state replace arc_start / arc_end)
  arc_entry_state?: string | null;
  arc_exit_state?: string | null;
  karma_arc?: string | null;
  // Legacy arc fields — kept for backward compat
  arc_start?: string;
  arc_end?: string;
  arc_lesson?: string;

  // Voice DNA
  compressed_voice_dna: string | null;

  // Optional enrichment
  psychological_sliders?: PsychologicalSliders;

  // Voice corpus gate
  voice_corpus_status: VoiceCorpusStatus;
  voice_reliability: VoiceReliability;
  corpus_approved: boolean;
  corpus_approval_date?: string | null;  // 02C addition

  // Meta — 02C
  created_at?: string;
  last_updated?: string;
}

/** Required fields for validation — must be non-empty strings. */
export const CHARACTER_REQUIRED_FIELDS: (keyof CharacterRecord)[] = [
  "id", "name", "role",
];

/**
 * Extended required fields for protagonist/antagonist records.
 * Validated separately — these are nullable but should be populated.
 */
export const CHARACTER_RECOMMENDED_FIELDS: (keyof CharacterRecord)[] = [
  "wound", "want", "need", "self_deception", "fear",
  "external_goal", "internal_desire", "goal_desire_gap",
  "compressed_voice_dna",
];
