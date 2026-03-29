/**
 * Story Bible Import Panel — Dashboard diagnostic UI.
 * GHOSTLY v2.2 · Prompt 02 MSG-3
 */

import { useSyncExternalStore, useRef, useState } from "react";
import {
  importStoryBible,
  getStoryBibleSnapshot,
  subscribeStoryBible,
} from "@/modules/storyBibleImporter/storyBibleImporter";
import type { ImportDiagnostic, DiagnosticEntry } from "@/modules/storyBibleImporter/types";

const severityColor: Record<string, string> = {
  error: "text-destructive",
  warning: "text-warning",
  info: "text-muted-foreground",
};

const severityLabel: Record<string, string> = {
  error: "ERR",
  warning: "WRN",
  info: "INF",
};

function DiagEntry({ entry }: { entry: DiagnosticEntry }) {
  return (
    <div className="flex gap-2 text-xs font-mono">
      <span className={`${severityColor[entry.severity]} shrink-0 w-8`}>
        {severityLabel[entry.severity]}
      </span>
      <span className="text-muted-foreground shrink-0">{entry.path}</span>
      <span className="text-foreground">{entry.message}</span>
    </div>
  );
}

const StoryBibleImportPanel = () => {
  const snapshot = useSyncExternalStore(subscribeStoryBible, getStoryBibleSnapshot);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const text = await file.text();
    const format = file.name.endsWith(".md") ? "md" : "json";
    importStoryBible(text, format);
    setImporting(false);
    // Reset so same file can be re-imported
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const diag: ImportDiagnostic | null = snapshot.lastDiagnostic;

  return (
    <div className="space-y-3">
      {/* Import button */}
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.md"
          onChange={handleFile}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider border border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors disabled:opacity-50"
        >
          {importing ? "Importing…" : "Import Story Bible"}
        </button>
        <span className="text-[10px] font-mono text-muted-foreground">
          JSON or MD with YAML front-matter
        </span>
      </div>

      {/* No diagnostic yet */}
      {!diag && (
        <p className="text-xs text-muted-foreground font-mono">No import performed yet</p>
      )}

      {/* Diagnostic results */}
      {diag && (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className={diag.valid ? "text-success" : "text-destructive"}>
              {diag.valid ? "✓ VALID" : "✗ INVALID"}
            </span>
            <span className="text-muted-foreground">
              {diag.errors.length}E · {diag.warnings.length}W · {diag.info.length}I
            </span>
          </div>

          {/* Created objects summary */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Config</p>
              <p className={`text-sm font-mono ${diag.project_config_created ? "text-success" : "text-destructive"}`}>
                {diag.project_config_created ? "CREATED" : "FAILED"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Chapters</p>
              <p className="text-sm font-mono">{diag.chapters_parsed}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Catalogue</p>
              <p className={`text-sm font-mono ${diag.catalogue_entry_parsed ? "text-success" : "text-muted-foreground"}`}>
                {diag.catalogue_entry_parsed ? "PARSED" : "—"}
              </p>
            </div>
          </div>

          {/* Diagnostic entries */}
          {diag.errors.length > 0 && (
            <div className="space-y-1 border-t border-border pt-2">
              {diag.errors.map((e, i) => <DiagEntry key={`e-${i}`} entry={e} />)}
            </div>
          )}
          {diag.warnings.length > 0 && (
            <div className="space-y-1 border-t border-border pt-2">
              {diag.warnings.map((e, i) => <DiagEntry key={`w-${i}`} entry={e} />)}
            </div>
          )}
          {diag.info.length > 0 && (
            <div className="space-y-1 border-t border-border pt-2">
              {diag.info.map((e, i) => <DiagEntry key={`i-${i}`} entry={e} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StoryBibleImportPanel;
