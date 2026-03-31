import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock LLM router
vi.mock("@/api/llmRouter", () => ({
  callWithFallback: vi.fn(),
}));

// Mock memoryCore
vi.mock("@/modules/memoryCore/memoryCore", () => ({
  proposeUpdate: vi.fn(() => ({ ok: true })),
}));

import {
  createAmendment,
  loadAmendments,
  runImpactAudit,
  resolveChapter,
  allChaptersResolved,
  applyAmendment,
  rejectAmendment,
  hasApprovedChapters,
} from "../outlineAmendmentProtocol";
import { callWithFallback } from "@/api/llmRouter";
import { proposeUpdate } from "@/modules/memoryCore/memoryCore";

const AMENDMENTS_KEY = "ghostly_outline_amendments";

describe("outlineAmendmentProtocol", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ── createAmendment ─────────────────────────────────────────────────

  describe("createAmendment", () => {
    it("creates a DRAFT amendment and persists it", () => {
      const a = createAmendment("CHAPTER", "Move scene to chapter 5", ["chapters.4.scene_purpose"], { "chapters.4.scene_purpose": "old" }, { "chapters.4.scene_purpose": "new" });
      expect(a.status).toBe("DRAFT");
      expect(a.amendment_type).toBe("CHAPTER");
      expect(a.id).toMatch(/^amend_/);
      expect(a.applied_at).toBeNull();
      expect(a.impact_audit).toBeNull();

      const stored = loadAmendments();
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe(a.id);
    });

    it("appends multiple amendments", () => {
      createAmendment("CHARACTER", "d1", ["f1"], {}, {});
      createAmendment("TWIST", "d2", ["f2"], {}, {});
      expect(loadAmendments()).toHaveLength(2);
    });

    it("generates unique IDs", () => {
      const a = createAmendment("STRUCTURAL", "x", [], {}, {});
      const b = createAmendment("STRUCTURAL", "y", [], {}, {});
      expect(a.id).not.toBe(b.id);
    });
  });

  // ── hasApprovedChapters ─────────────────────────────────────────────

  describe("hasApprovedChapters", () => {
    it("returns false when no approved chapters exist", () => {
      expect(hasApprovedChapters("proj1")).toBe(false);
    });

    it("returns true when approved chapters exist", () => {
      localStorage.setItem("ghostly_approved_proj1_ch1", JSON.stringify({ approved_draft: "text" }));
      expect(hasApprovedChapters("proj1")).toBe(true);
    });
  });

  // ── runImpactAudit ──────────────────────────────────────────────────

  describe("runImpactAudit", () => {
    it("returns LOW risk when no approved chapters exist", async () => {
      const a = createAmendment("CHAPTER", "test", ["f"], {}, {});
      const result = await runImpactAudit(a.id, "proj1");
      expect(result.risk_level).toBe("LOW");
      expect(result.at_risk_chapters).toHaveLength(0);

      const updated = loadAmendments().find((x) => x.id === a.id)!;
      expect(updated.status).toBe("IMPACT_AUDIT");
    });

    it("throws for unknown amendment ID", async () => {
      await expect(runImpactAudit("nonexistent", "proj1")).rejects.toThrow("not found");
    });

    it("parses LLM response for impact audit", async () => {
      localStorage.setItem("ghostly_approved_proj1_ch3", JSON.stringify({ approved_draft: "Some chapter content here" }));
      localStorage.setItem("ghostly_outline_data", JSON.stringify({ chapters: [{ chapter_number: 3, scene_purpose: "reveal", act: 1 }] }));

      (callWithFallback as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: JSON.stringify({
          at_risk_chapters: [{ chapter_number: 3, risk_type: "CONTINUITY", description: "references old scene", suggested_action: "FLAG_FOR_REVISION" }],
          risk_level: "MEDIUM",
          summary: "Chapter 3 at risk",
        }),
      });

      const a = createAmendment("CHAPTER", "change scene", ["f"], {}, {});
      const result = await runImpactAudit(a.id, "proj1");
      expect(result.risk_level).toBe("MEDIUM");
      expect(result.at_risk_chapters).toHaveLength(1);
      expect(result.at_risk_chapters[0].chapter_number).toBe(3);
    });

    it("uses fallback risk when LLM fails", async () => {
      localStorage.setItem("ghostly_approved_proj1_ch1", JSON.stringify({ approved_draft: "content" }));
      (callWithFallback as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("LLM down"));

      const a = createAmendment("CHARACTER", "change wound", ["f"], {}, {});
      const result = await runImpactAudit(a.id, "proj1");
      expect(result.risk_level).toBe("HIGH");
      expect(result.summary).toContain("conservative");
      expect(result.at_risk_chapters[0].risk_type).toBe("CHARACTER_ARC");
    });

    it("fallback for STRUCTURAL filters by act", async () => {
      localStorage.setItem("ghostly_approved_proj1_ch2", JSON.stringify({ approved_draft: "c" }));
      localStorage.setItem("ghostly_approved_proj1_ch5", JSON.stringify({ approved_draft: "c" }));
      localStorage.setItem("ghostly_outline_data", JSON.stringify({
        chapters: [
          { chapter_number: 2, act: 1 },
          { chapter_number: 5, act: 2 },
        ],
      }));
      (callWithFallback as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("fail"));

      const a = createAmendment("STRUCTURAL", "restructure act 1", ["f"], {}, { act: 1 });
      const result = await runImpactAudit(a.id, "proj1");
      expect(result.at_risk_chapters).toHaveLength(1);
      expect(result.at_risk_chapters[0].chapter_number).toBe(2);
    });

    it("fallback for TWIST flags all as MISDIRECTION", async () => {
      localStorage.setItem("ghostly_approved_proj1_ch1", JSON.stringify({ approved_draft: "c" }));
      (callWithFallback as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("fail"));

      const a = createAmendment("TWIST", "change revelation", ["f"], {}, {});
      const result = await runImpactAudit(a.id, "proj1");
      expect(result.at_risk_chapters[0].risk_type).toBe("MISDIRECTION");
    });
  });

  // ── resolveChapter & allChaptersResolved ────────────────────────────

  describe("resolveChapter", () => {
    it("records resolution for a chapter", () => {
      const a = createAmendment("CHAPTER", "test", ["f"], {}, {});
      resolveChapter(a.id, 3, "ACCEPT_RISK");
      const updated = loadAmendments().find((x) => x.id === a.id)!;
      expect(updated.chapter_resolutions[3]).toBe("ACCEPT_RISK");
    });

    it("FLAG_FOR_REVISION updates chapter editorial sign-off", () => {
      localStorage.setItem("ghostly_approved_default_ch5", JSON.stringify({ human_editorial_sign_off: { status: "PENDING" } }));
      const a = createAmendment("CHAPTER", "test", ["f"], {}, {});
      resolveChapter(a.id, 5, "FLAG_FOR_REVISION");

      const record = JSON.parse(localStorage.getItem("ghostly_approved_default_ch5")!);
      expect(record.human_editorial_sign_off.status).toBe("FLAGGED_FOR_REVISION");
    });

    it("throws for unknown amendment", () => {
      expect(() => resolveChapter("bad_id", 1, "ACCEPT_RISK")).toThrow("not found");
    });
  });

  describe("allChaptersResolved", () => {
    it("returns true when no at-risk chapters", () => {
      const a = createAmendment("CHAPTER", "t", [], {}, {});
      // Manually set impact audit with empty risk
      const amendments = loadAmendments();
      amendments[0].impact_audit = { at_risk_chapters: [], risk_level: "LOW", summary: "ok" };
      localStorage.setItem(AMENDMENTS_KEY, JSON.stringify(amendments));

      expect(allChaptersResolved(amendments[0])).toBe(true);
    });

    it("returns false when at-risk chapters unresolved", () => {
      const a = createAmendment("CHAPTER", "t", [], {}, {});
      const amendments = loadAmendments();
      amendments[0].impact_audit = {
        at_risk_chapters: [{ chapter_number: 3, risk_type: "CONTINUITY", description: "", suggested_action: "ACCEPT_RISK" }],
        risk_level: "MEDIUM",
        summary: "",
      };
      expect(allChaptersResolved(amendments[0])).toBe(false);
    });

    it("returns false without impact audit", () => {
      const a = createAmendment("CHAPTER", "t", [], {}, {});
      expect(allChaptersResolved(a)).toBe(false);
    });
  });

  // ── applyAmendment ──────────────────────────────────────────────────

  describe("applyAmendment", () => {
    it("applies outline changes and updates memory", () => {
      localStorage.setItem("ghostly_outline_data", JSON.stringify({ chapters: { 0: { scene_purpose: "old" } } }));

      const a = createAmendment("CHAPTER", "update", ["chapters.0.scene_purpose"], { "chapters.0.scene_purpose": "old" }, { "chapters.0.scene_purpose": "new" });

      // Set audit with no at-risk chapters so it's resolved
      const amendments = loadAmendments();
      amendments[0].impact_audit = { at_risk_chapters: [], risk_level: "LOW", summary: "ok" };
      localStorage.setItem(AMENDMENTS_KEY, JSON.stringify(amendments));

      applyAmendment(a.id, "proj1");

      const outline = JSON.parse(localStorage.getItem("ghostly_outline_data")!);
      expect(outline.chapters["0"].scene_purpose).toBe("new");

      const updated = loadAmendments().find((x) => x.id === a.id)!;
      expect(updated.status).toBe("APPLIED");
      expect(updated.applied_at).not.toBeNull();
      expect(proposeUpdate).toHaveBeenCalledWith("proj1", expect.objectContaining({ type: "outline_amendment" }));
    });

    it("throws when chapters not resolved", () => {
      const a = createAmendment("CHAPTER", "t", [], {}, {});
      // No impact audit = not resolved
      expect(() => applyAmendment(a.id, "proj1")).toThrow("not all at-risk chapters resolved");
    });

    it("sets twist reseed flag for TWIST amendments", () => {
      const a = createAmendment("TWIST", "change twist", ["t"], {}, { t: "v" });
      const amendments = loadAmendments();
      amendments[0].impact_audit = { at_risk_chapters: [], risk_level: "LOW", summary: "ok" };
      localStorage.setItem(AMENDMENTS_KEY, JSON.stringify(amendments));
      localStorage.setItem("ghostly_outline_data", JSON.stringify({}));

      applyAmendment(a.id, "proj1");
      expect(localStorage.getItem("ghostly_twist_reseed_required")).toBe("true");
    });
  });

  // ── rejectAmendment ─────────────────────────────────────────────────

  describe("rejectAmendment", () => {
    it("sets status to REJECTED", () => {
      const a = createAmendment("CHAPTER", "t", [], {}, {});
      rejectAmendment(a.id);
      const updated = loadAmendments().find((x) => x.id === a.id)!;
      expect(updated.status).toBe("REJECTED");
    });

    it("throws for unknown amendment", () => {
      expect(() => rejectAmendment("bad")).toThrow("not found");
    });
  });
});
