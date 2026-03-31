import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAnnotation,
  loadAnnotations,
  getAnnotationForChapter,
  getAnnotationsForBriefInjection,
  markAnnotationsInjected,
  loadReplacements,
  resolveReplacement,
  getActiveReplacement,
  getReplacementLoopCount,
  shouldRunCalibrationPattern,
  buildAnnotationBriefInjection,
  generateDerivedInstruction,
  initiateChapterReplacement,
  runCalibrationPatternDetector,
} from "../editorialAnnotation";

// Mock LLM router
vi.mock("@/api/llmRouter", () => ({
  callWithFallback: vi.fn().mockResolvedValue({
    content: "Derived instruction text for testing.",
  }),
}));

// Mock GitHub storage
vi.mock("@/storage/githubStorage", () => ({
  githubStorage: {
    saveFile: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("editorialAnnotation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── Annotation CRUD ───────────────────────────────────────────────

  describe("createAnnotation", () => {
    it("creates annotation with text", () => {
      const a = createAnnotation(3, "Dialogue lands flat", "DIALOGUE", "NOTABLE");
      expect(a.annotation_present).toBe(true);
      expect(a.annotation_text).toBe("Dialogue lands flat");
      expect(a.annotation_target).toBe("DIALOGUE");
      expect(a.annotation_severity).toBe("NOTABLE");
      expect(a.annotation_chapter).toBe(3);
      expect(a.brief_injected).toBe(false);
      expect(a.replacement_triggered).toBe(false);
    });

    it("creates empty annotation when text is null", () => {
      const a = createAnnotation(5, null, null, null);
      expect(a.annotation_present).toBe(false);
      expect(a.annotation_text).toBeNull();
    });

    it("creates empty annotation when text is whitespace", () => {
      const a = createAnnotation(5, "   ", null, null);
      expect(a.annotation_present).toBe(false);
    });

    it("replaces existing annotation for same chapter", () => {
      createAnnotation(3, "First note", "PACING", "MINOR");
      createAnnotation(3, "Updated note", "DIALOGUE", "SIGNIFICANT");
      const all = loadAnnotations();
      expect(all).toHaveLength(1);
      expect(all[0].annotation_text).toBe("Updated note");
      expect(all[0].annotation_target).toBe("DIALOGUE");
    });

    it("stores multiple annotations for different chapters", () => {
      createAnnotation(1, "Note 1", "PACING", "MINOR");
      createAnnotation(2, "Note 2", "HOOK", "NOTABLE");
      createAnnotation(3, "Note 3", "DIALOGUE", "SIGNIFICANT");
      expect(loadAnnotations()).toHaveLength(3);
    });

    it("trims annotation text", () => {
      const a = createAnnotation(1, "  padded text  ", "PACING", "MINOR");
      expect(a.annotation_text).toBe("padded text");
    });
  });

  describe("loadAnnotations", () => {
    it("returns empty array when no annotations", () => {
      expect(loadAnnotations()).toEqual([]);
    });

    it("returns empty array on corrupt data", () => {
      localStorage.setItem("ghostly_editorial_annotations", "not-json");
      expect(loadAnnotations()).toEqual([]);
    });
  });

  describe("getAnnotationForChapter", () => {
    it("returns null when chapter has no annotation", () => {
      expect(getAnnotationForChapter(99)).toBeNull();
    });

    it("returns annotation for specific chapter", () => {
      createAnnotation(7, "Hook weak", "HOOK", "NOTABLE");
      const a = getAnnotationForChapter(7);
      expect(a).not.toBeNull();
      expect(a!.annotation_chapter).toBe(7);
      expect(a!.annotation_text).toBe("Hook weak");
    });
  });

  // ── Brief Injection ───────────────────────────────────────────────

  describe("getAnnotationsForBriefInjection", () => {
    it("returns annotation from N-1 for target chapter N", () => {
      createAnnotation(4, "Pacing slow", "PACING", "NOTABLE");
      const result = getAnnotationsForBriefInjection(5);
      expect(result).toHaveLength(1);
      expect(result[0].annotation_chapter).toBe(4);
    });

    it("skips already-injected annotations", () => {
      createAnnotation(4, "Pacing slow", "PACING", "NOTABLE");
      markAnnotationsInjected([loadAnnotations()[0]], 5);
      const result = getAnnotationsForBriefInjection(5);
      expect(result).toHaveLength(0);
    });

    it("includes N-2 SIGNIFICANT VOICE_CONSISTENCY annotation", () => {
      createAnnotation(3, "Voice drift", "VOICE_CONSISTENCY", "SIGNIFICANT");
      createAnnotation(4, "Pacing issue", "PACING", "NOTABLE");
      const result = getAnnotationsForBriefInjection(5);
      expect(result).toHaveLength(2);
    });

    it("includes N-2 SIGNIFICANT EMOTIONAL_FLATNESS annotation", () => {
      createAnnotation(3, "Flat affect", "EMOTIONAL_FLATNESS", "SIGNIFICANT");
      const result = getAnnotationsForBriefInjection(5);
      expect(result).toHaveLength(1);
      expect(result[0].annotation_target).toBe("EMOTIONAL_FLATNESS");
    });

    it("does NOT include N-2 non-SIGNIFICANT annotation", () => {
      createAnnotation(3, "Minor voice note", "VOICE_CONSISTENCY", "MINOR");
      const result = getAnnotationsForBriefInjection(5);
      expect(result).toHaveLength(0);
    });

    it("does NOT include N-2 SIGNIFICANT PACING annotation (wrong target)", () => {
      createAnnotation(3, "Major pacing", "PACING", "SIGNIFICANT");
      const result = getAnnotationsForBriefInjection(5);
      expect(result).toHaveLength(0);
    });
  });

  describe("markAnnotationsInjected", () => {
    it("marks annotations as injected with target chapter", () => {
      createAnnotation(4, "Note", "PACING", "MINOR");
      const annotations = loadAnnotations();
      markAnnotationsInjected(annotations, 5);
      const updated = getAnnotationForChapter(4);
      expect(updated!.brief_injected).toBe(true);
      expect(updated!.injected_into_chapter).toBe(5);
    });
  });

  describe("buildAnnotationBriefInjection", () => {
    it("returns null for empty annotation", async () => {
      const a = createAnnotation(1, null, null, null);
      const result = await buildAnnotationBriefInjection(a);
      expect(result).toBeNull();
    });

    it("builds injection block for valid annotation", async () => {
      const a = createAnnotation(3, "Tension drops mid-scene", "TENSION_DELIVERY", "NOTABLE");
      const result = await buildAnnotationBriefInjection(a);
      expect(result).not.toBeNull();
      expect(result).toContain("EDITORIAL CALIBRATION NOTE");
      expect(result).toContain("Chapter 3");
      expect(result).toContain("TENSION_DELIVERY");
      expect(result).toContain("NOTABLE");
    });
  });

  describe("generateDerivedInstruction", () => {
    it("returns LLM-generated instruction", async () => {
      const result = await generateDerivedInstruction("Flat dialogue", "DIALOGUE");
      expect(result).toBe("Derived instruction text for testing.");
    });

    it("returns fallback on LLM failure", async () => {
      const { callWithFallback } = await import("@/api/llmRouter");
      (callWithFallback as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("LLM down"));
      const result = await generateDerivedInstruction("Voice drift", "VOICE_CONSISTENCY");
      expect(result).toContain("Voice drift");
      expect(result).toContain("voice consistency");
    });
  });

  // ── Chapter Replacement Flow ──────────────────────────────────────

  describe("initiateChapterReplacement", () => {
    it("creates replacement record and archives original", async () => {
      const annotation = createAnnotation(5, "Major flaw", "PROSE_TEXTURE", "SIGNIFICANT");
      const record = await initiateChapterReplacement(5, "proj-1", annotation, "Original prose text");
      expect(record.original_chapter_number).toBe(5);
      expect(record.replacement_reason).toBe("Major flaw");
      expect(record.original_chapter_archived).toBe(true);
      expect(record.replacement_approved).toBeNull();
      expect(record.replacement_loops).toBe(1);
    });

    it("marks annotation as replacement triggered", async () => {
      const annotation = createAnnotation(5, "Major flaw", "PROSE_TEXTURE", "SIGNIFICANT");
      await initiateChapterReplacement(5, "proj-1", annotation, "Prose");
      const updated = getAnnotationForChapter(5);
      expect(updated!.replacement_triggered).toBe(true);
      expect(updated!.replacement_chapter_number).toBe(5);
    });

    it("persists replacement to localStorage", async () => {
      const annotation = createAnnotation(5, "Flaw", "PACING", "SIGNIFICANT");
      await initiateChapterReplacement(5, "proj-1", annotation, "Prose");
      const replacements = loadReplacements();
      expect(replacements).toHaveLength(1);
    });
  });

  describe("resolveReplacement", () => {
    it("approves pending replacement", async () => {
      const annotation = createAnnotation(5, "Flaw", "PACING", "SIGNIFICANT");
      await initiateChapterReplacement(5, "proj-1", annotation, "Prose");
      const result = resolveReplacement(5, true);
      expect(result).not.toBeNull();
      expect(result!.replacement_approved).toBe(true);
    });

    it("increments loop count on rejection", async () => {
      const annotation = createAnnotation(5, "Flaw", "PACING", "SIGNIFICANT");
      await initiateChapterReplacement(5, "proj-1", annotation, "Prose");
      const result = resolveReplacement(5, false);
      expect(result!.replacement_loops).toBe(2);
      expect(result!.replacement_approved).toBeNull();
    });

    it("returns null when no pending replacement exists", () => {
      expect(resolveReplacement(99, true)).toBeNull();
    });
  });

  describe("getActiveReplacement", () => {
    it("returns null when no replacement exists", () => {
      expect(getActiveReplacement(5)).toBeNull();
    });

    it("returns pending replacement", async () => {
      const annotation = createAnnotation(5, "Flaw", "PACING", "SIGNIFICANT");
      await initiateChapterReplacement(5, "proj-1", annotation, "Prose");
      expect(getActiveReplacement(5)).not.toBeNull();
    });

    it("returns null after approval", async () => {
      const annotation = createAnnotation(5, "Flaw", "PACING", "SIGNIFICANT");
      await initiateChapterReplacement(5, "proj-1", annotation, "Prose");
      resolveReplacement(5, true);
      expect(getActiveReplacement(5)).toBeNull();
    });
  });

  describe("getReplacementLoopCount", () => {
    it("returns 0 when no replacements", () => {
      expect(getReplacementLoopCount(5)).toBe(0);
    });

    it("returns max loop count", async () => {
      const annotation = createAnnotation(5, "Flaw", "PACING", "SIGNIFICANT");
      await initiateChapterReplacement(5, "proj-1", annotation, "Prose");
      resolveReplacement(5, false); // loops → 2
      resolveReplacement(5, false); // loops → 3
      expect(getReplacementLoopCount(5)).toBe(3);
    });
  });

  // ── Calibration Pattern Detector ──────────────────────────────────

  describe("shouldRunCalibrationPattern", () => {
    it("returns false with no annotations", () => {
      expect(shouldRunCalibrationPattern()).toBe(false);
    });

    it("returns false with fewer than 5 present annotations", () => {
      for (let i = 1; i <= 3; i++) {
        createAnnotation(i, `Note ${i}`, "PACING", "MINOR");
      }
      expect(shouldRunCalibrationPattern()).toBe(false);
    });

    it("returns true at exactly 5 present annotations", () => {
      for (let i = 1; i <= 5; i++) {
        createAnnotation(i, `Note ${i}`, "PACING", "MINOR");
      }
      expect(shouldRunCalibrationPattern()).toBe(true);
    });

    it("returns true at 10 present annotations", () => {
      for (let i = 1; i <= 10; i++) {
        createAnnotation(i, `Note ${i}`, "PACING", "MINOR");
      }
      expect(shouldRunCalibrationPattern()).toBe(true);
    });

    it("does not count empty annotations", () => {
      for (let i = 1; i <= 4; i++) {
        createAnnotation(i, `Note ${i}`, "PACING", "MINOR");
      }
      createAnnotation(5, null, null, null); // empty
      expect(shouldRunCalibrationPattern()).toBe(false);
    });
  });

  describe("runCalibrationPatternDetector", () => {
    it("returns null with fewer than 5 annotations", async () => {
      createAnnotation(1, "Note", "PACING", "MINOR");
      expect(await runCalibrationPatternDetector()).toBeNull();
    });

    it("returns parsed result from LLM", async () => {
      const { callWithFallback } = await import("@/api/llmRouter");
      (callWithFallback as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        content: JSON.stringify({
          most_common_gap: "PACING",
          gap_frequency: 3,
          module_divergence_suspected: null,
          divergence_evidence: null,
          recommended_adjustment: "Tighten pacing targets",
        }),
      });

      for (let i = 1; i <= 5; i++) {
        createAnnotation(i, `Note ${i}`, "PACING", "MINOR");
      }
      const result = await runCalibrationPatternDetector();
      expect(result).not.toBeNull();
      expect(result!.most_common_gap).toBe("PACING");
      expect(result!.gap_frequency).toBe(3);
    });
  });
});
