/**
 * Outline Import Diagnostic Panel — displays batch validation + breadcrumb integrity.
 * GHOSTLY v2.2 · Prompt 02 MSG-5
 */

import { useSyncExternalStore } from "react";
import {
  getOutlineDiagnosticSnapshot,
  subscribeOutlineDiagnostic,
} from "@/modules/outlineImportDiagnostic/outlineImportDiagnostic";
import type { BreadcrumbStatus } from "@/modules/outlineImportDiagnostic/outlineImportDiagnostic";

const statusColor: Record<BreadcrumbStatus, string> = {
  INTACT: "text-success",
  DEGRADED: "text-warning",
  BROKEN: "text-destructive",
};

const OutlineDiagnosticPanel = () => {
  const snap = useSyncExternalStore(subscribeOutlineDiagnostic, getOutlineDiagnosticSnapshot);
  const result = snap.lastResult;

  if (!result) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-mono">No outline batch validated yet.</p>
        <p className="text-[10px] text-muted-foreground">
          Use <code className="text-foreground">__ghostly_outlineDiagnostic.validateOutlineBatch(chapters, genreMode, revelationChapter)</code>
        </p>
      </div>
    );
  }

  const bi = result.breadcrumb_integrity;

  return (
    <div className="space-y-3">
      {/* Batch summary */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total</p>
          <p className="text-sm font-mono">{result.total}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Valid</p>
          <p className="text-sm font-mono text-success">{result.valid}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Invalid</p>
          <p className={`text-sm font-mono ${result.invalid > 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {result.invalid}
          </p>
        </div>
      </div>

      {/* Breadcrumb integrity */}
      <div className="border-t border-border pt-3">
        <div className="flex justify-between items-baseline mb-2">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Breadcrumb Integrity</h3>
          <span className={`text-xs font-mono font-semibold ${statusColor[bi.status]}`}>{bi.status}</span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Timelines</p>
            <p className="text-xs font-mono">{bi.timeline_ids.join(", ") || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Duplicates</p>
            <p className={`text-xs font-mono ${bi.duplicate_chapters.length > 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {bi.duplicate_chapters.length > 0 ? bi.duplicate_chapters.join(", ") : "None"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Gaps</p>
            <p className={`text-xs font-mono ${bi.gap_chapters.length > 0 ? "text-warning" : "text-muted-foreground"}`}>
              {bi.gap_chapters.length > 0 ? bi.gap_chapters.join(", ") : "None"}
            </p>
          </div>
        </div>

        {/* Hook distribution */}
        <div className="mb-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Hook Distribution</p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(bi.hook_distribution).map(([type, count]) => (
              <span key={type} className="text-[10px] font-mono text-muted-foreground">
                {type}: <span className="text-foreground">{count}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Issues */}
        {bi.issues.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Issues ({bi.issues.length})</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {bi.issues.map((issue, i) => (
                <p key={i} className={`text-[10px] font-mono ${issue.severity === "error" ? "text-destructive" : "text-warning"}`}>
                  {issue.chapter > 0 ? `Ch ${issue.chapter}` : "Global"} · {issue.message}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Per-chapter errors (collapsed) */}
      {result.entries.some(e => !e.valid) && (
        <div className="border-t border-border pt-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Chapter Errors</p>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {result.entries.filter(e => !e.valid).map((e, i) => (
              <p key={i} className="text-[10px] font-mono text-destructive">
                Ch {e.chapter_number}: {e.errors.join(" · ")}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OutlineDiagnosticPanel;
