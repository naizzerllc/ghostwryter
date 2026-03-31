import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pipelineKey,
  emitStateChange,
  subscribeToPipeline,
  getPipelineState,
  setPipelineState,
  getActivePipelines,
} from "../pipelineStateManager";
import type { PipelineState } from "../pipelineTypes";

function makeState(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    chapter_number: 1,
    project_id: "test-project",
    stage: "IDLE",
    generation_result: null,
    approved_record: null,
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

describe("pipelineStateManager", () => {
  beforeEach(() => {
    // Clear all pipelines between tests
    getActivePipelines().clear();
  });

  describe("pipelineKey", () => {
    it("generates correct key format", () => {
      expect(pipelineKey(3, "my-project")).toBe("my-project:ch3");
    });
  });

  describe("setPipelineState / getPipelineState", () => {
    it("stores and retrieves state", () => {
      const state = makeState({ chapter_number: 2 });
      setPipelineState("test-project:ch2", state);
      const retrieved = getPipelineState(2, "test-project");
      expect(retrieved).toBe(state);
    });

    it("returns null for unknown key", () => {
      expect(getPipelineState(99, "missing")).toBeNull();
    });
  });

  describe("subscribeToPipeline / emitStateChange", () => {
    it("calls listeners on state change", () => {
      const listener = vi.fn();
      subscribeToPipeline(listener);

      const state = makeState({ stage: "GENERATING" });
      emitStateChange(state);

      expect(listener).toHaveBeenCalledWith(state);
    });

    it("returns unsubscribe function", () => {
      const listener = vi.fn();
      const unsub = subscribeToPipeline(listener);
      unsub();

      emitStateChange(makeState());
      expect(listener).not.toHaveBeenCalled();
    });

    it("isolates listener errors", () => {
      const badListener = vi.fn(() => { throw new Error("boom"); });
      const goodListener = vi.fn();

      subscribeToPipeline(badListener);
      subscribeToPipeline(goodListener);

      const state = makeState();
      emitStateChange(state);

      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalledWith(state);
    });
  });

  describe("getActivePipelines", () => {
    it("returns the internal map", () => {
      const map = getActivePipelines();
      expect(map).toBeInstanceOf(Map);
    });
  });
});
