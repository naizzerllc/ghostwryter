import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadLastAuditReport, resolveViolation, runContinuityAudit } from "../continuityAudit";

// Mock LLM router
vi.mock("@/api/llmRouter", () => ({
  callWithFallback: vi.fn(),
}));

// Mock canonical facts
vi.mock("@/modules/canonicalFacts/canonicalFactsDB", () => ({
  getAllFacts: vi.fn(() => []),
}));

describe("continuityAudit", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("loadLastAuditReport", () => {
    it("returns null when no report exists", () => {
      expect(loadLastAuditReport()).toBeNull();
    });

    it("returns saved report", () => {
      const report = {
        violations: [],
        warnings: [],
        clean_chapters: 5,
        flagged_chapters: 0,
        audit_date: "2025-01-01",
        total_chapters_audited: 5,
      };
      localStorage.setItem("ghostly_continuity_audit", JSON.stringify(report));
      expect(loadLastAuditReport()).toEqual(report);
    });

    it("returns null on corrupt data", () => {
      localStorage.setItem("ghostly_continuity_audit", "not-json{{{");
      expect(loadLastAuditReport()).toBeNull();
    });
  });

  describe("runContinuityAudit", () => {
    it("returns empty report when no approved chapters exist", async () => {
      const report = await runContinuityAudit("test-project");
      expect(report.total_chapters_audited).toBe(0);
      expect(report.warnings).toContain("No approved chapters found for audit.");
      expect(report.violations).toEqual([]);
    });

    it("saves the report to localStorage after audit", async () => {
      await runContinuityAudit("test-project");
      const saved = loadLastAuditReport();
      expect(saved).not.toBeNull();
      expect(saved!.audit_date).toBeDefined();
    });

    it("calls LLM when approved chapters exist", async () => {
      const { callWithFallback } = await import("@/api/llmRouter");
      (callWithFallback as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: JSON.stringify({ violations: [], warnings: ["Minor concern"] }),
      });

      // Store a fake approved chapter
      localStorage.setItem(
        "ghostly_approved_proj1_ch1",
        JSON.stringify({ approved_draft: "Chapter 1 content here." })
      );

      const report = await runContinuityAudit("proj1");
      expect(report.total_chapters_audited).toBe(1);
      expect(report.warnings).toContain("Minor concern");
      expect(callWithFallback).toHaveBeenCalledWith("continuity_check", expect.any(String));
    });

    it("handles LLM failure gracefully", async () => {
      const { callWithFallback } = await import("@/api/llmRouter");
      (callWithFallback as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("LLM down"));

      localStorage.setItem(
        "ghostly_approved_proj2_ch1",
        JSON.stringify({ content: "Some text" })
      );

      const report = await runContinuityAudit("proj2");
      expect(report.warnings).toContain("LLM audit unavailable — manual review recommended.");
      expect(report.violations).toEqual([]);
    });

    it("parses LLM violations correctly", async () => {
      const { callWithFallback } = await import("@/api/llmRouter");
      (callWithFallback as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: JSON.stringify({
          violations: [
            {
              chapter_number: 3,
              violation_type: "TIMELINE_ERROR",
              description: "Event referenced before occurring",
              suggested_fix: "Move event to chapter 2",
            },
          ],
          warnings: [],
        }),
      });

      localStorage.setItem(
        "ghostly_approved_proj3_ch3",
        JSON.stringify({ approved_draft: "Chapter 3 text" })
      );

      const report = await runContinuityAudit("proj3");
      expect(report.violations).toHaveLength(1);
      expect(report.violations[0].violation_type).toBe("TIMELINE_ERROR");
      expect(report.violations[0].resolved).toBe(false);
      expect(report.violations[0].id).toMatch(/^cv_/);
      expect(report.flagged_chapters).toBe(1);
      expect(report.clean_chapters).toBe(0);
    });
  });

  describe("resolveViolation", () => {
    it("returns false when no report exists", () => {
      expect(resolveViolation("nonexistent")).toBe(false);
    });

    it("returns false when violation ID not found", () => {
      localStorage.setItem(
        "ghostly_continuity_audit",
        JSON.stringify({
          violations: [{ id: "cv_1", resolved: false }],
          warnings: [],
          clean_chapters: 0,
          flagged_chapters: 1,
          audit_date: "2025-01-01",
          total_chapters_audited: 1,
        })
      );
      expect(resolveViolation("cv_999")).toBe(false);
    });

    it("marks violation as resolved and persists", () => {
      localStorage.setItem(
        "ghostly_continuity_audit",
        JSON.stringify({
          violations: [
            { id: "cv_abc", chapter_number: 1, violation_type: "CANONICAL_FACT", description: "test", suggested_fix: "fix", resolved: false },
          ],
          warnings: [],
          clean_chapters: 0,
          flagged_chapters: 1,
          audit_date: "2025-01-01",
          total_chapters_audited: 1,
        })
      );

      expect(resolveViolation("cv_abc")).toBe(true);
      const updated = loadLastAuditReport();
      expect(updated!.violations[0].resolved).toBe(true);
    });
  });
});
