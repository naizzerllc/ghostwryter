import { useState, useEffect, useCallback } from "react";
import {
  getArchiveSummary,
  getVersionHistory,
  pinVersion,
  revertToVersion,
  compareVersions,
  getPinnedVersion,
  type ChapterArchiveSummary,
  type VersionMeta,
  type VersionDiff,
  type PinnedVersion,
} from "@/modules/archive/chapterArchive";
import { preflightCheck, exportManuscript, getExportHistory, type ExportFormat, type ExportLogEntry } from "@/modules/export/exportPipeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Pin, RotateCcw, GitCompare, Download, FileText, AlertTriangle, Check } from "lucide-react";

const PROJECT_ID = "default";

// ── Chapter List ────────────────────────────────────────────────────────

function ChapterList({
  chapters,
  selectedChapter,
  onSelect,
}: {
  chapters: ChapterArchiveSummary[];
  selectedChapter: number | null;
  onSelect: (ch: number) => void;
}) {
  if (chapters.length === 0) {
    return (
      <div className="border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground text-sm font-mono">No archived chapters yet</p>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card">
      <div className="px-4 py-2 border-b border-border">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Chapters</h2>
      </div>
      <div className="divide-y divide-border">
        {chapters.map((ch) => (
          <button
            key={ch.chapter_number}
            onClick={() => onSelect(ch.chapter_number)}
            className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${
              selectedChapter === ch.chapter_number
                ? "bg-accent/20 text-foreground"
                : "text-muted-foreground hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm">CH {String(ch.chapter_number).padStart(2, "0")}</span>
              {ch.has_pinned && <Pin className="w-3 h-3 text-primary" />}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono">
                {ch.version_count}v
              </Badge>
              {ch.quality_score !== null && (
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono ${
                    ch.quality_score >= 8.0
                      ? "text-green-500 border-green-500/30"
                      : ch.quality_score >= 7.0
                        ? "text-yellow-500 border-yellow-500/30"
                        : "text-red-500 border-red-500/30"
                  }`}
                >
                  {ch.quality_score.toFixed(1)}
                </Badge>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Version History ─────────────────────────────────────────────────────

function VersionHistory({
  chapterNumber,
  versions,
  pinnedVersion,
  onPin,
  onRevert,
  onCompare,
}: {
  chapterNumber: number;
  versions: VersionMeta[];
  pinnedVersion: PinnedVersion | null;
  onPin: (vId: number) => void;
  onRevert: (vId: number) => void;
  onCompare: (v1: number, v2: number) => void;
}) {
  const [compareFrom, setCompareFrom] = useState<number | null>(null);

  if (versions.length === 0) {
    return (
      <div className="border border-border bg-card p-6 text-center">
        <p className="text-muted-foreground text-sm font-mono">No versions for Chapter {chapterNumber}</p>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Chapter {chapterNumber} — Versions
        </h2>
        {compareFrom !== null && (
          <span className="text-[10px] text-primary font-mono">Select second version to compare</span>
        )}
      </div>
      <div className="divide-y divide-border">
        {versions
          .slice()
          .sort((a, b) => b.version_id - a.version_id)
          .map((v) => {
            const isPinned = pinnedVersion?.version_id === v.version_id;
            const date = new Date(v.saved_at);
            return (
              <div key={v.version_id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-foreground">v{v.version_id}</span>
                  {isPinned && (
                    <Badge className="bg-primary/20 text-primary text-[10px]">
                      <Pin className="w-3 h-3 mr-1" />
                      PINNED
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground font-mono">
                    {v.word_count.toLocaleString()} words
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {date.toLocaleDateString("en-GB")} {date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onPin(v.version_id)} title="Pin version">
                    <Pin className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (compareFrom === null) {
                        setCompareFrom(v.version_id);
                      } else {
                        onCompare(compareFrom, v.version_id);
                        setCompareFrom(null);
                      }
                    }}
                    title={compareFrom === null ? "Compare from this version" : "Compare to this version"}
                    className={compareFrom === v.version_id ? "text-primary" : ""}
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onRevert(v.version_id)} title="Revert to this version">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ── Diff View ───────────────────────────────────────────────────────────

function DiffView({ diff, onClose }: { diff: VersionDiff; onClose: () => void }) {
  return (
    <div className="border border-border bg-card">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Diff: v{diff.v1_id} → v{diff.v2_id} · +{diff.additions} −{diff.deletions}
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="max-h-[500px] overflow-auto font-mono text-xs">
        {diff.lines.map((line, i) => (
          <div
            key={i}
            className={`px-4 py-0.5 ${
              line.type === "added"
                ? "bg-green-500/10 text-green-400"
                : line.type === "removed"
                  ? "bg-red-500/10 text-red-400"
                  : "text-muted-foreground"
            }`}
          >
            <span className="inline-block w-8 text-right mr-2 opacity-50">
              {line.line_number_old ?? " "}
            </span>
            <span className="inline-block w-8 text-right mr-4 opacity-50">
              {line.line_number_new ?? " "}
            </span>
            <span>
              {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "} {line.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Export Panel ─────────────────────────────────────────────────────────

function ExportPanel() {
  const [format, setFormat] = useState<ExportFormat>("plain_text");
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState<ExportLogEntry[]>([]);

  useEffect(() => {
    getExportHistory(PROJECT_ID).then(setHistory);
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const preflight = await preflightCheck(PROJECT_ID);
      if (!preflight.ready) {
        toast.warning(`${preflight.unsigned_chapters} unsigned, ${preflight.missing_chapters} missing chapters`);
      }
      const result = await exportManuscript(PROJECT_ID, format);
      toast.success(`Exported ${result.filename} (${result.word_count.toLocaleString()} words)`);
      const updated = await getExportHistory(PROJECT_ID);
      setHistory(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="border border-border bg-card">
      <div className="px-4 py-2 border-b border-border">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Export Pipeline</h2>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="plain_text">Plain Text (.txt)</SelectItem>
              <SelectItem value="markdown">Markdown (.md)</SelectItem>
              <SelectItem value="formatted_document">Formatted Document (.md)</SelectItem>
              <SelectItem value="chapter_export">Chapter Export (.json)</SelectItem>
              <SelectItem value="quality_report">Quality Report (.md)</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExport} disabled={exporting} size="sm">
            <Download className="w-4 h-4 mr-1" />
            {exporting ? "Exporting…" : "Export"}
          </Button>
        </div>

        {history.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Export History</p>
            <div className="space-y-1">
              {history
                .slice(-5)
                .reverse()
                .map((e, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                    <FileText className="w-3 h-3" />
                    <span>{e.filename}</span>
                    <span>{new Date(e.exported_at).toLocaleDateString("en-GB")}</span>
                    <span>{e.word_count.toLocaleString()}w</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────

const ArchivePage = () => {
  const [chapters, setChapters] = useState<ChapterArchiveSummary[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [pinnedVer, setPinnedVer] = useState<PinnedVersion | null>(null);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [revertTarget, setRevertTarget] = useState<number | null>(null);
  const [pinTarget, setPinTarget] = useState<number | null>(null);
  const [pinNote, setPinNote] = useState("");

  const refresh = useCallback(async () => {
    const summaries = await getArchiveSummary(PROJECT_ID);
    setChapters(summaries);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectChapter = useCallback(async (ch: number) => {
    setSelectedChapter(ch);
    setDiff(null);
    const [v, p] = await Promise.all([
      getVersionHistory(ch, PROJECT_ID),
      getPinnedVersion(ch, PROJECT_ID),
    ]);
    setVersions(v);
    setPinnedVer(p);
  }, []);

  const handlePin = (vId: number) => {
    setPinTarget(vId);
    setPinNote("");
  };

  const confirmPin = async () => {
    if (pinTarget === null || selectedChapter === null) return;
    await pinVersion(selectedChapter, pinTarget, pinNote, PROJECT_ID);
    toast.success(`Pinned v${pinTarget}`);
    setPinTarget(null);
    selectChapter(selectedChapter);
    refresh();
  };

  const handleRevert = (vId: number) => setRevertTarget(vId);

  const confirmRevert = async () => {
    if (revertTarget === null || selectedChapter === null) return;
    const ok = await revertToVersion(selectedChapter, revertTarget, PROJECT_ID);
    if (ok) {
      toast.success(`Reverted to v${revertTarget}`);
    } else {
      toast.error("Revert failed — version not found");
    }
    setRevertTarget(null);
  };

  const handleCompare = async (v1: number, v2: number) => {
    if (selectedChapter === null) return;
    const result = await compareVersions(selectedChapter, v1, v2, PROJECT_ID);
    if (result) {
      setDiff(result);
    } else {
      toast.error("Could not load versions for comparison");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-wide">Archive & Export</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span>{chapters.length} chapters archived</span>
        </div>
      </div>

      <div className="grid grid-cols-[300px_1fr] gap-4">
        {/* Left column: chapter list */}
        <div className="space-y-4">
          <ChapterList chapters={chapters} selectedChapter={selectedChapter} onSelect={selectChapter} />
        </div>

        {/* Right column: version detail + diff + export */}
        <div className="space-y-4">
          {selectedChapter !== null ? (
            <VersionHistory
              chapterNumber={selectedChapter}
              versions={versions}
              pinnedVersion={pinnedVer}
              onPin={handlePin}
              onRevert={handleRevert}
              onCompare={handleCompare}
            />
          ) : (
            <div className="border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground text-sm font-mono">Select a chapter to view versions</p>
            </div>
          )}

          {diff && <DiffView diff={diff} onClose={() => setDiff(null)} />}

          <ExportPanel />
        </div>
      </div>

      {/* Revert confirmation */}
      <AlertDialog open={revertTarget !== null} onOpenChange={() => setRevertTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Revert to v{revertTarget}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will set version {revertTarget} as the current draft for Chapter {selectedChapter}.
              The current draft will not be deleted — it remains in version history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRevert}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Revert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pin dialog */}
      <AlertDialog open={pinTarget !== null} onOpenChange={() => setPinTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Pin className="w-5 h-5 text-primary" />
              Pin v{pinTarget}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Add an optional note for this pinned version.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Pin note (optional)"
            value={pinNote}
            onChange={(e) => setPinNote(e.target.value)}
            className="my-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPin}>
              <Check className="w-4 h-4 mr-1" />
              Pin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ArchivePage;
