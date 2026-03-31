import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveApprovedRecord,
  runLivingStateUpdate,
  runMemoryCoreProposal,
  runCalibrationAnchorRecording,
} from "../postApprovalHooks";
import type { PipelineState } from "../pipelineTypes";
import type { GenerationSuccess } from "../generationCore";

// ── Mocks ───────────────────────────────────────────────────────────────

vi.mock("@/storage/githubStorage", () => ({
  githubStorage: {
    saveFile: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/modules/livingState/livingState", () => ({
  updateLivingState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/memoryCore/memoryCore", () => ({
  proposeUpdate: vi.fn(),
}));

vi.mock("@/modules/texturePass/calibrationAnchorStore", () => ({
  recordAnchorsFromTells: vi.fn().mockReturnValue([]),
  syncAnchorsToGitHub: vi.fn().mockResolvedValue(undefined),
}));

function makeState(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    chapter_number: 1,
    project_id: "test",
    stage: "APPROVED",
    generation_result: null,
    approved_record: {
      chapter_number: 1,
      approved_draft: "Test prose.",
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
    },
    quality_score: null,
    medical_fact_check_result: null,
    medical_advisory_required: false,
    texture_pass_record: null,
    anti_ai_result: null,
    error: null,
    started_at: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  };
}

function makeGenerationSuccess(): GenerationSuccess {
  return {
    blocked: false,
    content: "Test prose.",
    model_used: "claude-sonnet-latest",
    tokens_used: 1000,
    cache_read_tokens: 600,
    cache_write_tokens: 400,
    refusal_detected: false,
    truncation_suspected: false,
    forbidden_word_violations: {
      violations: [{ word: "noticed", tier: "hard_ban" as const, context: "narration" as const, position: 100 }],
      hardBanCount: 1,
      softBanCount: 0,
      dialogueExemptCleared: 0,
      contextFlagCount: 0,
    },
    boundary_violations: [],
    brief: {} as any,
    validation: {} as any,
    generation_config: {
      prose_dna_version: "v2.4",
      tell_suppression_active: true,
      tell_suppression_version: "1.0",
    },
  };
}

describe("postApprovalHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveApprovedRecord", () => {
    it("saves to correct GitHub path", async () => {
      const { githubStorage } = await import("@/storage/githubStorage");
      const state = makeState();
      await saveApprovedRecord(3, "my-project", state);
      expect(githubStorage.saveFile).toHaveBeenCalledWith(
        "story-data/my-project/chapters/3/approved.json",
        expect.any(String),
      );
    });

    it("skips save when no approved_record", async () => {
      const { githubStorage } = await import("@/storage/githubStorage");
      const state = makeState({ approved_record: null });
      await saveApprovedRecord(1, "test", state);
      expect(githubStorage.saveFile).not.toHaveBeenCalled();
    });

    it("does not throw on save error", async () => {
      const { githubStorage } = await import("@/storage/githubStorage");
      (githubStorage.saveFile as any).mockRejectedValueOnce(new Error("network"));
      await expect(saveApprovedRecord(1, "test", makeState())).resolves.toBeUndefined();
    });
  });

  describe("runLivingStateUpdate", () => {
    it("calls updateLivingState with correct args", async () => {
      const { updateLivingState } = await import("@/modules/livingState/livingState");
      await runLivingStateUpdate("chapter text", 5, "proj");
      expect(updateLivingState).toHaveBeenCalledWith("chapter text", 5, "proj");
    });

    it("does not throw on error", async () => {
      const { updateLivingState } = await import("@/modules/livingState/livingState");
      (updateLivingState as any).mockRejectedValueOnce(new Error("fail"));
      await expect(runLivingStateUpdate("text", 1, "p")).resolves.toBeUndefined();
    });
  });

  describe("runMemoryCoreProposal", () => {
    it("proposes update with chapter metadata", async () => {
      const { proposeUpdate } = await import("@/modules/memoryCore/memoryCore");
      const gen = makeGenerationSuccess();
      runMemoryCoreProposal("proj", gen, 2);
      expect(proposeUpdate).toHaveBeenCalledWith("proj", {
        chapter_approved: 2,
        model_used: "claude-sonnet-latest",
        tokens_used: 1000,
        truncation_suspected: false,
        forbidden_word_count: 1,
        boundary_warning_count: 0,
      });
    });
  });

  describe("runCalibrationAnchorRecording", () => {
    it("skips when no anti_ai_result", async () => {
      const store = await import("@/modules/texturePass/calibrationAnchorStore");
      runCalibrationAnchorRecording(makeState({ anti_ai_result: null }), "text", 1, "proj");
      expect(store.recordAnchorsFromTells).not.toHaveBeenCalled();
    });

    it("skips when tells_detected is empty", async () => {
      const store = await import("@/modules/texturePass/calibrationAnchorStore");
      const state = makeState({
        anti_ai_result: { tells_detected: [], composite_score: 9, pass: true } as any,
      });
      runCalibrationAnchorRecording(state, "text", 1, "proj");
      expect(store.recordAnchorsFromTells).not.toHaveBeenCalled();
    });

    it("records anchors and syncs when tells exist", async () => {
      const store = await import("@/modules/texturePass/calibrationAnchorStore");
      (store.recordAnchorsFromTells as any).mockReturnValue([{ id: "a1" }]);

      const state = makeState({
        anti_ai_result: {
          tells_detected: [{ tell_type: "passive_voice", excerpt: "was noticed", severity: 0.7 }],
          composite_score: 7,
          pass: true,
        } as any,
      });

      runCalibrationAnchorRecording(state, "chapter text", 3, "proj");
      expect(store.recordAnchorsFromTells).toHaveBeenCalledWith(
        3,
        state.anti_ai_result!.tells_detected,
        "chapter text",
      );
      expect(store.syncAnchorsToGitHub).toHaveBeenCalledWith("proj");
    });
  });
});
