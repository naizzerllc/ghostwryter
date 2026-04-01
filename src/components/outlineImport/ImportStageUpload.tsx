/**
 * Stage 1 — Upload: paste JSON, trigger import.
 */
import { FileText } from "lucide-react";

interface Props {
  jsonInput: string;
  onJsonChange: (v: string) => void;
  onImport: () => void;
}

const ImportStageUpload = ({ jsonInput, onJsonChange, onImport }: Props) => (
  <div className="space-y-6">
    <div className="border border-border bg-card p-4 space-y-3">
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
        Outline JSON
      </label>
      <textarea
        value={jsonInput}
        onChange={(e) => onJsonChange(e.target.value)}
        placeholder='{"schema_version": "2.8", "project_config": {...}, "chapters": [...], "misdirection_map": {...}}'
        className="w-full h-64 bg-background border border-border p-3 text-sm font-mono text-foreground resize-none focus:outline-none focus:border-primary"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={onImport}
          disabled={jsonInput.trim().length < 10}
          className="px-4 py-2 text-xs font-mono uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Validate &amp; Import
        </button>
        <span className="text-[10px] font-mono text-muted-foreground">
          {jsonInput.length} chars
        </span>
      </div>
    </div>

    <div className="border border-border bg-card p-8 flex flex-col items-center gap-3 text-center">
      <FileText className="w-8 h-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Paste your V6 outline JSON and click Validate</p>
      <p className="text-[10px] font-mono text-muted-foreground">
        Validates schema v2.8 · chapter_outline_record · misdirection_map · breadcrumb integrity
      </p>
    </div>
  </div>
);

export default ImportStageUpload;
