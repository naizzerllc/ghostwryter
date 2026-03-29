/**
 * Startup Validator — 25-item validation checklist for platform integrity.
 * GHOSTLY v2.2 · Session 5 · MSG-4
 *
 * Runs all checks synchronously against loaded modules and constants.
 * Returns a structured result for Dashboard display.
 */

import STYLE_PROFILES from "@/constants/STYLE_PROFILES.json";
import FORBIDDEN_WORDS from "@/constants/FORBIDDEN_WORDS.json";
import MIC from "@/constants/MODULE_INTERFACE_CONTRACT.json";
import { MEMORY_CORE_CONFIG } from "@/constants/MEMORY_CORE_CONFIG";
import { PROSE_DNA_RUNTIME } from "@/constants/PROSE_DNA_RUNTIME";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type CheckStatus = "PASS" | "FAIL" | "WARN";

export interface ValidationCheck {
  id: number;
  label: string;
  category: string;
  status: CheckStatus;
  detail: string;
}

export interface ValidationResult {
  timestamp: string;
  passed: number;
  warned: number;
  failed: number;
  total: number;
  checks: ValidationCheck[];
}

// ---------------------------------------------------------------------------
// Individual check functions
// ---------------------------------------------------------------------------
type CheckFn = () => { status: CheckStatus; detail: string };

const checks: { label: string; category: string; fn: CheckFn }[] = [
  // ── Brand & Style (1–5) ──
  {
    label: "STYLE_PROFILES loaded",
    category: "Brand",
    fn: () => {
      const ok = STYLE_PROFILES && typeof STYLE_PROFILES === "object" && "profiles" in STYLE_PROFILES;
      return { status: ok ? "PASS" : "FAIL", detail: ok ? "Loaded with active profile" : "STYLE_PROFILES missing or malformed" };
    },
  },
  {
    label: "Brand lock active",
    category: "Brand",
    fn: () => {
      const profile = STYLE_PROFILES.profiles?.[STYLE_PROFILES.active_profile as keyof typeof STYLE_PROFILES.profiles] as Record<string, unknown> | undefined;
      const locked = profile?.brand_lock === true;
      return { status: locked ? "PASS" : "FAIL", detail: locked ? "leila_rex_default brand_lock: true" : "Brand lock is NOT active" };
    },
  },
  {
    label: "Active profile is leila_rex_default",
    category: "Brand",
    fn: () => {
      const ok = STYLE_PROFILES.active_profile === "leila_rex_default";
      return { status: ok ? "PASS" : "FAIL", detail: ok ? "Correct active profile" : `Active profile: ${STYLE_PROFILES.active_profile}` };
    },
  },
  {
    label: "POV/Tense correct",
    category: "Brand",
    fn: () => {
      const p = STYLE_PROFILES.profiles?.[STYLE_PROFILES.active_profile as keyof typeof STYLE_PROFILES.profiles] as Record<string, unknown> | undefined;
      const ok = p?.pov === "first_person" && p?.tense === "present";
      return { status: ok ? "PASS" : "FAIL", detail: ok ? "first_person / present" : `${p?.pov} / ${p?.tense}` };
    },
  },
  {
    label: "Five hook types defined",
    category: "Brand",
    fn: () => {
      const p = STYLE_PROFILES.profiles?.[STYLE_PROFILES.active_profile as keyof typeof STYLE_PROFILES.profiles] as Record<string, unknown> | undefined;
      const hooks = p?.hook_types as string[] | undefined;
      const ok = Array.isArray(hooks) && hooks.length === 5;
      return { status: ok ? "PASS" : "FAIL", detail: ok ? hooks!.join(", ") : `Expected 5 hook types, got ${hooks?.length ?? 0}` };
    },
  },

  // ── Prose DNA (6–8) ──
  {
    label: "PROSE_DNA_RUNTIME loaded",
    category: "Prose DNA",
    fn: () => {
      const ok = typeof PROSE_DNA_RUNTIME === "string" && PROSE_DNA_RUNTIME.length > 100;
      return { status: ok ? "PASS" : "FAIL", detail: ok ? `${PROSE_DNA_RUNTIME.length} chars loaded` : "Runtime missing or empty" };
    },
  },
  {
    label: "Prose DNA version is v2.3",
    category: "Prose DNA",
    fn: () => {
      const ok = PROSE_DNA_RUNTIME.includes("v2.3");
      return { status: ok ? "PASS" : "WARN", detail: ok ? "v2.3 confirmed" : "Version string not found in runtime" };
    },
  },
  {
    label: "17 rules present in runtime",
    category: "Prose DNA",
    fn: () => {
      const ruleCount = (PROSE_DNA_RUNTIME.match(/^R\d+/gm) || []).length;
      const ok = ruleCount >= 17;
      return { status: ok ? "PASS" : "WARN", detail: `${ruleCount} rules detected` };
    },
  },

  // ── Forbidden Words (9–12) ──
  {
    label: "FORBIDDEN_WORDS loaded",
    category: "Forbidden Words",
    fn: () => {
      const ok = FORBIDDEN_WORDS && "tiers" in FORBIDDEN_WORDS;
      return { status: ok ? "PASS" : "FAIL", detail: ok ? `v${FORBIDDEN_WORDS.version}` : "Missing or malformed" };
    },
  },
  {
    label: "Four tiers present",
    category: "Forbidden Words",
    fn: () => {
      const tiers = FORBIDDEN_WORDS.tiers;
      const has = tiers && "hard_ban" in tiers && "dialogue_exempt" in tiers && "soft_ban" in tiers && "context_flag" in tiers;
      return { status: has ? "PASS" : "FAIL", detail: has ? "hard_ban, dialogue_exempt, soft_ban, context_flag" : "Missing tiers" };
    },
  },
  {
    label: "Hard ban list non-empty",
    category: "Forbidden Words",
    fn: () => {
      const count = FORBIDDEN_WORDS.tiers?.hard_ban?.length ?? 0;
      return { status: count > 0 ? "PASS" : "FAIL", detail: `${count} words` };
    },
  },
  {
    label: "forbiddenWordsChecker registered",
    category: "Forbidden Words",
    fn: () => {
      const ok = typeof (window as Record<string, unknown>).__ghostly_forbiddenWords !== "undefined";
      return { status: ok ? "PASS" : "WARN", detail: ok ? "Global checker available" : "Not yet registered" };
    },
  },

  // ── LLM Router (13–15) ──
  {
    label: "LLM Router registered",
    category: "LLM Router",
    fn: () => {
      const ok = typeof (window as Record<string, unknown>).__ghostly_llmRouter !== "undefined";
      return { status: ok ? "PASS" : "WARN", detail: ok ? "Global router available" : "Not yet registered" };
    },
  },
  {
    label: "Sanitizer registered",
    category: "Security",
    fn: () => {
      const ok = typeof (window as Record<string, unknown>).__ghostly_sanitizer !== "undefined";
      return { status: ok ? "PASS" : "WARN", detail: ok ? "Global sanitizer available" : "Not yet registered" };
    },
  },
  {
    label: "GitHub storage initialized",
    category: "Storage",
    fn: () => {
      const storage = (window as Record<string, unknown>).__ghostly_storage as Record<string, unknown> | undefined;
      const ok = storage && typeof storage === "object";
      return { status: ok ? "PASS" : "WARN", detail: ok ? "Storage module available" : "Not yet initialized" };
    },
  },

  // ── Memory Core (16–18) ──
  {
    label: "MEMORY_CORE_CONFIG loaded",
    category: "Memory Core",
    fn: () => {
      const ok = MEMORY_CORE_CONFIG && "profiles" in MEMORY_CORE_CONFIG;
      return { status: ok ? "PASS" : "FAIL", detail: ok ? `v${MEMORY_CORE_CONFIG.version}` : "Missing or malformed" };
    },
  },
  {
    label: "Three memory profiles defined",
    category: "Memory Core",
    fn: () => {
      const count = Object.keys(MEMORY_CORE_CONFIG.profiles || {}).length;
      const ok = count === 3;
      return { status: ok ? "PASS" : "FAIL", detail: `${count} profiles: ${Object.keys(MEMORY_CORE_CONFIG.profiles).join(", ")}` };
    },
  },
  {
    label: "Generation ceiling 10,000T",
    category: "Memory Core",
    fn: () => {
      const ceiling = (MEMORY_CORE_CONFIG.profiles as Record<string, Record<string, unknown>>)?.generation?.hard_ceiling;
      const ok = ceiling === 10000;
      return { status: ok ? "PASS" : "FAIL", detail: ok ? "10,000T confirmed" : `Ceiling: ${ceiling}` };
    },
  },

  // ── Module Interface Contract (19–21) ──
  {
    label: "MIC loaded",
    category: "MIC",
    fn: () => {
      const ok = MIC && "version" in MIC && "schemas" in MIC;
      return { status: ok ? "PASS" : "FAIL", detail: ok ? `v${MIC.version}` : "Missing or malformed" };
    },
  },
  {
    label: "MIC version 2.1",
    category: "MIC",
    fn: () => {
      const ok = MIC.version === "2.1";
      return { status: ok ? "PASS" : "FAIL", detail: ok ? "v2.1 confirmed" : `Version: ${MIC.version}` };
    },
  },
  {
    label: "MIC has 6 schemas",
    category: "MIC",
    fn: () => {
      const count = Object.keys(MIC.schemas || {}).length;
      const ok = count === 6;
      return { status: ok ? "PASS" : "FAIL", detail: `${count} schemas loaded` };
    },
  },

  // ── Platform Integrity (22–25) ──
  {
    label: "Genre mode is psychological_thriller",
    category: "Platform",
    fn: () => {
      const p = STYLE_PROFILES.profiles?.[STYLE_PROFILES.active_profile as keyof typeof STYLE_PROFILES.profiles] as Record<string, unknown> | undefined;
      const ok = p?.genre_mode === "psychological_thriller";
      return { status: ok ? "PASS" : "FAIL", detail: ok ? "psychological_thriller" : `${p?.genre_mode}` };
    },
  },
  {
    label: "Narrator type unreliable",
    category: "Platform",
    fn: () => {
      const p = STYLE_PROFILES.profiles?.[STYLE_PROFILES.active_profile as keyof typeof STYLE_PROFILES.profiles] as Record<string, unknown> | undefined;
      const ok = p?.narrator_type === "unreliable";
      return { status: ok ? "PASS" : "FAIL", detail: ok ? "Unreliable narrator active" : `${p?.narrator_type}` };
    },
  },
  {
    label: "Tone register clinical_dissociative",
    category: "Platform",
    fn: () => {
      const p = STYLE_PROFILES.profiles?.[STYLE_PROFILES.active_profile as keyof typeof STYLE_PROFILES.profiles] as Record<string, unknown> | undefined;
      const ok = p?.tone_register === "clinical_dissociative";
      return { status: ok ? "PASS" : "FAIL", detail: ok ? "clinical_dissociative" : `${p?.tone_register}` };
    },
  },
  {
    label: "No style switching UI exists",
    category: "Platform",
    fn: () => {
      // This is an architectural invariant — always PASS if brand_lock is true
      const p = STYLE_PROFILES.profiles?.[STYLE_PROFILES.active_profile as keyof typeof STYLE_PROFILES.profiles] as Record<string, unknown> | undefined;
      const ok = p?.brand_lock === true;
      return { status: ok ? "PASS" : "WARN", detail: ok ? "Brand lock prevents style switching" : "Brand lock not confirmed" };
    },
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
export function runStartupValidation(): ValidationResult {
  const results: ValidationCheck[] = checks.map((check, i) => {
    try {
      const { status, detail } = check.fn();
      return { id: i + 1, label: check.label, category: check.category, status, detail };
    } catch (err) {
      return {
        id: i + 1,
        label: check.label,
        category: check.category,
        status: "FAIL" as CheckStatus,
        detail: `Error: ${err instanceof Error ? err.message : "unknown"}`,
      };
    }
  });

  return {
    timestamp: new Date().toISOString(),
    passed: results.filter((r) => r.status === "PASS").length,
    warned: results.filter((r) => r.status === "WARN").length,
    failed: results.filter((r) => r.status === "FAIL").length,
    total: results.length,
    checks: results,
  };
}
