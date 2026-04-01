/**
 * Import Stepper — visual step indicator for the 4-stage wizard.
 */
import type { ImportStage } from "@/pages/OutlineImport";

const STEPS: { stage: ImportStage; label: string }[] = [
  { stage: "upload", label: "Upload" },
  { stage: "validating", label: "Validating" },
  { stage: "diagnostic", label: "Diagnostic Report" },
  { stage: "complete", label: "Complete" },
];

interface Props {
  currentStage: ImportStage;
}

const stageIndex = (s: ImportStage) => STEPS.findIndex(st => st.stage === s);

const ImportStepper = ({ currentStage }: Props) => {
  const current = stageIndex(currentStage);

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const isActive = i === current;
        const isDone = i < current;
        return (
          <div key={step.stage} className="flex items-center">
            {i > 0 && (
              <div className={`w-8 h-px ${isDone ? "bg-success" : "bg-border"}`} />
            )}
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 flex items-center justify-center text-[10px] font-mono font-bold border ${
                isDone ? "bg-success border-success text-success-foreground" :
                isActive ? "bg-primary border-primary text-primary-foreground" :
                "bg-background border-border text-muted-foreground"
              }`}>
                {isDone ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] font-mono uppercase tracking-wider ${
                isActive ? "text-foreground font-semibold" : isDone ? "text-success" : "text-muted-foreground"
              }`}>
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ImportStepper;
