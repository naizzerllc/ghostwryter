/**
 * Outline Import Page — paste JSON, validate v2.8, view diagnostic report.
 * GHOSTLY v2.2 · S08
 */

import { useState, useCallback } from "react";
import {
  importOutline,
  saveImportedOutline,
  type OutlineImportResult,
  type ValidationIssue,
  type IssueCategory,
} from "@/lib/outlineImporter";
import { AlertTriangle, CheckCircle, XCircle, FileText, ChevronDown, ChevronRight } from "lucide-react";

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
  for (const issue of issues) {
    groups[issue.category].push(issue);
  }
  return groups;
}

const OutlineImport = () => {
  const [jsonInput, setJsonInput] = useState("");
  const [projectId] = useState(() => `proj_${Date.now()}`);
  const [result, setResult] = useState<OutlineImportResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<IssueCategory>>(new Set(CATEGORY_ORDER));

  const handleImport = useCallback(() => {
    const r = importOutline(jsonInput, projectId);
    setResult(r);
    setSaved(false);
  }, [jsonInput, projectId]);

  const handleSave = useCallback(async () => {
    if (!result?.success || !result.chapters) return;
    setSaving(true);
    try {
      await saveImportedOutline(projectId, result.chapters, jsonInput);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }, [result, projectId, jsonInput]);

  const toggleCategory = (cat: IssueCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const grouped = result ? groupByCategory(result.diagnostic_report.issues) : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-wide">OUTLINE IMPORT</h1>
        <p className="text-xs text-muted-foreground font-mono mt-1">
          Paste V6 outline JSON · Schema v2.8 required · Validates MIC v2.1 chapter_outline_record
        </p>
      </div>

      {/* Input */}
      <div className="border border-border bg-card p-4 space-y-3">
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
          Outline JSON
        </label>
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder='{"schema_version": "2.8", "project_config": {...}, "chapters": [...], "misdirection_map": {...}}'
          className="w-full h-64 bg-background border border-border p-3 text-sm font-mono text-foreground resize-none focus:outline-none focus:border-primary"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleImport}
            disabled={jsonInput.trim().length < 10}
            className="px-4 py-2 text-xs font-mono uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Import Outline
          </button>
          <span className="text-[10px] font-mono text-muted-foreground">
            {jsonInput.length} chars
          </span>
        </div>
      </div>

      {/* Diagnostic Report */}
      {result && (
        <div className="border border-border bg-card space-y-0">
          {/* Report Header */}
          <div className={`px-4 py-3 border-b border-border flex items-center gap-3 ${result.success ? "bg-success/10" : "bg-destructive/10"}`}>
            {result.success ? (
              <CheckCircle className="w-4 h-4 text-success" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive" />
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {result.success ? "IMPORT VALID" : "IMPORT BLOCKED"}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground">
                Schema {result.diagnostic_report.schema_version_found ?? "unknown"} ·{" "}
                {result.diagnostic_report.errors_count} errors · {result.diagnostic_report.warnings_count} warnings
                {result.chapters && ` · ${result.chapters.length} chapters validated`}
                {result.characters_extracted && ` · ${result.characters_extracted.length} characters extracted`}
              </p>
            </div>
            {result.success && (
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-success text-success-foreground hover:bg-success/90 disabled:opacity-40"
              >
                {saved ? "SAVED" : saving ? "SAVING..." : "SAVE TO GITHUB"}
              </button>
            )}
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
          {grouped && CATEGORY_ORDER.map(cat => {
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
      )}

      {/* Empty state */}
      {!result && (
        <div className="border border-border bg-card p-8 flex flex-col items-center gap-3 text-center">
          <FileText className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Paste your V6 outline JSON and click Import</p>
          <p className="text-[10px] font-mono text-muted-foreground">
            Validates schema v2.8 · chapter_outline_record · misdirection_map · breadcrumb integrity
          </p>
        </div>
      )}
    </div>
  );
};

export default OutlineImport;
