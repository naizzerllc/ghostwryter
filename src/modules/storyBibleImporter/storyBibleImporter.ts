/**
 * Story Bible Importer — JSON/MD parser, MIC validation, project_config_record creation.
 * GHOSTLY v2.2 · Prompt 02 MSG-3
 *
 * Validates imported story bibles against MODULE_INTERFACE_CONTRACT.json v2.1 schemas.
 * Produces ImportDiagnostic with structured error/warning/info entries.
 */

import type {
  StoryBible, ProjectConfigRecord, ChapterOutlineRecord,
  CatalogueRegistryRecord, ImportDiagnostic, DiagnosticEntry,
  DiagnosticSeverity, GenreMode, TwistArchitecture, NarratorReliability,
  HookType, OpeningType, ProtagonistDecisionType, ReaderInformationMode,
} from "./types";

// ── Enum value sets (from MIC v2.1) ─────────────────────────────────────
const GENRE_MODES: GenreMode[] = ["psychological_thriller", "standard_thriller"];
const TWIST_ARCHITECTURES: TwistArchitecture[] = ["active", "none"];
const NARRATOR_RELIABILITIES: NarratorReliability[] = ["unreliable", "ambiguous", "reliable"];
const HOOK_TYPES: HookType[] = ["REVELATION", "THREAT", "DECISION", "THE_LIE", "NEW_QUESTION"];
const OPENING_TYPES: OpeningType[] = ["action_mid_scene", "sensory_disorientation", "dialogue_no_tag", "object_close_up"];
const PROTAGONIST_DECISION_TYPES: ProtagonistDecisionType[] = ["active", "passive_justified", "forced"];
const READER_INFO_MODES: ReaderInformationMode[] = ["dramatic_irony", "shared_discovery", "delayed_reveal"];

// ── Helper: add diagnostic entry ────────────────────────────────────────
function diag(
  entries: DiagnosticEntry[],
  severity: DiagnosticSeverity,
  path: string,
  message: string,
) {
  entries.push({ severity, path, message });
}

// ── JSON parser ─────────────────────────────────────────────────────────
function parseJSON(raw: string): { data: unknown; error?: string } {
  try {
    return { data: JSON.parse(raw) };
  } catch (e) {
    return { data: null, error: `JSON parse error: ${(e as Error).message}` };
  }
}

// ── MD front-matter parser (YAML-like key: value) ───────────────────────
function parseMDFrontMatter(raw: string): { data: Record<string, unknown>; body: string; error?: string } {
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!fmMatch) {
    return { data: {}, body: raw, error: "No YAML front-matter block found (expected --- delimiters)" };
  }
  const lines = fmMatch[1].split("\n");
  const data: Record<string, unknown> = {};
  for (const line of lines) {
    const match = line.match(/^(\w[\w_]*):\s*(.+)$/);
    if (match) {
      const val = match[2].trim();
      // Attempt number parse
      if (/^\d+(\.\d+)?$/.test(val)) data[match[1]] = Number(val);
      else if (val === "true") data[match[1]] = true;
      else if (val === "false") data[match[1]] = false;
      else data[match[1]] = val;
    }
  }
  return { data, body: fmMatch[2] };
}

// ── Validate project_config_record ──────────────────────────────────────
function validateProjectConfig(cfg: Record<string, unknown>, entries: DiagnosticEntry[]): ProjectConfigRecord | null {
  const p = "project_config";

  // Required enums
  if (!cfg.genre_mode || !GENRE_MODES.includes(cfg.genre_mode as GenreMode)) {
    diag(entries, "error", `${p}.genre_mode`, `Must be one of: ${GENRE_MODES.join(", ")}`);
  }
  if (!cfg.twist_architecture || !TWIST_ARCHITECTURES.includes(cfg.twist_architecture as TwistArchitecture)) {
    diag(entries, "error", `${p}.twist_architecture`, `Must be one of: ${TWIST_ARCHITECTURES.join(", ")}`);
  }
  if (!cfg.narrator_reliability || !NARRATOR_RELIABILITIES.includes(cfg.narrator_reliability as NarratorReliability)) {
    diag(entries, "error", `${p}.narrator_reliability`, `Must be one of: ${NARRATOR_RELIABILITIES.join(", ")}`);
  }

  // Required number
  if (typeof cfg.revelation_chapter !== "number" || cfg.revelation_chapter < 1) {
    diag(entries, "error", `${p}.revelation_chapter`, "Must be a positive number");
  }

  // Required object: reader_simulation_persona
  const rsp = cfg.reader_simulation_persona as Record<string, unknown> | undefined;
  if (!rsp || typeof rsp !== "object") {
    diag(entries, "error", `${p}.reader_simulation_persona`, "Required object missing");
  } else {
    if (!rsp.active_persona || typeof rsp.active_persona !== "string") {
      diag(entries, "error", `${p}.reader_simulation_persona.active_persona`, "Required string");
    }
    if (rsp.injection_target !== "reader_simulation_system_prompt") {
      diag(entries, "warning", `${p}.reader_simulation_persona.injection_target`, 'Should be "reader_simulation_system_prompt"');
    }
  }

  // Genre-specific validation
  if (cfg.genre_mode === "psychological_thriller") {
    if (cfg.twist_architecture !== "active") {
      diag(entries, "error", `${p}.twist_architecture`, 'Must be "active" for psychological_thriller');
    }
    if (cfg.narrator_reliability === "reliable") {
      diag(entries, "warning", `${p}.narrator_reliability`, 'psychological_thriller typically uses unreliable/ambiguous narrator');
    }
  }

  // Optional defaults
  const hasErrors = entries.some(e => e.severity === "error" && e.path.startsWith(p));
  if (hasErrors) return null;

  return {
    genre_mode: cfg.genre_mode as GenreMode,
    twist_architecture: cfg.twist_architecture as TwistArchitecture,
    narrator_reliability: cfg.narrator_reliability as NarratorReliability,
    revelation_chapter: cfg.revelation_chapter as number,
    override_log: Array.isArray(cfg.override_log) ? cfg.override_log as ProjectConfigRecord["override_log"] : [],
    breadcrumb_landing_summary: (cfg.breadcrumb_landing_summary as ProjectConfigRecord["breadcrumb_landing_summary"]) ?? { total_breadcrumbs: 0, landed: 0, pending: 0, orphaned: 0 },
    cost_log: Array.isArray(cfg.cost_log) ? cfg.cost_log as ProjectConfigRecord["cost_log"] : [],
    reader_simulation_persona: rsp as unknown as ProjectConfigRecord["reader_simulation_persona"],
    last_anthropic_model: (cfg.last_anthropic_model as string) ?? "",
    voice_benchmark_baseline: (cfg.voice_benchmark_baseline as ProjectConfigRecord["voice_benchmark_baseline"]) ?? null,
    token_budget_audit: (cfg.token_budget_audit as ProjectConfigRecord["token_budget_audit"]) ?? { generation_ceiling: 10000, quality_ceiling: 2900, reader_sim_ceiling: 2300, last_checked: "" },
    outline_amendment_record: Array.isArray(cfg.outline_amendment_record) ? cfg.outline_amendment_record as ProjectConfigRecord["outline_amendment_record"] : [],
  };
}

// ── Validate chapter_outline_record ─────────────────────────────────────
function validateChapter(
  ch: Record<string, unknown>,
  index: number,
  genreMode: string | undefined,
  revelationChapter: number | undefined,
  entries: DiagnosticEntry[],
): ChapterOutlineRecord | null {
  const p = `chapters[${index}]`;
  const requiredStrings: (keyof ChapterOutlineRecord)[] = [
    "timeline_id", "scene_purpose", "hook_seed", "opening_seed",
    "collision_specification", "permanent_change",
  ];

  if (typeof ch.chapter_number !== "number") {
    diag(entries, "error", `${p}.chapter_number`, "Required number");
  }

  for (const f of requiredStrings) {
    if (!ch[f] || typeof ch[f] !== "string") {
      diag(entries, "error", `${p}.${f}`, "Required non-empty string");
    }
  }

  if (!ch.hook_type || !HOOK_TYPES.includes(ch.hook_type as HookType)) {
    diag(entries, "error", `${p}.hook_type`, `Must be one of: ${HOOK_TYPES.join(", ")}`);
  }
  if (!ch.opening_type || !OPENING_TYPES.includes(ch.opening_type as OpeningType)) {
    diag(entries, "error", `${p}.opening_type`, `Must be one of: ${OPENING_TYPES.join(", ")}`);
  }
  if (!ch.protagonist_decision_type || !PROTAGONIST_DECISION_TYPES.includes(ch.protagonist_decision_type as ProtagonistDecisionType)) {
    diag(entries, "error", `${p}.protagonist_decision_type`, `Must be one of: ${PROTAGONIST_DECISION_TYPES.join(", ")}`);
  }
  if (!ch.reader_information_mode || !READER_INFO_MODES.includes(ch.reader_information_mode as ReaderInformationMode)) {
    diag(entries, "error", `${p}.reader_information_mode`, `Must be one of: ${READER_INFO_MODES.join(", ")}`);
  }

  // tension_score_target: 1–10
  if (typeof ch.tension_score_target !== "number" || ch.tension_score_target < 1 || ch.tension_score_target > 10) {
    diag(entries, "error", `${p}.tension_score_target`, "Must be a number between 1 and 10");
  }

  // narrator_deception_gesture: required when psych thriller pre-revelation
  const chNum = ch.chapter_number as number;
  const revCh = revelationChapter ?? Infinity;
  if (genreMode === "psychological_thriller" && chNum < revCh) {
    if (!ch.narrator_deception_gesture || typeof ch.narrator_deception_gesture !== "string") {
      diag(entries, "error", `${p}.narrator_deception_gesture`, "Required for psychological_thriller pre-revelation chapters");
    }
  }

  // compulsion_floor_note warning
  if (typeof ch.tension_score_target === "number" && ch.tension_score_target < 5 && !ch.compulsion_floor_note) {
    diag(entries, "warning", `${p}.compulsion_floor_note`, "Recommended when tension_score_target < 5 to avoid hard veto");
  }

  const hasErrors = entries.some(e => e.severity === "error" && e.path.startsWith(p));
  if (hasErrors) return null;

  return ch as unknown as ChapterOutlineRecord;
}

// ── Validate catalogue_registry_record ──────────────────────────────────
function validateCatalogueEntry(
  cat: Record<string, unknown>,
  entries: DiagnosticEntry[],
): CatalogueRegistryRecord | null {
  const p = "catalogue_entry";
  const requiredStrings = ["title_id", "self_deception_category", "protagonist_wound_type", "antagonist_type", "revelation_mechanism"];

  for (const f of requiredStrings) {
    if (!cat[f] || typeof cat[f] !== "string") {
      diag(entries, "error", `${p}.${f}`, "Required non-empty string");
    }
  }

  if (!Array.isArray(cat.key_imagery_set)) {
    diag(entries, "warning", `${p}.key_imagery_set`, "Should be an array of strings — defaulting to empty");
  }

  const hasErrors = entries.some(e => e.severity === "error" && e.path.startsWith(p));
  if (hasErrors) return null;

  return {
    ...(cat as unknown as CatalogueRegistryRecord),
    key_imagery_set: Array.isArray(cat.key_imagery_set) ? cat.key_imagery_set as string[] : [],
  };
}

// ── Main import function ────────────────────────────────────────────────
type StoryBibleStore = {
  projectConfig: ProjectConfigRecord | null;
  chapters: ChapterOutlineRecord[];
  catalogueEntry: CatalogueRegistryRecord | null;
  lastDiagnostic: ImportDiagnostic | null;
  listeners: Set<() => void>;
};

const store: StoryBibleStore = {
  projectConfig: null,
  chapters: [],
  catalogueEntry: null,
  lastDiagnostic: null,
  listeners: new Set(),
};

function notify() {
  store.listeners.forEach((fn) => fn());
}

export function importStoryBible(raw: string, format: "json" | "md"): ImportDiagnostic {
  const entries: DiagnosticEntry[] = [];
  let parsed: Record<string, unknown> | null = null;

  if (format === "json") {
    const { data, error } = parseJSON(raw);
    if (error) {
      diag(entries, "error", "root", error);
      const result = buildDiagnostic(entries, false, 0, false);
      store.lastDiagnostic = result;
      notify();
      return result;
    }
    parsed = data as Record<string, unknown>;
  } else {
    const { data, error } = parseMDFrontMatter(raw);
    if (error) {
      diag(entries, "warning", "root", error);
    }
    parsed = data;
  }

  if (!parsed || typeof parsed !== "object") {
    diag(entries, "error", "root", "Parsed data is not an object");
    const result = buildDiagnostic(entries, false, 0, false);
    store.lastDiagnostic = result;
    notify();
    return result;
  }

  // ── Validate project_config ─────────────────────────────────────────
  let projectConfig: ProjectConfigRecord | null = null;
  const cfgRaw = parsed.project_config as Record<string, unknown> | undefined;
  if (!cfgRaw || typeof cfgRaw !== "object") {
    diag(entries, "error", "project_config", "Missing required project_config object");
  } else {
    projectConfig = validateProjectConfig(cfgRaw, entries);
    if (projectConfig) {
      diag(entries, "info", "project_config", "project_config_record validated successfully");
    }
  }

  // ── Validate chapters ───────────────────────────────────────────────
  const validChapters: ChapterOutlineRecord[] = [];
  const chaptersRaw = parsed.chapters as Record<string, unknown>[] | undefined;
  if (chaptersRaw && Array.isArray(chaptersRaw)) {
    for (let i = 0; i < chaptersRaw.length; i++) {
      const ch = validateChapter(
        chaptersRaw[i],
        i,
        cfgRaw?.genre_mode as string | undefined,
        cfgRaw?.revelation_chapter as number | undefined,
        entries,
      );
      if (ch) validChapters.push(ch);
    }
    diag(entries, "info", "chapters", `${validChapters.length}/${chaptersRaw.length} chapters validated`);
  } else {
    diag(entries, "info", "chapters", "No chapters array provided — skipped");
  }

  // ── Validate catalogue entry ────────────────────────────────────────
  let catalogueEntry: CatalogueRegistryRecord | null = null;
  const catRaw = parsed.catalogue_entry as Record<string, unknown> | undefined;
  if (catRaw && typeof catRaw === "object") {
    catalogueEntry = validateCatalogueEntry(catRaw, entries);
    if (catalogueEntry) {
      diag(entries, "info", "catalogue_entry", "catalogue_registry_record validated");
    }
  } else {
    diag(entries, "info", "catalogue_entry", "No catalogue_entry provided — skipped");
  }

  // ── Store results ───────────────────────────────────────────────────
  store.projectConfig = projectConfig;
  store.chapters = validChapters;
  store.catalogueEntry = catalogueEntry;

  const result = buildDiagnostic(
    entries,
    projectConfig !== null,
    validChapters.length,
    catalogueEntry !== null,
  );
  store.lastDiagnostic = result;
  notify();
  return result;
}

function buildDiagnostic(
  entries: DiagnosticEntry[],
  configCreated: boolean,
  chapterCount: number,
  catalogueParsed: boolean,
): ImportDiagnostic {
  return {
    valid: !entries.some((e) => e.severity === "error"),
    errors: entries.filter((e) => e.severity === "error"),
    warnings: entries.filter((e) => e.severity === "warning"),
    info: entries.filter((e) => e.severity === "info"),
    project_config_created: configCreated,
    chapters_parsed: chapterCount,
    catalogue_entry_parsed: catalogueParsed,
  };
}

// ── External store API (useSyncExternalStore) ───────────────────────────
export function getStoryBibleSnapshot() {
  return store;
}

export function subscribeStoryBible(callback: () => void) {
  store.listeners.add(callback);
  return () => { store.listeners.delete(callback); };
}

export function getProjectConfig(): ProjectConfigRecord | null {
  return store.projectConfig;
}

export function getChapters(): ChapterOutlineRecord[] {
  return store.chapters;
}

export function getCatalogueEntry(): CatalogueRegistryRecord | null {
  return store.catalogueEntry;
}

// ── Window registration for console testing ─────────────────────────────
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_storyBibleImporter = {
    importStoryBible,
    getProjectConfig,
    getChapters,
    getCatalogueEntry,
    getStoryBibleSnapshot,
  };
}
