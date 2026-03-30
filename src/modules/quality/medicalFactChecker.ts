/**
 * Medical Fact-Checker — Clinical accuracy reviewer for chapter prose.
 * GHOSTLY v2.2 · Session 22
 *
 * ADVISORY ONLY — never blocks approval automatically.
 * Checks: factual accuracy, professional plausibility, institutional register.
 * Uses Gemini Flash via callWithFallback('quality_medical_fact_check', ...) — NO Prose DNA.
 */

import { callWithFallback } from "@/api/llmRouter";

// ── Types ───────────────────────────────────────────────────────────────

export type ClaimType =
  | "PHARMACOLOGICAL"
  | "PROCEDURAL"
  | "DIAGNOSTIC"
  | "INSTITUTIONAL"
  | "FORENSIC"
  | "PSYCHIATRIC"
  | "ANATOMICAL";

export type CompositeVerdict = "ACCURATE" | "PLAUSIBLE_BUT_IMPRECISE" | "WRONG";

export type ClaimSeverity = "WRONG_FACT" | "ROLE_ERROR" | "REGISTER_ADVISORY" | "NONE";

export type WriterDecision =
  | "PENDING"
  | "ACCEPT_AS_WRITTEN"
  | "CORRECT_BEFORE_APPROVAL"
  | "INTENTIONAL_DEVICE";

export interface MedicalClaim {
  claim_id: string;
  text_excerpt: string;
  claim_type: ClaimType;
  composite_verdict: CompositeVerdict;
  severity: ClaimSeverity;
  correction: string | null;
  elevation_note: string | null;
  writer_decision: WriterDecision;
  writer_reasoning?: string;
}

export interface MedicalFactCheckResult {
  module: "medical_fact_checker";
  chapter_number?: number;
  medical_fact_check_active: boolean;
  no_medical_claims_detected: boolean;
  pass: boolean;
  advisory_required: boolean;
  claims_evaluated: number;
  claims_accurate: number;
  claims_plausible_but_imprecise: number;
  claims_wrong: number;
  institutional_register_flags: number;
  claims: MedicalClaim[];
  register_advisory_summary: string | null;
  parse_error?: boolean;
}

export interface MedicalFactCheckProjectConfig {
  medical_fact_check_active: boolean;
}

// ── System Prompt ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a medical and clinical accuracy reviewer for a psychological thriller manuscript.
Identify every medical, psychiatric, pharmacological, procedural, forensic, anatomical,
or institutional claim in the chapter. Evaluate each on three axes:

AXIS 1 — FACTUAL ACCURACY: Is this claim medically accurate as written?
AXIS 2 — PROFESSIONAL PLAUSIBILITY: Would a qualified professional in this specific role
and setting actually do, say, or know this?
AXIS 3 — INSTITUTIONAL REGISTER: Does this reveal genuine institutional knowledge, or
could it have been written by anyone with access to a general reference?

For each claim return a composite_verdict: ACCURATE, PLAUSIBLE_BUT_IMPRECISE, or WRONG.
For WRONG claims: provide a specific correction.
For AXIS 3 failures on otherwise accurate claims: provide a specific elevation note —
what institutional detail would make this read as expert rather than generic.

If the chapter contains no medical or clinical content, return no_medical_claims_detected: true.

Respond ONLY with valid JSON matching this schema exactly. No preamble.

{
  "module": "medical_fact_checker",
  "chapter_number": number,
  "no_medical_claims_detected": boolean,
  "claims_evaluated": number,
  "claims_accurate": number,
  "claims_plausible_but_imprecise": number,
  "claims_wrong": number,
  "institutional_register_flags": number,
  "pass": boolean,
  "advisory_required": boolean,
  "claims": [
    {
      "claim_id": "string e.g. MFC-001",
      "text_excerpt": "string — the passage containing the claim, max 80 words",
      "claim_type": "PHARMACOLOGICAL | PROCEDURAL | DIAGNOSTIC | INSTITUTIONAL | FORENSIC | PSYCHIATRIC | ANATOMICAL",
      "composite_verdict": "ACCURATE | PLAUSIBLE_BUT_IMPRECISE | WRONG",
      "severity": "WRONG_FACT | ROLE_ERROR | REGISTER_ADVISORY | NONE",
      "correction": "string or null — specific correction for WRONG_FACT and ROLE_ERROR only",
      "elevation_note": "string or null — for REGISTER_ADVISORY only: what specific detail would elevate this",
      "writer_decision": "PENDING"
    }
  ],
  "register_advisory_summary": "string or null — brief summary when institutional_register_flags > 0"
}

pass is true when claims_wrong === 0.
advisory_required is true when claims_wrong > 0 OR institutional_register_flags > 2.
writer_decision always initialises as PENDING — the writer updates this in the UI.`;

// ── Main Function ───────────────────────────────────────────────────────

export async function runMedicalFactCheck(
  chapterText: string,
  projectConfig: MedicalFactCheckProjectConfig,
  chapterNumber?: number,
): Promise<MedicalFactCheckResult> {
  // Skip if disabled
  if (!projectConfig.medical_fact_check_active) {
    return {
      module: "medical_fact_checker",
      medical_fact_check_active: false,
      no_medical_claims_detected: false,
      pass: true,
      advisory_required: false,
      claims_evaluated: 0,
      claims_accurate: 0,
      claims_plausible_but_imprecise: 0,
      claims_wrong: 0,
      institutional_register_flags: 0,
      claims: [],
      register_advisory_summary: null,
    };
  }

  const userPrompt = `Review this chapter for medical and clinical accuracy:

${chapterText}

Chapter number: ${chapterNumber ?? "unknown"}`;

  try {
    const response = await callWithFallback("quality_medical_fact_check", userPrompt, {
      temperature: 0.1,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
    });

    const text = response.content.trim();
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error("No JSON object found in response");
      }
    }

    // Handle no clinical content
    if (parsed.no_medical_claims_detected === true) {
      return {
        module: "medical_fact_checker",
        medical_fact_check_active: true,
        no_medical_claims_detected: true,
        pass: true,
        advisory_required: false,
        claims_evaluated: 0,
        claims_accurate: 0,
        claims_plausible_but_imprecise: 0,
        claims_wrong: 0,
        institutional_register_flags: 0,
        claims: [],
        register_advisory_summary: null,
        chapter_number: chapterNumber,
      };
    }

    // Parse claims
    const claims: MedicalClaim[] = Array.isArray(parsed.claims)
      ? (parsed.claims as MedicalClaim[]).map((c) => ({
          claim_id: c.claim_id ?? "MFC-???",
          text_excerpt: c.text_excerpt ?? "",
          claim_type: c.claim_type ?? "DIAGNOSTIC",
          composite_verdict: c.composite_verdict ?? "ACCURATE",
          severity: c.severity ?? "NONE",
          correction: c.correction ?? null,
          elevation_note: c.elevation_note ?? null,
          writer_decision: "PENDING" as WriterDecision,
        }))
      : [];

    const claimsWrong = Number(parsed.claims_wrong) || claims.filter(c => c.severity === "WRONG_FACT" || c.severity === "ROLE_ERROR").length;
    const claimsAccurate = Number(parsed.claims_accurate) || claims.filter(c => c.composite_verdict === "ACCURATE").length;
    const claimsImprecise = Number(parsed.claims_plausible_but_imprecise) || claims.filter(c => c.composite_verdict === "PLAUSIBLE_BUT_IMPRECISE").length;
    const registerFlags = Number(parsed.institutional_register_flags) || claims.filter(c => c.severity === "REGISTER_ADVISORY").length;

    return {
      module: "medical_fact_checker",
      medical_fact_check_active: true,
      no_medical_claims_detected: false,
      chapter_number: chapterNumber,
      pass: claimsWrong === 0,
      advisory_required: claimsWrong > 0 || registerFlags > 2,
      claims_evaluated: Number(parsed.claims_evaluated) || claims.length,
      claims_accurate: claimsAccurate,
      claims_plausible_but_imprecise: claimsImprecise,
      claims_wrong: claimsWrong,
      institutional_register_flags: registerFlags,
      claims,
      register_advisory_summary: (parsed.register_advisory_summary as string) ?? null,
    };
  } catch (err) {
    console.warn("[MedicalFactChecker] Analysis failed:", err);
    return {
      module: "medical_fact_checker",
      medical_fact_check_active: true,
      no_medical_claims_detected: false,
      pass: true,
      advisory_required: false,
      parse_error: true,
      claims_evaluated: 0,
      claims_accurate: 0,
      claims_plausible_but_imprecise: 0,
      claims_wrong: 0,
      institutional_register_flags: 0,
      claims: [],
      register_advisory_summary: null,
    };
  }
}

// ── Console exposure ────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_medicalFactChecker = {
    runMedicalFactCheck,
  };
}
