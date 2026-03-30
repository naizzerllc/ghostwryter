/**
 * First Chapter Calibration Gate — fires once after Chapter 1 approval.
 * GHOSTLY v2.2 · Session 18
 *
 * Three questions + divergence detection (pipeline ≥ 8.5 AND human ≤ 7.0).
 * Stores calibration_note in project_config_record.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";

// ── Types ───────────────────────────────────────────────────────────────

type QualityAnswer = "YES" | "ADEQUATE" | "SIGNIFICANT_ISSUES";
type InaccurateModule = "reader_simulation" | "developmental_editor" | "line_editor" | "anti_ai_detector" | "all_accurate";

export interface CalibrationResult {
  meets_standard: QualityAnswer;
  inaccurate_module: InaccurateModule | null;
  human_score: number;
  reader_sim_optimism_offset: number | null;
  calibration_note: string;
  calibrated_at: string;
}

interface CalibrationGateProps {
  pipelineScore: number | null;
  onCalibrationComplete: (result: CalibrationResult) => void;
  onDismiss: () => void;
}

// ── Component ───────────────────────────────────────────────────────────

export default function CalibrationGate({
  pipelineScore,
  onCalibrationComplete,
  onDismiss,
}: CalibrationGateProps) {
  const [step, setStep] = useState(1);
  const [meetsStandard, setMeetsStandard] = useState<QualityAnswer | null>(null);
  const [inaccurateModule, setInaccurateModule] = useState<InaccurateModule | null>(null);
  const [humanScore, setHumanScore] = useState(7);

  function handleComplete() {
    // Divergence detection: pipeline ≥ 8.5 AND human ≤ 7.0
    let optimismOffset: number | null = null;
    if (pipelineScore !== null && pipelineScore >= 8.5 && humanScore <= 7.0) {
      optimismOffset = -0.8;
    }

    const noteLines = [
      `Calibration: Chapter 1`,
      `Meets standard: ${meetsStandard}`,
      inaccurateModule && inaccurateModule !== "all_accurate"
        ? `Inaccurate module: ${inaccurateModule}`
        : null,
      `Human score: ${humanScore}/10`,
      `Pipeline score: ${pipelineScore?.toFixed(1) ?? "N/A"}`,
      optimismOffset !== null
        ? `reader_sim_optimism_offset: ${optimismOffset} (suggested)`
        : null,
    ].filter(Boolean).join("\n");

    const result: CalibrationResult = {
      meets_standard: meetsStandard!,
      inaccurate_module: inaccurateModule,
      human_score: humanScore,
      reader_sim_optimism_offset: optimismOffset,
      calibration_note: noteLines,
      calibrated_at: new Date().toISOString(),
    };

    onCalibrationComplete(result);
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="border border-border bg-card p-6 max-w-lg w-full space-y-4 shadow-lg">
        <h2 className="text-lg font-mono font-bold text-foreground">
          First Chapter Calibration Gate
        </h2>
        <p className="text-sm text-muted-foreground">
          Before generating Chapter 2, review Chapter 1 against the quality standard.
        </p>

        <Separator />

        {/* Question 1 */}
        {step >= 1 && (
          <div className="space-y-2">
            <p className="text-sm font-mono text-foreground">
              1. Does this chapter meet bestseller psychological thriller standard?
            </p>
            <div className="flex gap-2">
              {([
                ["YES", "Yes"],
                ["ADEQUATE", "Adequate but not exceptional"],
                ["SIGNIFICANT_ISSUES", "Significant quality issues"],
              ] as [QualityAnswer, string][]).map(([val, label]) => (
                <Button
                  key={val}
                  variant={meetsStandard === val ? "default" : "outline"}
                  size="sm"
                  className="font-mono text-xs"
                  onClick={() => { setMeetsStandard(val); setStep(Math.max(step, 2)); }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Question 2 */}
        {step >= 2 && meetsStandard !== "YES" && (
          <div className="space-y-2">
            <p className="text-sm font-mono text-foreground">
              2. Which module's score feels most inaccurate?
            </p>
            <div className="flex flex-wrap gap-2">
              {([
                ["reader_simulation", "Reader Simulation"],
                ["developmental_editor", "Developmental Editor"],
                ["line_editor", "Line Editor"],
                ["anti_ai_detector", "Anti-AI Detector"],
                ["all_accurate", "All feel accurate"],
              ] as [InaccurateModule, string][]).map(([val, label]) => (
                <Button
                  key={val}
                  variant={inaccurateModule === val ? "default" : "outline"}
                  size="sm"
                  className="font-mono text-xs"
                  onClick={() => { setInaccurateModule(val); setStep(Math.max(step, 3)); }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Question 3 */}
        {(step >= 3 || (step >= 2 && meetsStandard === "YES")) && (
          <div className="space-y-3">
            <p className="text-sm font-mono text-foreground">
              3. Rate your editorial assessment of Chapter 1:
            </p>
            <div className="flex items-center gap-4">
              <Slider
                value={[humanScore]}
                onValueChange={([v]) => setHumanScore(v)}
                min={1}
                max={10}
                step={1}
                className="flex-1"
              />
              <span className="font-mono text-lg text-foreground w-8 text-center">
                {humanScore}
              </span>
            </div>

            {/* Divergence warning */}
            {pipelineScore !== null && pipelineScore >= 8.5 && humanScore <= 7.0 && (
              <div className="border border-warning bg-warning/10 p-2">
                <p className="text-xs font-mono text-warning">
                  ⚠ Pipeline optimism detected. Suggested reader_sim_optimism_offset: -0.8
                </p>
              </div>
            )}
          </div>
        )}

        <Separator />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onDismiss} className="font-mono text-xs">
            DISMISS
          </Button>
          <Button
            size="sm"
            onClick={handleComplete}
            disabled={!meetsStandard}
            className="font-mono text-xs"
          >
            COMPLETE CALIBRATION
          </Button>
        </div>
      </div>
    </div>
  );
}
