import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runChapterPipeline,
  applyHumanOverride,
  updateSignOff,
  checkManuscriptLockEligibility,
} from "../chapterPipeline";
import { getActivePipelines, setPipelineState, pipelineKey } from "../pipelineStateManager";
import type { PipelineState, ApprovedChapterRecord } from "../pipelineTypes";

// ── Mocks ───────────────────────────────────────────────────────────────

vi.mock("../generationCore", () => ({
  generateChapter: vi.fn(),
}));

vi.mock("@/modules/livingState/livingState", () => ({
  getLivingState: vi.fn().mockReturnValue({ emotional_state_at_chapter_end: "tense" }),
  updateLivingState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/outline/outlineSystem", () => ({
  getChapter: vi.fn().mockReturnValue({
    scene_type: "confrontation",
    emotional_resonance_target: "escalating",
    scene_purpose: "reveal therapist's motive",
  }),
}));

vi.mock("@/modules/quality/medicalFactChecker", () => ({
  runMedicalFactCheck: vi.fn().mockResolvedValue({
    pass: true,
    advisory_required: false,
    claims: [],
  }),
}));

vi.mock("@/modules/texturePass/texturePass", () => ({
  runTexturePass: vi.fn().mockResolvedValue({
    revisedText: "Revised prose.",
    texturePassRecord: { pass_status: "COMPLETED", token_cost: 200 },
  }),
}));

vi.mock("@/modules/texturePass/calibrationAnchorStore", () => ({
  loadCalibrationAnchors: vi.fn().mockReturnValue([]),
  recordAnchorsFromTells: vi.fn().mockReturnValue([]),
  syncAnchorsToGitHub: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/storage/githubStorage", () => ({
  githubStorage: { saveFile: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/modules/memoryCore/memoryCore", () => ({
  proposeUpdate: vi.fn(),
}));

function makeSuccessResult() {
  return {
    blocked: false,
    content: "Generated prose.",
    model_used: "claude-sonnet-latest",
    tokens_used: 1200,
    cache_read_tokens: 800,
    cache_write_tokens: 400,
    refusal_detected: false,
    truncation_suspected: false,
    forbidden_word_violations: {
      violations: [],
      hardBanCount: 0,
      softBanCount: 0,
      dialogueExemptCleared: 0,
      contextFlagCount: 0,
    },
    boundary_violations: [],
    brief: {},
    validation: {},
  };
}

function makeApprovedRecord(overrides: Partial<ApprovedChapterRecord> = {}): ApprovedChapterRecord {
  return {
    chapter_number: 1,
    approved_draft: "Prose.",
    composite_score: null,
    human_editorial_override: false,
    override_note: null,
    emotional_state_at_chapter_end: null,
    generation_truncation_suspected: false,
    human_editorial_sign_off: { status: "PENDING", signed_by: null, signed_at: null, notes: null },
    model_used: "claude-sonnet-latest",
    tokens_used: 1000,
    cache_read_tokens: 600,
    cache_write_tokens: 400,
    approved_at: new Date().toISOString(),
    editorial_annotation: null,
    ...overrides,
  };
}

function seedPipelineState(chapterNumber: number, projectId: string, recordOverrides: Partial<ApprovedChapterRecord> = {}): PipelineState {
  const state: PipelineState = {
    chapter_number: chapterNumber,
    project_id: projectId,
    stage: "APPROVED",
    generation_result: null,
    approved_record: makeApprovedRecord({ chapter_number: chapterNumber, ...recordOverrides }),
    quality_score: null,
    medical_fact_check_result: null,
    medical_advisory_required: false,
    texture_pass_record: null,
    anti_ai_result: null,
    error: null,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  };
  setPipelineState(pipelineKey(chapterNumber, projectId), state);
  return state;
}

describe("chapterPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActivePipelines().clear();
  });

  // ── runChapterPipeline ──────────────────────────────────────────────

  describe("runChapterPipeline", () => {
    it("succeeds through full pipeline with PENDING sign-off [A16-1]", async () => {
      const { generateChapter } = await import("../generationCore");
      (generateChapter as any).mockResolvedValue(makeSuccessResult());

      const { success, state } = await runChapterPipeline(1, "proj");

      expect(success).toBe(true);
      expect(state.stage).toBe("APPROVED");
      expect(state.approved_record).not.toBeNull();
      expect(state.approved_record!.human_editorial_sign_off.status).toBe("PENDING");
    });

    it("transitions to BLOCKED when generation is blocked", async () => {
      const { generateChapter } = await import("../generationCore");
      (generateChapter as any).mockResolvedValue({
        blocked: true,
        reason: "CORPUS_NOT_APPROVED",
        message: "Voice corpus not approved",
      });

      const { success, state } = await runChapterPipeline(2, "proj");

      expect(success).toBe(false);
      expect(state.stage).toBe("BLOCKED");
      expect(state.error).toBe("Voice corpus not approved");
    });

    it("transitions to BLOCKED on generation exception", async () => {
      const { generateChapter } = await import("../generationCore");
      (generateChapter as any).mockRejectedValue(new Error("API timeout"));

      const { success, state } = await runChapterPipeline(3, "proj");

      expect(success).toBe(false);
      expect(state.stage).toBe("BLOCKED");
      expect(state.error).toBe("API timeout");
    });

    it("runs post-approval hooks on success", async () => {
      const { generateChapter } = await import("../generationCore");
      (generateChapter as any).mockResolvedValue(makeSuccessResult());

      const { githubStorage } = await import("@/storage/githubStorage");
      const { proposeUpdate } = await import("@/modules/memoryCore/memoryCore");

      await runChapterPipeline(1, "proj");

      expect(githubStorage.saveFile).toHaveBeenCalled();
      expect(proposeUpdate).toHaveBeenCalled();
    });

    it("wires outline and living state data into texture pass", async () => {
      const { generateChapter } = await import("../generationCore");
      (generateChapter as any).mockResolvedValue(makeSuccessResult());

      const { runTexturePass } = await import("@/modules/texturePass/texturePass");

      await runChapterPipeline(1, "proj");

      expect(runTexturePass).toHaveBeenCalledWith(
        expect.objectContaining({
          chapterType: "confrontation",
          emotionalArc: "escalating",
          scenePurpose: "reveal therapist's motive",
          currentPressureState: "tense",
        }),
      );
    });

    it("succeeds when texture pass throws (non-blocking)", async () => {
      const { generateChapter } = await import("../generationCore");
      (generateChapter as any).mockResolvedValue(makeSuccessResult());

      const { runTexturePass } = await import("@/modules/texturePass/texturePass");
      (runTexturePass as any).mockRejectedValueOnce(new Error("texture LLM timeout"));

      const { success, state } = await runChapterPipeline(1, "proj");

      expect(success).toBe(true);
      expect(state.stage).toBe("APPROVED");
      expect(state.texture_pass_record).toBeNull();
    });

    it("proceeds with raw text when texture pass status is FAILED", async () => {
      const { generateChapter } = await import("../generationCore");
      const genResult = makeSuccessResult();
      genResult.content = "Original prose.";
      (generateChapter as any).mockResolvedValue(genResult);

      const { runTexturePass } = await import("@/modules/texturePass/texturePass");
      (runTexturePass as any).mockResolvedValueOnce({
        revisedText: "Should not be used.",
        texturePassRecord: { pass_status: "FAILED", token_cost: 0 },
      });

      const { success, state } = await runChapterPipeline(1, "proj");

      expect(success).toBe(true);
      expect(state.texture_pass_record!.pass_status).toBe("FAILED");
      // Content should remain original since pass_status !== COMPLETED
      expect(state.approved_record!.approved_draft).toBe("Original prose.");
    });

    it("succeeds when medical fact check throws (non-blocking)", async () => {
      const { generateChapter } = await import("../generationCore");
      (generateChapter as any).mockResolvedValue(makeSuccessResult());

      const { runMedicalFactCheck } = await import("@/modules/quality/medicalFactChecker");
      (runMedicalFactCheck as any).mockRejectedValueOnce(new Error("medical API down"));

      const { success, state } = await runChapterPipeline(1, "proj");

      expect(success).toBe(true);
      expect(state.stage).toBe("APPROVED");
      expect(state.medical_fact_check_result).toBeNull();
      expect(state.medical_advisory_required).toBe(false);
    });

    it("sets advisory_required when medical check flags it", async () => {
      const { generateChapter } = await import("../generationCore");
      (generateChapter as any).mockResolvedValue(makeSuccessResult());

      const { runMedicalFactCheck } = await import("@/modules/quality/medicalFactChecker");
      (runMedicalFactCheck as any).mockResolvedValueOnce({
        pass: false,
        advisory_required: true,
        claims: [{ claim: "incorrect dosage", severity: "HIGH" }],
      });

      const { success, state } = await runChapterPipeline(1, "proj");

      expect(success).toBe(true);
      expect(state.medical_advisory_required).toBe(true);
      expect(state.medical_fact_check_result!.pass).toBe(false);
    });

    it("succeeds when both texture pass and medical check fail simultaneously", async () => {
      const { generateChapter } = await import("../generationCore");
      (generateChapter as any).mockResolvedValue(makeSuccessResult());

      const { runTexturePass } = await import("@/modules/texturePass/texturePass");
      (runTexturePass as any).mockRejectedValueOnce(new Error("texture fail"));

      const { runMedicalFactCheck } = await import("@/modules/quality/medicalFactChecker");
      (runMedicalFactCheck as any).mockRejectedValueOnce(new Error("medical fail"));

      const { success, state } = await runChapterPipeline(1, "proj");

      expect(success).toBe(true);
      expect(state.stage).toBe("APPROVED");
      expect(state.texture_pass_record).toBeNull();
      expect(state.medical_fact_check_result).toBeNull();
    });
  });

  // ── applyHumanOverride ──────────────────────────────────────────────

  describe("applyHumanOverride", () => {
    it("updates draft and resets sign-off to PENDING", async () => {
      seedPipelineState(1, "proj", {
        human_editorial_sign_off: { status: "SIGNED_OFF", signed_by: "editor", signed_at: "2026-01-01", notes: null },
      });

      const record = await applyHumanOverride(1, "proj", "New prose.", "Fixed pacing");

      expect(record).not.toBeNull();
      expect(record!.approved_draft).toBe("New prose.");
      expect(record!.human_editorial_override).toBe(true);
      expect(record!.override_note).toBe("Fixed pacing");
      expect(record!.human_editorial_sign_off.status).toBe("PENDING");
      expect(record!.human_editorial_sign_off.signed_by).toBeNull();
    });

    it("returns null when no approved record exists", async () => {
      const result = await applyHumanOverride(99, "proj", "text", "note");
      expect(result).toBeNull();
    });
  });

  // ── updateSignOff ───────────────────────────────────────────────────

  describe("updateSignOff", () => {
    it("updates sign-off status", () => {
      seedPipelineState(1, "proj");

      const result = updateSignOff(1, "proj", "SIGNED_OFF", "editor", "Looks good");

      expect(result).toBe(true);
      const state = getActivePipelines().get(pipelineKey(1, "proj"));
      expect(state!.approved_record!.human_editorial_sign_off.status).toBe("SIGNED_OFF");
      expect(state!.approved_record!.human_editorial_sign_off.signed_by).toBe("editor");
    });

    it("rejects SKIPPED when truncation suspected", () => {
      seedPipelineState(1, "proj", { generation_truncation_suspected: true });

      const result = updateSignOff(1, "proj", "SKIPPED", "editor");

      expect(result).toBe(false);
    });

    it("allows SIGNED_OFF even when truncation suspected", () => {
      seedPipelineState(1, "proj", { generation_truncation_suspected: true });

      const result = updateSignOff(1, "proj", "SIGNED_OFF", "editor");

      expect(result).toBe(true);
    });

    it("returns false when no approved record", () => {
      expect(updateSignOff(99, "proj", "SIGNED_OFF", "editor")).toBe(false);
    });
  });

  // ── checkManuscriptLockEligibility [A16-2] ──────────────────────────

  describe("checkManuscriptLockEligibility", () => {
    it("eligible when all chapters are SIGNED_OFF or SKIPPED", () => {
      seedPipelineState(1, "proj", {
        human_editorial_sign_off: { status: "SIGNED_OFF", signed_by: "e", signed_at: "t", notes: null },
      });
      seedPipelineState(2, "proj", {
        human_editorial_sign_off: { status: "SKIPPED", signed_by: "e", signed_at: "t", notes: null },
      });

      const result = checkManuscriptLockEligibility("proj");
      expect(result.eligible).toBe(true);
      expect(result.blocking_chapters).toEqual([]);
    });

    it("blocks on PENDING chapters [A16-2]", () => {
      seedPipelineState(1, "proj", {
        human_editorial_sign_off: { status: "SIGNED_OFF", signed_by: "e", signed_at: "t", notes: null },
      });
      seedPipelineState(2, "proj"); // defaults to PENDING

      const result = checkManuscriptLockEligibility("proj");
      expect(result.eligible).toBe(false);
      expect(result.blocking_chapters).toEqual([2]);
    });

    it("blocks on FLAGGED_FOR_REVISION chapters", () => {
      seedPipelineState(3, "proj", {
        human_editorial_sign_off: { status: "FLAGGED_FOR_REVISION", signed_by: "e", signed_at: "t", notes: "needs work" },
      });

      const result = checkManuscriptLockEligibility("proj");
      expect(result.eligible).toBe(false);
      expect(result.blocking_chapters).toEqual([3]);
    });

    it("returns sorted blocking chapters", () => {
      seedPipelineState(5, "proj");
      seedPipelineState(2, "proj");
      seedPipelineState(8, "proj");

      const result = checkManuscriptLockEligibility("proj");
      expect(result.blocking_chapters).toEqual([2, 5, 8]);
    });

    it("ignores chapters from other projects", () => {
      seedPipelineState(1, "other-proj");

      const result = checkManuscriptLockEligibility("proj");
      expect(result.eligible).toBe(true);
    });
  });
});
