/**
 * Story Bible Importer Types — Matches project_config_record + chapter_outline_record
 * from MIC v2.1 (fields v1.9). GHOSTLY v2.2 · Prompt 02 MSG-3
 */

// ── Genre & narrator enums ──────────────────────────────────────────────
export type GenreMode = "psychological_thriller" | "standard_thriller";
export type TwistArchitecture = "active" | "none";
export type NarratorReliability = "unreliable" | "ambiguous" | "reliable";

// ── Hook / opening enums (chapter_outline_record) ───────────────────────
export type HookType = "REVELATION" | "THREAT" | "DECISION" | "THE_LIE" | "NEW_QUESTION";
export type OpeningType = "action_mid_scene" | "sensory_disorientation" | "dialogue_no_tag" | "object_close_up";
export type ProtagonistDecisionType = "active" | "passive_justified" | "forced";
export type ReaderInformationMode = "dramatic_irony" | "shared_discovery" | "delayed_reveal";

// ── Project config record (MIC schema) ──────────────────────────────────
export interface ReaderSimulationPersona {
  active_persona: string;
  tolerance_profile: Record<string, unknown>;
  injection_target: "reader_simulation_system_prompt";
}

export interface BreadcrumbLandingSummary {
  total_breadcrumbs: number;
  landed: number;
  pending: number;
  orphaned: number;
}

export interface CostLogEntry {
  session_id: string;
  total_tokens: number;
  estimated_cost_usd: number;
  timestamp: string;
}

export interface VoiceBenchmarkBaseline {
  baseline_chapter: number;
  scores: Record<string, number>;
  captured_at: string;
}

export interface TokenBudgetAudit {
  generation_ceiling: number;
  quality_ceiling: number;
  reader_sim_ceiling: number;
  last_checked: string;
}

export interface OverrideLogEntry {
  timestamp: string;
  field: string;
  old_value: unknown;
  new_value: unknown;
  reason: string;
}

export interface OutlineAmendmentEntry {
  chapter: number;
  field: string;
  old_value: unknown;
  new_value: unknown;
  reason: string;
  timestamp: string;
}

export interface ProjectConfigRecord {
  genre_mode: GenreMode;
  twist_architecture: TwistArchitecture;
  narrator_reliability: NarratorReliability;
  revelation_chapter: number;
  override_log: OverrideLogEntry[];
  breadcrumb_landing_summary: BreadcrumbLandingSummary;
  cost_log: CostLogEntry[];
  reader_simulation_persona: ReaderSimulationPersona;
  last_anthropic_model: string;
  voice_benchmark_baseline: VoiceBenchmarkBaseline | null;
  token_budget_audit: TokenBudgetAudit;
  outline_amendment_record: OutlineAmendmentEntry[];
}

// ── Chapter outline record (MIC schema v2.8) ────────────────────────────
export interface ChapterOutlineRecord {
  chapter_number: number;
  timeline_id: string;
  scene_purpose: string;
  hook_type: HookType;
  hook_seed: string;
  narrator_deception_gesture?: string;
  tension_score_target: number;
  opening_type: OpeningType;
  opening_seed: string;
  compulsion_floor_note?: string | null;
  collision_specification: string;
  permanent_change: string;
  protagonist_decision_type: ProtagonistDecisionType;
  reader_information_mode: ReaderInformationMode;
}

// ── Catalogue registry record (MIC schema) ──────────────────────────────
export interface CatalogueRegistryRecord {
  title_id: string;
  self_deception_category: string;
  protagonist_wound_type: string;
  antagonist_type: string;
  revelation_mechanism: string;
  key_imagery_set: string[];
}

// ── Story Bible — top-level import payload ──────────────────────────────
export interface StoryBible {
  project_config: ProjectConfigRecord;
  chapters?: ChapterOutlineRecord[];
  catalogue_entry?: CatalogueRegistryRecord;
}

// ── Validation diagnostic ───────────────────────────────────────────────
export type DiagnosticSeverity = "error" | "warning" | "info";

export interface DiagnosticEntry {
  severity: DiagnosticSeverity;
  path: string;
  message: string;
}

export interface ImportDiagnostic {
  valid: boolean;
  errors: DiagnosticEntry[];
  warnings: DiagnosticEntry[];
  info: DiagnosticEntry[];
  project_config_created: boolean;
  chapters_parsed: number;
  catalogue_entry_parsed: boolean;
}
