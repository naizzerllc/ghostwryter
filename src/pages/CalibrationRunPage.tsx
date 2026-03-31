/**
 * Module Weight Calibration Run — Human-scored calibration against pipeline scores.
 * GHOSTLY v2.2 · Session 28
 *
 * Requires Book 1 to have at least 5 approved chapters.
 * Writer rates each chapter, system detects module bias and suggests weight adjustments.
 */

import { useState, useMemo } from "react";

// ── Types ───────────────────────────────────────────────────────────────

interface ChapterScore {
  chapter_number: number;
  composite_score: number;
  module_scores: Record<string, number>;
  human_score: number | null;
}

interface ModuleCalibration {
  module: string;
  current_weight: number;
  avg_divergence: number;
  direction: "optimistic" | "pessimistic" | "aligned";
  suggested_weight: number;
  chapters_divergent: number;
}

// ── Default quality gate weights ────────────────────────────────────────

const DEFAULT_WEIGHTS: Record<string, number> = {
  reader_simulation: 0.32,
  developmental_editor: 0.20,
  anti_ai: 0.18,
  line_editor: 0.15,
  dialogue_editor: 0.10,
  continuity_editor: 0.05,
};

const MODULE_LABELS: Record<string, string> = {
  reader_simulation: "Reader Simulation",
  developmental_editor: "Developmental Editor",
  anti_ai: "Anti-AI Detection",
  line_editor: "Line Editor",
  dialogue_editor: "Dialogue Editor",
  continuity_editor: "Continuity Editor",
};

// ── Load approved chapters from localStorage ────────────────────────────

function loadApprovedChapters(): ChapterScore[] {
  try {
    const raw = localStorage.getItem("ghostly_approved_chapters");
    if (!raw) return [];
    const chapters = JSON.parse(raw);
    if (!Array.isArray(chapters)) return [];
    return chapters
      .filter((c: Record<string, unknown>) => c.chapter_number && c.composite_score)
      .slice(0, 5)
      .map((c: Record<string, unknown>) => ({
        chapter_number: c.chapter_number as number,
        composite_score: c.composite_score as number,
        module_scores: (c.module_scores as Record<string, number>) ?? {},
        human_score: null,
      }));
  } catch {
    return [];
  }
}

// ── Calibration logic ───────────────────────────────────────────────────

function calculateCalibration(
  chapters: ChapterScore[],
  weights: Record<string, number>,
): ModuleCalibration[] {
  const rated = chapters.filter((c) => c.human_score !== null);
  if (rated.length < 5) return [];

  return Object.entries(weights).map(([module, weight]) => {
    const divergences = rated.map((c) => {
      const moduleScore = c.module_scores[module] ?? c.composite_score;
      return moduleScore - (c.human_score ?? 0);
    });

    const avgDiv = divergences.reduce((s, v) => s + v, 0) / divergences.length;
    const chaptersOver = divergences.filter((d) => Math.abs(d) >= 1.0).length;

    let direction: "optimistic" | "pessimistic" | "aligned" = "aligned";
    if (avgDiv > 0.5) direction = "optimistic";
    else if (avgDiv < -0.5) direction = "pessimistic";

    // Suggest weight adjustment if divergent on 3+ chapters
    let suggested = weight;
    if (chaptersOver >= 3) {
      if (direction === "optimistic") suggested = Math.max(0.05, weight - 0.04);
      else if (direction === "pessimistic") suggested = Math.min(0.50, weight + 0.04);
    }

    return {
      module,
      current_weight: weight,
      avg_divergence: Math.round(avgDiv * 100) / 100,
      direction,
      suggested_weight: Math.round(suggested * 100) / 100,
      chapters_divergent: chaptersOver,
    };
  });
}

// ── Component ───────────────────────────────────────────────────────────

export default function CalibrationRunPage() {
  const [chapters, setChapters] = useState<ChapterScore[]>(() => loadApprovedChapters());
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem("ghostly_quality_weights");
      if (raw) return JSON.parse(raw);
    } catch { /* use defaults */ }
    return { ...DEFAULT_WEIGHTS };
  });
  const [accepted, setAccepted] = useState(false);

  const hasEnoughChapters = chapters.length >= 5;
  const allRated = chapters.every((c) => c.human_score !== null);

  // Validate: at least 1 strong (≥8.5), 1 weak (<7.5), 1 adequate (7–8)
  const ratingDistribution = useMemo(() => {
    if (!allRated) return { valid: false, strong: 0, weak: 0, adequate: 0 };
    const strong = chapters.filter((c) => (c.human_score ?? 0) >= 8.5).length;
    const weak = chapters.filter((c) => (c.human_score ?? 0) < 7.5).length;
    const adequate = chapters.filter((c) => {
      const s = c.human_score ?? 0;
      return s >= 7.0 && s < 8.5;
    }).length;
    return { valid: strong >= 1 && weak >= 1 && adequate >= 1, strong, weak, adequate };
  }, [chapters, allRated]);

  const calibration = useMemo(() => {
    if (!allRated || !ratingDistribution.valid) return [];
    return calculateCalibration(chapters, weights);
  }, [chapters, allRated, weights, ratingDistribution.valid]);

  const hasTunableBias = calibration.some((c) => c.chapters_divergent >= 3);

  const handleScoreChange = (index: number, score: number) => {
    setChapters((prev) =>
      prev.map((c, i) => (i === index ? { ...c, human_score: score } : c)),
    );
    setAccepted(false);
  };

  const handleAcceptAdjustments = () => {
    const newWeights = { ...weights };
    calibration.forEach((c) => {
      if (c.chapters_divergent >= 3) {
        newWeights[c.module] = c.suggested_weight;
      }
    });
    // Normalize weights to sum to 1.0
    const sum = Object.values(newWeights).reduce((s, v) => s + v, 0);
    Object.keys(newWeights).forEach((k) => {
      newWeights[k] = Math.round((newWeights[k] / sum) * 100) / 100;
    });
    setWeights(newWeights);
    localStorage.setItem("ghostly_quality_weights", JSON.stringify(newWeights));
    // Log calibration
    const log = {
      calibrated_at: new Date().toISOString(),
      chapters_rated: chapters.map((c) => ({ ch: c.chapter_number, pipeline: c.composite_score, human: c.human_score })),
      adjustments: calibration.filter((c) => c.chapters_divergent >= 3).map((c) => ({
        module: c.module, from: c.current_weight, to: c.suggested_weight, direction: c.direction,
      })),
    };
    const existing = JSON.parse(localStorage.getItem("ghostly_calibration_log") ?? "[]");
    existing.push(log);
    localStorage.setItem("ghostly_calibration_log", JSON.stringify(existing));
    setAccepted(true);
  };

  // ── No data state ─────────────────────────────────────────────────────

  if (!hasEnoughChapters) {
    return (
      <div className="space-y-4 max-w-4xl">
        <h1 className="text-xl font-semibold tracking-wide">Module Weight Calibration</h1>
        <div className="border border-border bg-card p-6">
          <p className="text-sm font-mono text-muted-foreground">
            Calibration requires at least 5 approved chapters from Book 1.
          </p>
          <p className="text-sm font-mono text-muted-foreground mt-2">
            Current: {chapters.length} approved chapter{chapters.length !== 1 ? "s" : ""}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-xl font-semibold tracking-wide">Module Weight Calibration</h1>

      {/* Chapter rating cards */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Rate Chapters 1–5
        </h2>
        {chapters.map((ch, i) => (
          <div key={ch.chapter_number} className="border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-sm font-mono text-foreground">Chapter {ch.chapter_number}</span>
                <span className="text-xs font-mono text-muted-foreground ml-4">
                  Pipeline: {ch.composite_score.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-muted-foreground uppercase">
                  Your Score
                </span>
                <span className="text-sm font-mono text-foreground w-8 text-right">
                  {ch.human_score !== null ? ch.human_score.toFixed(1) : "—"}
                </span>
              </div>
            </div>

            {/* Per-module scores */}
            <div className="grid grid-cols-6 gap-2 mb-3">
              {Object.entries(ch.module_scores).map(([mod, score]) => (
                <div key={mod} className="text-center">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase truncate" title={MODULE_LABELS[mod] ?? mod}>
                    {(MODULE_LABELS[mod] ?? mod).slice(0, 8)}
                  </p>
                  <p className="text-xs font-mono text-foreground">{(score as number).toFixed(1)}</p>
                </div>
              ))}
            </div>

            {/* Slider */}
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={ch.human_score ?? 5}
              onChange={(e) => handleScoreChange(i, parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[9px] font-mono text-muted-foreground mt-1">
              <span>1.0</span>
              <span>5.0</span>
              <span>10.0</span>
            </div>
          </div>
        ))}
      </div>

      {/* Rating distribution check */}
      {allRated && !ratingDistribution.valid && (
        <div className="border border-warning/30 bg-warning/5 p-3">
          <p className="text-xs font-mono text-warning">
            Calibration requires at least: 1 strong (≥8.5), 1 weak (&lt;7.5), and 1 adequate (7.0–8.0).
          </p>
          <p className="text-[10px] font-mono text-muted-foreground mt-1">
            Current: {ratingDistribution.strong} strong · {ratingDistribution.weak} weak · {ratingDistribution.adequate} adequate
          </p>
        </div>
      )}

      {/* Calibration results */}
      {calibration.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Calibration Results
          </h2>

          {calibration.map((c) => {
            const needsAdjustment = c.chapters_divergent >= 3;
            return (
              <div
                key={c.module}
                className={`border p-3 ${needsAdjustment ? "border-warning/50 bg-warning/5" : "border-border bg-card"}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-mono text-foreground">{MODULE_LABELS[c.module] ?? c.module}</span>
                    <span className={`text-[10px] font-mono ml-3 ${
                      c.direction === "optimistic" ? "text-warning" : c.direction === "pessimistic" ? "text-destructive" : "text-success"
                    }`}>
                      {c.direction === "optimistic" ? `systematically optimistic (+${c.avg_divergence})` :
                       c.direction === "pessimistic" ? `systematically pessimistic (${c.avg_divergence})` :
                       "aligned"}
                    </span>
                  </div>
                  <div className="text-right">
                    {needsAdjustment ? (
                      <span className="text-[10px] font-mono text-warning">
                        {c.current_weight.toFixed(2)} → {c.suggested_weight.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        Weight: {c.current_weight.toFixed(2)} — no change needed
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground mt-1">
                  Divergent on {c.chapters_divergent}/5 chapters (threshold: 3)
                </p>
              </div>
            );
          })}

          {/* Action buttons */}
          <div className="flex items-center gap-4 pt-2">
            {hasTunableBias && !accepted && (
              <button
                onClick={handleAcceptAdjustments}
                className="px-4 py-2 bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider hover:bg-primary/80 transition-colors"
              >
                Accept Suggested Adjustments
              </button>
            )}
            {!accepted && (
              <button
                onClick={() => setAccepted(true)}
                className="px-4 py-2 border border-border text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                Keep Current Weights
              </button>
            )}
            {accepted && (
              <span className="text-xs font-mono text-success">
                ✓ Calibration complete. Weight changes affect future chapters only.
              </span>
            )}
          </div>

          <p className="text-[10px] font-mono text-muted-foreground">
            Weight changes affect scoring of future chapters only. No approved chapter is retroactively affected.
          </p>
        </div>
      )}
    </div>
  );
}
