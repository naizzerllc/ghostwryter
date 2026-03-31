import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateDiff,
  assessRevisionScope,
  executeRevision,
  acceptRevision,
  rejectRevision,
  type RevisionInput,
  type RevisionResult,
} from "../sceneRevisionTool";

vi.mock("@/api/llmRouter", () => ({
  callWithFallback: vi.fn(),
}));

vi.mock("@/modules/memoryCore/memoryCore", () => ({
  proposeUpdate: vi.fn(),
}));

function makeInput(overrides: Partial<RevisionInput> = {}): RevisionInput {
  return {
    chapter_number: 1,
    project_id: "proj_test",
    instruction: "Fix a typo in paragraph two",
    scene_purpose_changed: false,
    structural_change: false,
    ...overrides,
  };
}

describe("sceneRevisionTool", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("generateDiff", () => {
    it("returns unchanged lines for identical content", () => {
      const diff = generateDiff("line one\nline two", "line one\nline two");
      expect(diff.every((d) => d.type === "unchanged")).toBe(true);
      expect(diff).toHaveLength(2);
    });

    it("marks changed lines as removed + added", () => {
      const diff = generateDiff("hello world", "hello earth");
      expect(diff.find((d) => d.type === "removed")?.content).toBe("hello world");
      expect(diff.find((d) => d.type === "added")?.content).toBe("hello earth");
    });

    it("handles added lines at the end", () => {
      const diff = generateDiff("line one", "line one\nline two");
      expect(diff).toHaveLength(3); // unchanged + added
      expect(diff.filter((d) => d.type === "added")).toHaveLength(1);
    });

    it("handles removed lines at the end", () => {
      const diff = generateDiff("line one\nline two", "line one");
      expect(diff.filter((d) => d.type === "removed")).toHaveLength(1);
    });

    it("handles empty strings", () => {
      const diff = generateDiff("", "");
      expect(diff).toHaveLength(1);
      expect(diff[0].type).toBe("unchanged");
    });
  });

  describe("assessRevisionScope", () => {
    it("returns PATCH for simple instruction with no approved content", () => {
      const result = assessRevisionScope(makeInput());
      expect(result.scope).toBe("PATCH");
    });

    it("returns FULL_REGENERATION when scene_purpose_changed", () => {
      const result = assessRevisionScope(makeInput({ scene_purpose_changed: true }));
      expect(result.scope).toBe("FULL_REGENERATION");
    });

    it("reads forbidden word count from stored chapter", () => {
      localStorage.setItem(
        "ghostly_approved_proj_test_ch1",
        JSON.stringify({
          approved_draft: "Content here",
          forbidden_word_violations: ["a", "b", "c", "d", "e"],
        })
      );
      const result = assessRevisionScope(makeInput());
      expect(result.scope).toBe("SECTION_REWRITE");
    });
  });

  describe("executeRevision", () => {
    it("throws when no approved content exists", async () => {
      await expect(executeRevision(makeInput())).rejects.toThrow("No approved content");
    });

    it("returns a PENDING_REVIEW result on success", async () => {
      const { callWithFallback } = await import("@/api/llmRouter");
      (callWithFallback as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: "Revised chapter content here.",
      });

      localStorage.setItem(
        "ghostly_approved_proj_test_ch1",
        JSON.stringify({ approved_draft: "Original chapter content." })
      );

      const result = await executeRevision(makeInput());
      expect(result.status).toBe("PENDING_REVIEW");
      expect(result.chapter_number).toBe(1);
      expect(result.original_content).toBe("Original chapter content.");
      expect(result.revised_content).toBe("Revised chapter content here.");
      expect(result.diff.length).toBeGreaterThan(0);
      expect(result.scope.scope).toBe("PATCH");
    });

    it("throws on LLM failure", async () => {
      const { callWithFallback } = await import("@/api/llmRouter");
      (callWithFallback as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("timeout"));

      localStorage.setItem(
        "ghostly_approved_proj_test_ch1",
        JSON.stringify({ approved_draft: "Content." })
      );

      await expect(executeRevision(makeInput())).rejects.toThrow("Revision failed");
    });
  });

  describe("acceptRevision", () => {
    it("updates localStorage with revised content", () => {
      const key = "ghostly_approved_proj_test_ch1";
      localStorage.setItem(key, JSON.stringify({ approved_draft: "Old content" }));

      const result: RevisionResult = {
        chapter_number: 1,
        scope: { scope: "PATCH", reason: "Minor", estimated_tokens: 800, memory_update_required: false },
        original_content: "Old content",
        revised_content: "New content",
        diff: [],
        status: "PENDING_REVIEW",
        revised_at: new Date().toISOString(),
      };

      acceptRevision(result, "proj_test");
      expect(result.status).toBe("ACCEPTED");

      const stored = JSON.parse(localStorage.getItem(key)!);
      expect(stored.approved_draft).toBe("New content");
      expect(stored.human_editorial_override).toBe(true);
      expect(stored.human_editorial_sign_off.status).toBe("PENDING");
    });

    it("calls proposeUpdate when memory_update_required is true", async () => {
      const { proposeUpdate } = await import("@/modules/memoryCore/memoryCore");
      const key = "ghostly_approved_proj_test_ch2";
      localStorage.setItem(key, JSON.stringify({ approved_draft: "Old" }));

      const result: RevisionResult = {
        chapter_number: 2,
        scope: { scope: "FULL_REGENERATION", reason: "Big change", estimated_tokens: 8000, memory_update_required: true },
        original_content: "Old",
        revised_content: "New",
        diff: [],
        status: "PENDING_REVIEW",
        revised_at: new Date().toISOString(),
      };

      acceptRevision(result, "proj_test");
      expect(proposeUpdate).toHaveBeenCalledWith("proj_test", expect.objectContaining({
        type: "scene_revision",
        chapter_number: 2,
      }));
    });
  });

  describe("rejectRevision", () => {
    it("sets status to REJECTED", () => {
      const result: RevisionResult = {
        chapter_number: 1,
        scope: { scope: "PATCH", reason: "Minor", estimated_tokens: 800, memory_update_required: false },
        original_content: "Content",
        revised_content: "New content",
        diff: [],
        status: "PENDING_REVIEW",
        revised_at: new Date().toISOString(),
      };

      rejectRevision(result);
      expect(result.status).toBe("REJECTED");
    });
  });
});
