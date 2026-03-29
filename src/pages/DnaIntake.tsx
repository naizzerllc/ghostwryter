/**
 * DNA Intake Page — Book DNA braindump, extraction, gap-fill, review, export.
 * GHOSTLY v2.2 · Sessions 6–7
 *
 * Five stages: BRAINDUMP → EXTRACTING → CONVERSATION → REVIEW → COMPLETE
 */

import { useState, useCallback, useMemo } from "react";
import { extractDna, DNA_QUESTIONS, getQuestionById } from "@/lib/dnaExtraction";
import { generateGapOptions, generateForcedChoiceOptions } from "@/lib/dnaGapFiller";
import { exportDnaBrief } from "@/lib/dnaBriefExporter";
import { appendFragments } from "@/lib/ideaBankStorage";
import { getBrandDnaConfig } from "@/lib/dnaConfigStorage";
import type {
  IntakeStage,
  DnaAnswer,
  DnaGap,
  ExtractionResult,
  ConstraintOverride,
  SavedFragment,
  QuestionPhase,
} from "@/types/dna";

// ── Brand DNA Toggles ───────────────────────────────────────────────────

interface BrandToggleProps {
  overrides: ConstraintOverride[];
  onToggle: (id: string, enabled: boolean, rationale: string) => void;
}

const BrandDnaToggles = ({ overrides, onToggle }: BrandToggleProps) => {
  const brand = getBrandDnaConfig();
  const [rationaleModal, setRationaleModal] = useState<string | null>(null);
  const [rationaleText, setRationaleText] = useState("");

  const isOverridden = (id: string) =>
    overrides.some((o) => o.constraint_id === id && !o.enabled);

  const handleToggleOff = (id: string) => {
    setRationaleModal(id);
    setRationaleText("");
  };

  const confirmDisable = () => {
    if (rationaleModal && rationaleText.length >= 20) {
      onToggle(rationaleModal, false, rationaleText);
      setRationaleModal(null);
      setRationaleText("");
    }
  };

  const allConstraints = [
    ...brand.permanent_tropes.map((t) => ({ ...t, category: "Permanent" })),
    ...brand.rotating_tropes.map((t) => ({ ...t, category: "Rotating" })),
    ...brand.thematic_dna.map((t) => ({
      ...t,
      category: "Thematic",
      enabled_default: true,
      status: undefined as string | undefined,
    })),
  ];

  return (
    <div className="border border-border p-4 mt-4">
      <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
        Brand DNA Constraints
      </h3>

      <div className="space-y-2">
        {allConstraints.map((c) => {
          const isReserved = c.status === "RESERVED";
          const disabled = isOverridden(c.id);

          return (
            <div
              key={c.id}
              className="flex items-center justify-between py-1.5 px-3 border border-border"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-foreground">
                    {c.label}
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground px-1.5 py-0.5 bg-muted">
                    {c.category}
                  </span>
                  {isReserved && (
                    <span className="text-[9px] font-mono text-warning px-1.5 py-0.5 bg-warning/20">
                      RESERVED
                    </span>
                  )}
                  {disabled && (
                    <span className="text-[9px] font-mono text-destructive px-1.5 py-0.5 bg-destructive/20">
                      BRAND DEVIATION
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {c.description}
                </p>
              </div>
              <button
                onClick={() =>
                  disabled
                    ? onToggle(c.id, true, "")
                    : handleToggleOff(c.id)
                }
                disabled={isReserved}
                className={`ml-3 w-8 h-4 shrink-0 transition-colors ${
                  isReserved
                    ? "bg-muted cursor-not-allowed opacity-40"
                    : disabled
                      ? "bg-destructive/30"
                      : "bg-success/50"
                }`}
              >
                <div
                  className={`w-3 h-3 transition-transform ${
                    disabled ? "translate-x-0.5 bg-destructive" : "translate-x-[18px] bg-success"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* Rationale modal */}
      {rationaleModal && (
        <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center">
          <div className="bg-card border border-border p-6 w-[480px]">
            <h4 className="text-sm font-mono text-foreground mb-2">
              BRAND DEVIATION RATIONALE
            </h4>
            <p className="text-xs text-muted-foreground mb-4">
              Disabling a brand constraint requires a written rationale (minimum
              20 characters). This deviation will be flagged on the project card.
            </p>
            <textarea
              value={rationaleText}
              onChange={(e) => setRationaleText(e.target.value)}
              className="w-full h-20 bg-background border border-border p-3 text-xs font-mono text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Explain why this constraint is being disabled for this project..."
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] text-muted-foreground font-mono">
                {rationaleText.length}/20 minimum
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setRationaleModal(null)}
                  className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground border border-border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDisable}
                  disabled={rationaleText.length < 20}
                  className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors disabled:opacity-40"
                >
                  Disable Constraint
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main DnaIntake Page ─────────────────────────────────────────────────

const DnaIntake = () => {
  const [stage, setStage] = useState<IntakeStage>("BRAINDUMP");
  const [braindump, setBraindump] = useState("");
  const [overrides, setOverrides] = useState<ConstraintOverride[]>([]);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [answers, setAnswers] = useState<DnaAnswer[]>([]);
  const [gaps, setGaps] = useState<DnaGap[]>([]);
  const [currentGapIdx, setCurrentGapIdx] = useState(0);
  const [gapOptions, setGapOptions] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [freetext, setFreetext] = useState("");
  const [showConstraints, setShowConstraints] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [exportResult, setExportResult] = useState<{
    jsonPath: string;
    mdPath: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projectId =
    localStorage.getItem("ghostly_active_project") || "default";
  const projectTitle = projectId === "default" ? "Untitled Project" : projectId;

  const hasBrandDeviation = overrides.some((o) => !o.enabled);

  // ── Constraint toggle handler ─────────────────────────────────────
  const handleConstraintToggle = useCallback(
    (id: string, enabled: boolean, rationale: string) => {
      setOverrides((prev) => {
        const filtered = prev.filter((o) => o.constraint_id !== id);
        if (!enabled) {
          return [
            ...filtered,
            {
              constraint_id: id,
              enabled: false,
              rationale,
              overridden_at: new Date().toISOString(),
            },
          ];
        }
        return filtered;
      });
    },
    [],
  );

  // ── Submit braindump ──────────────────────────────────────────────
  const handleSubmitBraindump = useCallback(async () => {
    setError(null);
    setStage("EXTRACTING");
    try {
      const result = await extractDna(braindump, projectId);
      setExtraction(result);
      setAnswers(result.answers);
      setGaps(result.gaps);

      if (result.gaps.length > 0) {
        setStage("CONVERSATION");
        setCurrentGapIdx(0);
        // Load options for first gap
        await loadOptionsForGap(result.gaps[0], braindump);
      } else {
        setStage("REVIEW");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
      setStage("BRAINDUMP");
    }
  }, [braindump, projectId]);

  // ── Load options for a gap ────────────────────────────────────────
  const loadOptionsForGap = async (gap: DnaGap, context: string) => {
    setLoadingOptions(true);
    setGapOptions([]);
    setFreetext("");
    try {
      const opts =
        gap.gap_type === "FORCED_CHOICE"
          ? await generateForcedChoiceOptions(gap, context)
          : gap.gap_type === "CANDIDATE_OPTIONS"
            ? await generateGapOptions(gap, context)
            : [];
      setGapOptions(opts);
    } catch {
      setGapOptions([]);
    }
    setLoadingOptions(false);
  };

  // ── Answer a gap question ─────────────────────────────────────────
  const handleGapAnswer = useCallback(
    async (answer: string) => {
      const gap = gaps[currentGapIdx];
      if (!gap) return;

      // Update the answer
      setAnswers((prev) =>
        prev.map((a) =>
          a.question_id === gap.question_id
            ? { ...a, status: "FOUND" as const, answer, gap_type: undefined }
            : a,
        ),
      );

      // Move to next gap or review
      const nextIdx = currentGapIdx + 1;
      if (nextIdx < gaps.length) {
        setCurrentGapIdx(nextIdx);
        await loadOptionsForGap(gaps[nextIdx], braindump);
      } else {
        setStage("REVIEW");
      }
    },
    [currentGapIdx, gaps, braindump],
  );

  // ── Edit answer in review ─────────────────────────────────────────
  const startEdit = (questionId: string) => {
    const a = answers.find((a) => a.question_id === questionId);
    setEditingQuestion(questionId);
    setEditValue(a?.answer || "");
  };

  const saveEdit = () => {
    if (!editingQuestion) return;
    setAnswers((prev) =>
      prev.map((a) =>
        a.question_id === editingQuestion
          ? { ...a, answer: editValue, status: editValue ? "FOUND" : a.status }
          : a,
      ),
    );
    setEditingQuestion(null);
    setEditValue("");
  };

  // ── Export ────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    setStage("EXPORTING");
    setError(null);
    try {
      const brand = getBrandDnaConfig();
      const activeConstraints = [
        ...brand.permanent_tropes
          .filter((t) => !overrides.some((o) => o.constraint_id === t.id && !o.enabled))
          .map((t) => t.label),
        ...brand.rotating_tropes
          .filter(
            (t) =>
              t.status !== "RESERVED" &&
              !overrides.some((o) => o.constraint_id === t.id && !o.enabled),
          )
          .map((t) => t.label),
        ...brand.thematic_dna
          .filter((t) => !overrides.some((o) => o.constraint_id === t.id && !o.enabled))
          .map((t) => t.label),
      ];

      const result = await exportDnaBrief(
        projectId,
        projectTitle,
        answers,
        activeConstraints,
      );
      setExportResult(result);

      // Save fragments to Idea Bank
      if (extraction?.saved_fragments && extraction.saved_fragments.length > 0) {
        await appendFragments(extraction.saved_fragments);
      }

      setStage("COMPLETE");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
      setStage("REVIEW");
    }
  }, [answers, overrides, extraction, projectId, projectTitle]);

  // ── Phase grouping for review ─────────────────────────────────────
  const phases: QuestionPhase[] = ["character", "world", "structure", "voice"];

  const currentGap = gaps[currentGapIdx];

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-mono text-foreground tracking-wide">
            DNA INTAKE
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Book DNA extraction and configuration
          </p>
        </div>
        {hasBrandDeviation && (
          <span className="text-[10px] font-mono text-destructive px-2 py-1 bg-destructive/20 border border-destructive/30">
            BRAND DEVIATION ACTIVE
          </span>
        )}
      </div>

      {/* Stage indicator */}
      <div className="flex gap-1 mb-6">
        {(
          [
            "BRAINDUMP",
            "EXTRACTING",
            "CONVERSATION",
            "REVIEW",
            "COMPLETE",
          ] as IntakeStage[]
        ).map((s) => (
          <div
            key={s}
            className={`flex-1 h-1 ${
              s === stage
                ? "bg-primary"
                : ["BRAINDUMP", "EXTRACTING", "CONVERSATION", "REVIEW", "COMPLETE"]
                      .indexOf(s) <
                    ["BRAINDUMP", "EXTRACTING", "CONVERSATION", "REVIEW", "COMPLETE"]
                      .indexOf(stage)
                  ? "bg-success"
                  : "bg-muted"
            }`}
          />
        ))}
      </div>

      {error && (
        <div className="bg-destructive/20 border border-destructive/40 p-3 mb-4">
          <p className="text-xs font-mono text-destructive">{error}</p>
        </div>
      )}

      {/* ── Stage 1: BRAINDUMP ──────────────────────────────────────── */}
      {stage === "BRAINDUMP" && (
        <div>
          <textarea
            value={braindump}
            onChange={(e) => setBraindump(e.target.value)}
            placeholder="Describe your book idea. Don't organise it — just write."
            className="w-full h-64 bg-card border border-border p-4 text-sm text-foreground font-serif resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-[10px] font-mono text-muted-foreground">
              {braindump.length} characters{" "}
              {braindump.length < 50 && "· minimum 50 required"}
            </span>
            <button
              onClick={handleSubmitBraindump}
              disabled={braindump.length < 50}
              className="px-4 py-2 text-xs font-mono uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Extract DNA
            </button>
          </div>

          {/* Collapsible brand constraints */}
          <button
            onClick={() => setShowConstraints(!showConstraints)}
            className="mt-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <span>{showConstraints ? "▾" : "▸"}</span>
            Configure brand DNA constraints
          </button>
          {showConstraints && (
            <BrandDnaToggles
              overrides={overrides}
              onToggle={handleConstraintToggle}
            />
          )}
        </div>
      )}

      {/* ── Stage 2: EXTRACTING ─────────────────────────────────────── */}
      {stage === "EXTRACTING" && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin mb-4" />
          <p className="text-sm font-mono text-foreground">
            Extracting DNA from braindump...
          </p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            Calling Anthropic via dna_extraction task type
          </p>
        </div>
      )}

      {/* ── Stage 3: CONVERSATION ───────────────────────────────────── */}
      {stage === "CONVERSATION" && currentGap && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-mono text-muted-foreground">
              Question {currentGapIdx + 1} of {gaps.length}
            </p>
            <span className="text-[9px] font-mono text-muted-foreground px-1.5 py-0.5 bg-muted uppercase">
              {currentGap.gap_type.replace("_", " ")}
            </span>
          </div>

          <div className="border border-border p-6 mb-4">
            <h3 className="text-sm font-mono text-foreground mb-2">
              {getQuestionById(currentGap.question_id)?.label}
            </h3>
            <p className="text-xs text-muted-foreground">
              {getQuestionById(currentGap.question_id)?.description}
            </p>
          </div>

          {loadingOptions ? (
            <div className="flex items-center gap-2 py-4">
              <div className="w-4 h-4 border border-primary border-t-transparent animate-spin" />
              <span className="text-xs font-mono text-muted-foreground">
                Generating options...
              </span>
            </div>
          ) : (
            <>
              {/* Option cards */}
              {gapOptions.length > 0 && (
                <div className="space-y-2 mb-4">
                  {gapOptions.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleGapAnswer(opt)}
                      className="w-full text-left p-3 border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      <span className="text-xs font-mono text-foreground">
                        {opt}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Freetext (always for OPEN, alternative for others) */}
              <div className="border-t border-border pt-4">
                {currentGap.gap_type !== "FORCED_CHOICE" && (
                  <>
                    {gapOptions.length > 0 && (
                      <p className="text-[10px] font-mono text-muted-foreground mb-2 uppercase">
                        Or write your own:
                      </p>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={freetext}
                        onChange={(e) => setFreetext(e.target.value)}
                        placeholder="Type your answer..."
                        className="flex-1 bg-card border border-border px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        onClick={() => {
                          if (freetext.trim()) handleGapAnswer(freetext.trim());
                        }}
                        disabled={!freetext.trim()}
                        className="px-4 py-2 text-xs font-mono uppercase bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-30"
                      >
                        Submit
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Stage 4: REVIEW ─────────────────────────────────────────── */}
      {stage === "REVIEW" && (
        <div>
          {phases.map((phase) => {
            const phaseAnswers = answers.filter((a) => {
              const q = DNA_QUESTIONS.find((q) => q.id === a.question_id);
              return q?.phase === phase && a.status !== "SKIPPED";
            });
            if (phaseAnswers.length === 0) return null;

            return (
              <div key={phase} className="mb-6">
                <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 border-b border-border pb-2">
                  {phase}
                </h3>
                <div className="space-y-2">
                  {phaseAnswers.map((a) => {
                    const q = getQuestionById(a.question_id);
                    const isEditing = editingQuestion === a.question_id;

                    return (
                      <div
                        key={a.question_id}
                        className="border border-border p-3"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-foreground">
                            {q?.label}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.5 ${
                                a.status === "FOUND"
                                  ? "bg-success/20 text-success"
                                  : "bg-warning/20 text-warning"
                              }`}
                            >
                              {a.status}
                            </span>
                            {!isEditing && (
                              <button
                                onClick={() => startEdit(a.question_id)}
                                className="text-[9px] font-mono text-muted-foreground hover:text-foreground"
                              >
                                EDIT
                              </button>
                            )}
                          </div>
                        </div>
                        {isEditing ? (
                          <div className="mt-2">
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full h-16 bg-background border border-border p-2 text-xs text-foreground font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={saveEdit}
                                className="px-3 py-1 text-[10px] font-mono uppercase bg-primary text-primary-foreground"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingQuestion(null)}
                                className="px-3 py-1 text-[10px] font-mono uppercase text-muted-foreground border border-border"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">
                            {a.answer || "Not answered"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex justify-end mt-6">
            <button
              onClick={handleExport}
              className="px-6 py-2.5 text-xs font-mono uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
            >
              Export DNA Brief
            </button>
          </div>
        </div>
      )}

      {/* ── Stage: EXPORTING ────────────────────────────────────────── */}
      {stage === "EXPORTING" && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin mb-4" />
          <p className="text-sm font-mono text-foreground">
            Exporting DNA Brief...
          </p>
        </div>
      )}

      {/* ── Stage 5: COMPLETE ───────────────────────────────────────── */}
      {stage === "COMPLETE" && exportResult && (
        <div className="border border-success/30 bg-success/5 p-6">
          <h3 className="text-sm font-mono text-success mb-4">
            ✓ DNA BRIEF EXPORTED
          </h3>

          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground w-12">
                JSON
              </span>
              <code className="text-xs font-mono text-foreground bg-card px-2 py-1 border border-border flex-1">
                {exportResult.jsonPath}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground w-12">
                MD
              </span>
              <code className="text-xs font-mono text-foreground bg-card px-2 py-1 border border-border flex-1">
                {exportResult.mdPath}
              </code>
            </div>
          </div>

          {extraction?.saved_fragments &&
            extraction.saved_fragments.length > 0 && (
              <p className="text-xs text-muted-foreground font-mono mb-4">
                {extraction.saved_fragments.length} fragment(s) saved to Idea
                Bank
              </p>
            )}

          <div className="border-t border-success/20 pt-4 mt-4">
            <p className="text-xs text-muted-foreground font-mono">
              Paste the exported markdown at the start of your V6 outline
              session before Section 0.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DnaIntake;
