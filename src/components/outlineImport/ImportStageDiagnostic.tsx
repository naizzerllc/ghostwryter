/**
 * Stage 3 — Diagnostic Report: grouped issues, breadcrumb report, extracted characters.
 */
import { useState } from "react";
import { AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import type { OutlineImportResult, ValidationIssue, IssueCategory } from "@/lib/outlineImporter";

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  SCHEMA: "Schema",
  MISDIRECTION: "Misdirection Map",
  NARRATOR: "Narrator",
  HOOK: "Hook",
  STRUCTURAL: "Structural",
  BREADCRUMB: "Breadcrumb Integrity",
};

const CATEGORY_ORDER: IssueCategory[] = ["SCHEMA", "MISDIRECTION", "NARRATOR", "HOOK", "STRUCTURAL", "BREADCRUMB"];

function groupByCategory(issues: ValidationIssue[]): Record<IssueCategory, ValidationIssue[]> {
  const groups: Record<IssueCategory, ValidationIssue[]> = {
    SCHEMA: [], MISDIRECTION: [], NARRATOR: [], HOOK: [], STRUCTURAL: [], BREADCRUMB: [],
  };
  for (const issue of issues) groups[issue.category].push(issue);
  return groups;
}

interface Props {
  result: OutlineImportResult;
  onProceed: () => void;
  onRetry: () => void;
}

const ImportStageDiagnostic = ({ result, onProceed, onRetry }: Props) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<IssueCategory>>(new Set(CATEGORY_ORDER));
  const grouped = groupByCategory(result.diagnostic_report.issues);

  const toggleCategory = (cat: IssueCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  return (
    <div className="border border-border bg-card space-y-0">
      {/* Report Header */}
      <div className={`px-4 py-3 border-b border-border flex items-center gap-3 ${result.success ? "bg-success/10" : "bg-destructive/10"}`}>
        {result.success ? <CheckCircle className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            {result.success ? "VALIDATION PASSED" : "VALIDATION FAILED"}
          </p>
          <p className="text-[10px] font-mono text-muted-foreground">
            Schema {result.diagnostic_report.schema_version_found ?? "unknown"} ·{" "}
            {result.diagnostic_report.errors_count} errors · {result.diagnostic_report.warnings_count} warnings
            {result.chapters && ` · ${result.chapters.length} chapters`}
            {result.characters_extracted && ` · ${result.characters_extracted.length} characters`}
          </p>
        </div>
        <div className="flex gap-2">
          {!result.success && (
            <button onClick={onRetry} className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-muted text-foreground hover:bg-muted/80">
              BACK TO EDIT
            </button>
          )}
          {result.success && (
            <button onClick={onProceed} className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-success text-success-foreground hover:bg-success/90">
              PROCEED TO IMPORT
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb Report */}
      {result.diagnostic_report.breadcrumb_report && (
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2">
            Breadcrumb Integrity
          </p>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-foreground">
              Score: {result.diagnostic_report.breadcrumb_report.integrity_score}/100
            </span>
            <span className="text-muted-foreground">
              Total: {result.diagnostic_report.breadcrumb_report.total_breadcrumbs}
            </span>
            <span className={result.diagnostic_report.breadcrumb_report.phantom_harvests.length > 0 ? "text-destructive" : "text-success"}>
              Phantoms: {result.diagnostic_report.breadcrumb_report.phantom_harvests.length}
            </span>
            <span className={result.diagnostic_report.breadcrumb_report.orphan_plants.length > 0 ? "text-warning" : "text-success"}>
              Orphans: {result.diagnostic_report.breadcrumb_report.orphan_plants.length}
            </span>
            {result.diagnostic_report.breadcrumb_report.blocks_import && (
              <span className="text-destructive font-semibold">BLOCKS IMPORT</span>
            )}
          </div>
        </div>
      )}

      {/* Issues grouped by category */}
      {CATEGORY_ORDER.map(cat => {
        const items = grouped[cat];
        if (items.length === 0) return null;
        const expanded = expandedCategories.has(cat);
        const errorCount = items.filter(i => i.severity === "ERROR").length;
        const warnCount = items.filter(i => i.severity === "WARNING").length;

        return (
          <div key={cat} className="border-b border-border last:border-b-0">
            <button
              onClick={() => toggleCategory(cat)}
              className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-muted/30 transition-colors"
            >
              {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              <span className="text-xs font-mono font-semibold text-foreground uppercase tracking-wider">
                {CATEGORY_LABELS[cat]}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                {errorCount > 0 && <span className="text-destructive mr-2">{errorCount} ERR</span>}
                {warnCount > 0 && <span className="text-warning">{warnCount} WARN</span>}
              </span>
            </button>
            {expanded && (
              <div className="px-4 pb-3 space-y-1.5">
                {items.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 px-3 py-2 text-xs font-mono ${
                      issue.severity === "ERROR" ? "bg-destructive/5 border-l-2 border-destructive" : "bg-warning/5 border-l-2 border-warning"
                    }`}
                  >
                    {issue.severity === "ERROR" ? (
                      <XCircle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-warning shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-foreground">{issue.description}</p>
                      <p className="text-muted-foreground text-[10px] mt-0.5">{issue.field}</p>
                      {issue.suggestedFix && (
                        <p className="text-muted-foreground text-[10px] mt-0.5 italic">Fix: {issue.suggestedFix}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Extracted characters preview */}
      {result.characters_extracted && result.characters_extracted.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2">
            Characters Extracted
          </p>
          <div className="flex flex-wrap gap-2">
            {result.characters_extracted.map(c => (
              <span key={c.id} className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono bg-muted text-foreground">
                <span className={`w-1.5 h-1.5 ${
                  c.role === "protagonist" ? "bg-primary" : c.role === "antagonist" ? "bg-destructive" : "bg-secondary"
                }`} />
                {c.name}
                <span className="text-muted-foreground uppercase">{c.role.slice(0, 4)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportStageDiagnostic;
