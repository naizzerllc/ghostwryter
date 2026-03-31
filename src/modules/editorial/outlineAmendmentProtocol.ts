/**
 * Outline Amendment Protocol — DOC_E
 * GHOSTLY v2.2 · Session 26
 *
 * Mid-manuscript outline editing without full re-import.
 * Amendment types: CHAPTER | CHARACTER | STRUCTURAL | TWIST
 * Flow: intake → impact audit (Gemini Flash) → human confirmation → apply → memory update.
 */

import { callWithFallback } from "@/api/llmRouter";
import { proposeUpdate } from "@/modules/memoryCore/memoryCore";

// ── Types ───────────────────────────────────────────────────────────────

export type AmendmentType = "CHAPTER" | "CHARACTER" | "STRUCTURAL" | "TWIST";
export type AmendmentStatus = "DRAFT" | "IMPACT_AUDIT" | "CONFIRMED" | "APPLIED" | "REJECTED";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type RiskType = "CONTINUITY" | "CHARACTER_ARC" | "MISDIRECTION" | "STRUCTURAL";
export type SuggestedAction = "ACCEPT_RISK" | "FLAG_FOR_REVISION" | "RETROACTIVE_CONTINUITY";

export interface OutlineAmendment {
  id: string;
  amendment_type: AmendmentType;
  description: string;
  fields_changed: string[];
  original_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  status: AmendmentStatus;
  created_at: string;
  applied_at: string | null;
  impact_audit: ImpactAuditResult | null;
  chapter_resolutions: Record<number, SuggestedAction>;
}

export interface ImpactedChapter {
  chapter_number: number;
  risk_type: RiskType;
  description: string;
  suggested_action: SuggestedAction;
}

export interface ImpactAuditResult {
  at_risk_chapters: ImpactedChapter[];
  risk_level: RiskLevel;
  summary: string;
}

interface ApprovedChapter {
  chapter_number: number;
  content: string;
}

interface OutlineRecord {
  chapter_number: number;
  scene_purpose?: string;
  act?: number;
  [key: string]: unknown;
}

// ── Storage ─────────────────────────────────────────────────────────────

const AMENDMENTS_KEY = "ghostly_outline_amendments";

export function loadAmendments(): OutlineAmendment[] {
  try {
    const raw = localStorage.getItem(AMENDMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAmendments(amendments: OutlineAmendment[]): void {
  localStorage.setItem(AMENDMENTS_KEY, JSON.stringify(amendments));
}

function generateId(): string {
  return `amend_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function loadApprovedChapters(projectId: string): ApprovedChapter[] {
  const chapters: ApprovedChapter[] = [];
  try {
    for (let i = 1; i <= 60; i++) {
      const key = `ghostly_approved_${projectId}_ch${i}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const record = JSON.parse(raw);
        chapters.push({ chapter_number: i, content: record.approved_draft || record.content || "" });
      }
    }
  } catch {
    console.warn("[AmendmentProtocol] Error loading approved chapters");
  }
  return chapters;
}

function loadOutlineChapters(): OutlineRecord[] {
  try {
    const raw = localStorage.getItem("ghostly_outline_data");
    if (!raw) return [];
    const data = JSON.parse(raw);
    return data.chapters || [];
  } catch {
    return [];
  }
}

export function hasApprovedChapters(projectId: string): boolean {
  return loadApprovedChapters(projectId).length > 0;
}

// ── Amendment Intake ────────────────────────────────────────────────────

export function createAmendment(
  type: AmendmentType,
  description: string,
  fieldsChanged: string[],
  originalValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
): OutlineAmendment {
  const amendment: OutlineAmendment = {
    id: generateId(),
    amendment_type: type,
    description,
    fields_changed: fieldsChanged,
    original_values: originalValues,
    new_values: newValues,
    status: "DRAFT",
    created_at: new Date().toISOString(),
    applied_at: null,
    impact_audit: null,
    chapter_resolutions: {},
  };

  const amendments = loadAmendments();
  amendments.push(amendment);
  saveAmendments(amendments);
  return amendment;
}

// ── Impact Audit ────────────────────────────────────────────────────────

export async function runImpactAudit(
  amendmentId: string,
  projectId: string,
): Promise<ImpactAuditResult> {
  const amendments = loadAmendments();
  const amendment = amendments.find((a) => a.id === amendmentId);
  if (!amendment) throw new Error(`Amendment ${amendmentId} not found`);

  const approvedChapters = loadApprovedChapters(projectId);
  const outlineChapters = loadOutlineChapters();

  if (approvedChapters.length === 0) {
    const result: ImpactAuditResult = {
      at_risk_chapters: [],
      risk_level: "LOW",
      summary: "No approved chapters — amendment can be applied safely.",
    };
    amendment.impact_audit = result;
    amendment.status = "IMPACT_AUDIT";
    saveAmendments(amendments);
    return result;
  }

  const chapterSummaries = approvedChapters.map((ch) => ({
    chapter: ch.chapter_number,
    excerpt: ch.content.slice(0, 1000),
  }));

  const outlineSummary = outlineChapters.slice(0, 40).map((ch) => ({
    chapter: ch.chapter_number,
    scene_purpose: ch.scene_purpose,
    act: ch.act,
  }));

  const prompt = `You are a continuity editor for a psychological thriller novel.

AMENDMENT TYPE: ${amendment.amendment_type}
AMENDMENT DESCRIPTION: ${amendment.description}
FIELDS CHANGED: ${JSON.stringify(amendment.fields_changed)}
NEW VALUES: ${JSON.stringify(amendment.new_values)}

OUTLINE (first 40 chapters):
${JSON.stringify(outlineSummary, null, 2)}

APPROVED CHAPTERS:
${chapterSummaries.map((ch) => `--- Chapter ${ch.chapter} ---\n${ch.excerpt}`).join("\n\n")}

Identify which approved chapters are at risk from this amendment.
For CHAPTER amendments: chapters that reference the changed scene.
For CHARACTER amendments: chapters featuring the affected character.
For STRUCTURAL amendments: all chapters in the affected act.
For TWIST amendments: all pre-revelation chapters.

Return JSON:
{
  "at_risk_chapters": [
    {
      "chapter_number": <number>,
      "risk_type": "CONTINUITY" | "CHARACTER_ARC" | "MISDIRECTION" | "STRUCTURAL",
      "description": "<why this chapter is at risk>",
      "suggested_action": "ACCEPT_RISK" | "FLAG_FOR_REVISION" | "RETROACTIVE_CONTINUITY"
    }
  ],
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "summary": "<one-sentence summary>"
}

Return ONLY valid JSON.`;

  try {
    const response = await callWithFallback("quality_analysis", prompt);
    const parsed = JSON.parse(response.content);

    const result: ImpactAuditResult = {
      at_risk_chapters: (parsed.at_risk_chapters || []).map(
        (ch: { chapter_number: number; risk_type: RiskType; description: string; suggested_action: SuggestedAction }) => ({
          chapter_number: ch.chapter_number,
          risk_type: ch.risk_type || "CONTINUITY",
          description: ch.description || "",
          suggested_action: ch.suggested_action || "ACCEPT_RISK",
        })
      ),
      risk_level: parsed.risk_level || "MEDIUM",
      summary: parsed.summary || "Impact audit complete.",
    };

    amendment.impact_audit = result;
    amendment.status = "IMPACT_AUDIT";
    saveAmendments(amendments);
    return result;
  } catch (error) {
    console.error("[AmendmentProtocol] Impact audit failed:", error);

    // Fallback: flag all approved chapters based on amendment type
    const fallbackChapters = deriveFallbackRisk(amendment, approvedChapters, outlineChapters);
    const result: ImpactAuditResult = {
      at_risk_chapters: fallbackChapters,
      risk_level: "HIGH",
      summary: "LLM audit unavailable — conservative risk assessment applied.",
    };

    amendment.impact_audit = result;
    amendment.status = "IMPACT_AUDIT";
    saveAmendments(amendments);
    return result;
  }
}

function deriveFallbackRisk(
  amendment: OutlineAmendment,
  approved: ApprovedChapter[],
  outline: OutlineRecord[],
): ImpactedChapter[] {
  const riskType: RiskType =
    amendment.amendment_type === "CHARACTER" ? "CHARACTER_ARC" :
    amendment.amendment_type === "TWIST" ? "MISDIRECTION" :
    amendment.amendment_type === "STRUCTURAL" ? "STRUCTURAL" : "CONTINUITY";

  if (amendment.amendment_type === "STRUCTURAL") {
    // All chapters in affected act
    const affectedAct = amendment.new_values.act as number | undefined;
    return approved
      .filter((ch) => {
        if (!affectedAct) return true;
        const outlineEntry = outline.find((o) => o.chapter_number === ch.chapter_number);
        return outlineEntry?.act === affectedAct;
      })
      .map((ch) => ({
        chapter_number: ch.chapter_number,
        risk_type: riskType,
        description: "Conservative flag — LLM audit unavailable",
        suggested_action: "FLAG_FOR_REVISION" as SuggestedAction,
      }));
  }

  // For other types, flag all approved
  return approved.map((ch) => ({
    chapter_number: ch.chapter_number,
    risk_type: riskType,
    description: "Conservative flag — LLM audit unavailable",
    suggested_action: "FLAG_FOR_REVISION" as SuggestedAction,
  }));
}

// ── Chapter Resolution ──────────────────────────────────────────────────

export function resolveChapter(
  amendmentId: string,
  chapterNumber: number,
  action: SuggestedAction,
): void {
  const amendments = loadAmendments();
  const amendment = amendments.find((a) => a.id === amendmentId);
  if (!amendment) throw new Error(`Amendment ${amendmentId} not found`);

  amendment.chapter_resolutions[chapterNumber] = action;

  // If FLAG_FOR_REVISION, update the chapter's editorial sign-off
  if (action === "FLAG_FOR_REVISION") {
    try {
      const key = `ghostly_approved_default_ch${chapterNumber}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const record = JSON.parse(raw);
        record.human_editorial_sign_off = {
          ...record.human_editorial_sign_off,
          status: "FLAGGED_FOR_REVISION",
        };
        localStorage.setItem(key, JSON.stringify(record));
      }
    } catch {
      console.warn("[AmendmentProtocol] Failed to flag chapter", chapterNumber);
    }
  }

  saveAmendments(amendments);
}

export function allChaptersResolved(amendment: OutlineAmendment): boolean {
  if (!amendment.impact_audit) return false;
  const atRisk = amendment.impact_audit.at_risk_chapters;
  if (atRisk.length === 0) return true;
  return atRisk.every((ch) => amendment.chapter_resolutions[ch.chapter_number] !== undefined);
}

// ── Apply Amendment ─────────────────────────────────────────────────────

export function applyAmendment(amendmentId: string, projectId: string): void {
  const amendments = loadAmendments();
  const amendment = amendments.find((a) => a.id === amendmentId);
  if (!amendment) throw new Error(`Amendment ${amendmentId} not found`);

  if (!allChaptersResolved(amendment)) {
    throw new Error("Cannot apply amendment — not all at-risk chapters resolved");
  }

  // Apply field changes to outline
  try {
    const raw = localStorage.getItem("ghostly_outline_data");
    if (raw) {
      const data = JSON.parse(raw);

      // Surgical update: only change specified fields
      for (const fieldPath of amendment.fields_changed) {
        setNestedValue(data, fieldPath, amendment.new_values[fieldPath]);
      }

      localStorage.setItem("ghostly_outline_data", JSON.stringify(data));
    }
  } catch (error) {
    console.error("[AmendmentProtocol] Failed to apply outline changes:", error);
    throw error;
  }

  // For TWIST amendments: mark twist integrity for re-seeding
  if (amendment.amendment_type === "TWIST") {
    localStorage.setItem("ghostly_twist_reseed_required", "true");
  }

  amendment.status = "APPLIED";
  amendment.applied_at = new Date().toISOString();
  saveAmendments(amendments);

  // Surgical memory update
  proposeUpdate(projectId, {
    type: "outline_amendment",
    amendment_id: amendment.id,
    amendment_type: amendment.amendment_type,
    fields_changed: amendment.fields_changed,
    summary: `Outline amendment (${amendment.amendment_type}): ${amendment.description}`,
  });
}

export function rejectAmendment(amendmentId: string): void {
  const amendments = loadAmendments();
  const amendment = amendments.find((a) => a.id === amendmentId);
  if (!amendment) throw new Error(`Amendment ${amendmentId} not found`);
  amendment.status = "REJECTED";
  saveAmendments(amendments);
}

// ── Helpers ─────────────────────────────────────────────────────────────

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {};
    }
    current = current[keys[i]] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}
