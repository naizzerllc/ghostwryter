/**
 * Stage 2 — Validating: animated progress while parsing runs.
 */
import { Loader2 } from "lucide-react";

const ImportStageValidating = () => (
  <div className="border border-border bg-card p-12 flex flex-col items-center gap-4 text-center">
    <Loader2 className="w-8 h-8 text-primary animate-spin" />
    <p className="text-sm font-semibold text-foreground">VALIDATING OUTLINE</p>
    <p className="text-[10px] font-mono text-muted-foreground">
      Schema v2.8 · chapter records · misdirection map · breadcrumb integrity
    </p>
  </div>
);

export default ImportStageValidating;
