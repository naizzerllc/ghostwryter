/**
 * StartupValidatorPanel — Displays 25-item startup validation results.
 * GHOSTLY v2.2 · Session 5 · MSG-4
 */

import { useState, useCallback } from "react";
import { runStartupValidation, type ValidationResult, type CheckStatus } from "@/utils/startupValidator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const statusIcon = (s: CheckStatus) =>
  s === "PASS" ? "✓" : s === "WARN" ? "⚠" : "✗";

const statusColor = (s: CheckStatus) =>
  s === "PASS" ? "text-success" : s === "WARN" ? "text-warning" : "text-destructive";

const StartupValidatorPanel = () => {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = useCallback(() => {
    setRunning(true);
    // Small delay for visual feedback
    setTimeout(() => {
      setResult(runStartupValidation());
      setRunning(false);
    }, 150);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={handleRun}
          disabled={running}
          className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider border border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors disabled:opacity-50"
        >
          {running ? "Running…" : "Run Validation"}
        </button>
        {result && (
          <span className="text-[10px] font-mono text-muted-foreground">
            {new Date(result.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>

      {result && (
        <>
          {/* Summary counters */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Passed</p>
              <p className="text-sm font-mono text-success">{result.passed}/{result.total}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Warnings</p>
              <p className="text-sm font-mono text-warning">{result.warned}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Failed</p>
              <p className="text-sm font-mono text-destructive">{result.failed}</p>
            </div>
          </div>

          {/* Failed/warned items inline */}
          {result.checks
            .filter((c) => c.status !== "PASS")
            .map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-[10px] font-mono">
                <span className={statusColor(c.status)}>{statusIcon(c.status)}</span>
                <span className="text-foreground">{c.label}</span>
                <span className="text-muted-foreground ml-auto">{c.detail}</span>
              </div>
            ))}

          {/* Full report dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <button className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider border border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors">
                Full Report
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-mono text-sm uppercase tracking-widest">
                  Startup Validation — {result.passed}/{result.total} Passed
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-1">
                {result.checks.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-3 py-1 border-b border-border/30 last:border-0"
                  >
                    <span className={`font-mono text-xs ${statusColor(c.status)}`}>
                      {statusIcon(c.status)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-mono text-foreground">{c.label}</span>
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                          {c.category}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground">{c.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default StartupValidatorPanel;
