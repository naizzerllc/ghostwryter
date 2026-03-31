import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { checkModelDrift, recordAnthropicModel, type DriftResult, type DriftSeverity } from "@/api/llmRouter";

const ModelDriftBanner = () => {
  const [drift, setDrift] = useState<DriftResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const result = checkModelDrift();
    if (result.severity !== "none") {
      setDrift(result);
    }
  }, []);

  if (!drift || drift.severity === "none" || dismissed) return null;

  const isMajor = drift.severity === "major";

  const handleAcknowledge = () => {
    // Record current model as accepted baseline
    recordAnthropicModel();
    setDismissed(true);
  };

  return (
    <div
      className={`border-b px-4 py-2.5 flex items-center gap-3 shrink-0 ${
        isMajor
          ? "bg-destructive/20 border-destructive/50"
          : "bg-warning/20 border-warning/50"
      }`}
    >
      <AlertTriangle
        className={`w-4 h-4 shrink-0 ${
          isMajor ? "text-destructive" : "text-warning"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-mono font-semibold uppercase tracking-wider ${
            isMajor ? "text-destructive" : "text-warning"
          }`}
        >
          {isMajor ? "DRIFT_CRITICAL" : "DRIFT_WARNING"} — Anthropic Model Changed
        </p>
        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
          Previous: <span className="text-foreground">{drift.previousModel}</span>
          {" → "}
          Current: <span className="text-foreground">{drift.currentModel}</span>
          {isMajor && (
            <span className="text-destructive ml-2">
              Major version change — voice benchmark re-check mandatory
            </span>
          )}
        </p>
      </div>

      {isMajor ? (
        <button
          onClick={handleAcknowledge}
          className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border border-destructive text-destructive hover:bg-destructive/10 transition-colors whitespace-nowrap"
        >
          Re-check Complete — Accept
        </button>
      ) : (
        <button
          onClick={handleAcknowledge}
          className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border border-warning text-warning hover:bg-warning/10 transition-colors whitespace-nowrap"
        >
          Acknowledge
        </button>
      )}

      {!isMajor && (
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Dismiss without updating baseline"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default ModelDriftBanner;
