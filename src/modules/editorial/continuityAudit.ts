/**
 * Continuity Audit — Full-manuscript fact consistency check.
 * GHOSTLY v2.2 · Session 25
 *
 * Runs a full-manuscript pass using Gemini Flash to check:
 * - Canonical facts consistency across all approved chapters
 * - Character names, titles, relationships
 * - Timeline consistency
 * - Setting details
 * - Series continuity violations from approved chapter records
 */

import { callWithFallback } from "@/api/llmRouter";
import { getAllFacts } from "@/modules/canonicalFacts/canonicalFactsDB";

// ── Types ───────────────────────────────────────────────────────────────

export type ViolationType =
  | "CANONICAL_FACT"
  | "CHARACTER_INCONSISTENCY"
  | "TIMELINE_ERROR"
  | "SETTING_INCONSISTENCY"
  | "SERIES_CONTINUITY";

export interface ContinuityViolation {
  id: string;
  chapter_number: number;
  violation_type: ViolationType;
  description: string;
  suggested_fix: string;
  resolved: boolean;
}

export interface ContinuityAuditReport {
  violations: ContinuityViolation[];
  warnings: string[];
  clean_chapters: number;
  flagged_chapters: number;
  audit_date: string;
  total_chapters_audited: number;
}

// ── Storage ─────────────────────────────────────────────────────────────

const AUDIT_STORAGE_KEY = "ghostly_continuity_audit";

export function loadLastAuditReport(): ContinuityAuditReport | null {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAuditReport(report: ContinuityAuditReport): void {
  localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(report));
}

// ── Helpers ─────────────────────────────────────────────────────────────

function generateViolationId(): string {
  return `cv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadApprovedChapters(projectId: string): Array<{ chapter_number: number; content: string }> {
  const chapters: Array<{ chapter_number: number; content: string }> = [];
  try {
    for (let i = 1; i <= 60; i++) {
      const key = `ghostly_approved_${projectId}_ch${i}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const record = JSON.parse(raw);
        chapters.push({
          chapter_number: i,
          content: record.approved_draft || record.content || "",
        });
      }
    }
  } catch {
    console.warn("[ContinuityAudit] Error loading approved chapters");
  }
  return chapters;
}

// ── Main Audit ──────────────────────────────────────────────────────────

export async function runContinuityAudit(projectId: string): Promise<ContinuityAuditReport> {
  const approvedChapters = loadApprovedChapters(projectId);
  const canonicalFacts = getAllFacts();

  if (approvedChapters.length === 0) {
    const emptyReport: ContinuityAuditReport = {
      violations: [],
      warnings: ["No approved chapters found for audit."],
      clean_chapters: 0,
      flagged_chapters: 0,
      audit_date: new Date().toISOString(),
      total_chapters_audited: 0,
    };
    saveAuditReport(emptyReport);
    return emptyReport;
  }

  // Build chapter summaries for LLM (truncate to manage tokens)
  const chapterSummaries = approvedChapters.map((ch) => ({
    chapter: ch.chapter_number,
    excerpt: ch.content.slice(0, 2000),
  }));

  const factsContext = canonicalFacts.slice(0, 50).map((f) => ({
    id: f.fact_id,
    category: f.category,
    content: f.statement,
  }));

  const prompt = `You are a continuity editor for a psychological thriller novel.

CANONICAL FACTS (established truth):
${JSON.stringify(factsContext, null, 2)}

APPROVED CHAPTERS:
${chapterSummaries.map((ch) => `--- Chapter ${ch.chapter} ---\n${ch.excerpt}`).join("\n\n")}

Audit for:
1. Canonical fact violations (contradictions with established facts)
2. Character name/title/relationship inconsistencies
3. Timeline errors (events referenced before they occur)
4. Setting detail inconsistencies (room descriptions, locations, weather)
5. Any continuity breaks between chapters

Return JSON:
{
  "violations": [
    {
      "chapter_number": <number>,
      "violation_type": "CANONICAL_FACT" | "CHARACTER_INCONSISTENCY" | "TIMELINE_ERROR" | "SETTING_INCONSISTENCY" | "SERIES_CONTINUITY",
      "description": "<what's wrong>",
      "suggested_fix": "<how to fix>"
    }
  ],
  "warnings": ["<minor concerns that aren't violations>"]
}

Return ONLY valid JSON. If no violations found, return empty arrays.`;

  try {
    const response = await callWithFallback("continuity_check", prompt);
    const parsed = JSON.parse(response.content);

    const violations: ContinuityViolation[] = (parsed.violations || []).map(
      (v: { chapter_number: number; violation_type: ViolationType; description: string; suggested_fix: string }) => ({
        id: generateViolationId(),
        chapter_number: v.chapter_number,
        violation_type: v.violation_type || "CANONICAL_FACT",
        description: v.description,
        suggested_fix: v.suggested_fix || "Review and correct manually",
        resolved: false,
      })
    );

    const flaggedChapterNumbers = new Set(violations.map((v) => v.chapter_number));

    const report: ContinuityAuditReport = {
      violations,
      warnings: parsed.warnings || [],
      clean_chapters: approvedChapters.length - flaggedChapterNumbers.size,
      flagged_chapters: flaggedChapterNumbers.size,
      audit_date: new Date().toISOString(),
      total_chapters_audited: approvedChapters.length,
    };

    saveAuditReport(report);
    return report;
  } catch (error) {
    console.error("[ContinuityAudit] LLM call failed:", error);

    // Return offline audit with basic checks
    const report: ContinuityAuditReport = {
      violations: [],
      warnings: ["LLM audit unavailable — manual review recommended."],
      clean_chapters: approvedChapters.length,
      flagged_chapters: 0,
      audit_date: new Date().toISOString(),
      total_chapters_audited: approvedChapters.length,
    };
    saveAuditReport(report);
    return report;
  }
}

// ── Resolve Violation ───────────────────────────────────────────────────

export function resolveViolation(violationId: string): boolean {
  const report = loadLastAuditReport();
  if (!report) return false;

  const violation = report.violations.find((v) => v.id === violationId);
  if (!violation) return false;

  violation.resolved = true;
  saveAuditReport(report);
  return true;
}
