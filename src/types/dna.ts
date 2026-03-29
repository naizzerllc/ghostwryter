/**
 * DNA Intake types — GHOSTLY v2.2 · Session 6/7
 */

// ── Brand DNA Config (mirrors BRAND_DNA_CONFIG.json) ────────────────────

export interface BrandTrope {
  id: string;
  label: string;
  description: string;
  enabled_default: boolean;
  locked?: boolean;
  status?: "AVAILABLE" | "RESERVED";
}

export interface ThematicDna {
  id: string;
  label: string;
  description: string;
  locked: boolean;
}

export interface BrandDnaConfig {
  version: string;
  brand: string;
  permanent_tropes: BrandTrope[];
  rotating_tropes: BrandTrope[];
  rolling_overlap_pattern: Record<string, string[] | string>;
  thematic_dna: ThematicDna[];
  narrator_architecture: {
    type: string;
    description: string;
    locked: boolean;
  };
}

// ── Per-project DNA Config ──────────────────────────────────────────────

export interface ConstraintOverride {
  constraint_id: string;
  enabled: boolean;
  rationale: string;
  overridden_at: string;
}

export interface ProjectDnaConfig {
  project_id: string;
  active_permanent_tropes: string[];
  active_rotating_tropes: string[];
  constraint_overrides: ConstraintOverride[];
  brand_deviation: boolean; // true if any constraint disabled
  created_at: string;
  updated_at: string;
}

// ── DNA Questions & Extraction ──────────────────────────────────────────

export type GapType = "FORCED_CHOICE" | "CANDIDATE_OPTIONS" | "OPEN";
export type QuestionStatus = "FOUND" | "GAP" | "SKIPPED";
export type QuestionPhase = "character" | "world" | "structure" | "voice";

export interface DnaQuestion {
  id: string;
  label: string;
  phase: QuestionPhase;
  description: string;
  gap_type: GapType;
}

export interface DnaAnswer {
  question_id: string;
  status: QuestionStatus;
  answer: string;
  source_fragments: string[];
  gap_type?: GapType;
}

export interface DnaGap {
  question_id: string;
  label: string;
  gap_type: GapType;
  phase: QuestionPhase;
}

export interface SavedFragment {
  text: string;
  possible_use: string;
  status: "AVAILABLE" | "USED" | "DISCARDED";
  source_project_id: string;
  captured_at: string;
}

export interface ExtractionResult {
  answers: DnaAnswer[];
  gaps: DnaGap[];
  saved_fragments: SavedFragment[];
  raw_braindump: string;
  extracted_at: string;
}

// ── DNA Brief (export format) ───────────────────────────────────────────

export interface DnaBrief {
  project_id: string;
  project_title: string;
  answers: DnaAnswer[];
  active_constraints: string[];
  open_questions: string[];
  exported_at: string;
}

// ── Idea Bank ───────────────────────────────────────────────────────────

export interface IdeaBankEntry {
  id: string;
  text: string;
  possible_use: string;
  status: "AVAILABLE" | "USED" | "DISCARDED";
  source_project_id: string;
  captured_at: string;
}

export interface IdeaBank {
  version: string;
  entries: IdeaBankEntry[];
  updated_at: string;
}

// ── Intake stage tracking ───────────────────────────────────────────────

export type IntakeStage =
  | "BRAINDUMP"
  | "EXTRACTING"
  | "CONVERSATION"
  | "REVIEW"
  | "EXPORTING"
  | "COMPLETE";
