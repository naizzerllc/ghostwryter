/**
 * Stage 4 — Complete: save outline, auto-populate CharacterDB, create voice corpus stubs.
 */
import { useState, useEffect } from "react";
import { CheckCircle, Users, Mic, Save, Loader2 } from "lucide-react";
import type { OutlineImportResult, ExtractedCharacter } from "@/lib/outlineImporter";
import { saveImportedOutline } from "@/lib/outlineImporter";
import { addCharacterFromImport, getCharacter, type FullCharacterRecord, type CharacterRole } from "@/lib/characterDatabase";
import { addExchange, type PressureState } from "@/modules/voiceCorpusGate/corpusExchangeStore";

type CommitStatus = "idle" | "saving" | "done" | "error";

interface CommitLog {
  outlineSaved: boolean;
  charactersAdded: string[];
  charactersSkipped: string[];
  corpusStubsCreated: string[];
  error?: string;
}

function mapRole(role: string): CharacterRole {
  if (role === "protagonist" || role === "antagonist") return role;
  return "major_supporting";
}

const ARC_PHASES: PressureState[] = ["ARC_START", "ARC_MID", "ARC_END"];

function createCorpusStubs(characterId: string) {
  for (const phase of ARC_PHASES) {
    addExchange(
      characterId,
      phase,
      `[STUB] ${phase} voice sample prompt — replace with actual corpus exchange`,
      `[STUB] ${phase} voice sample response — replace with actual corpus exchange`,
    );
  }
}

interface Props {
  result: OutlineImportResult;
  projectId: string;
  rawJson: string;
}

const ImportStageComplete = ({ result, projectId, rawJson }: Props) => {
  const [status, setStatus] = useState<CommitStatus>("idle");
  const [log, setLog] = useState<CommitLog>({
    outlineSaved: false,
    charactersAdded: [],
    charactersSkipped: [],
    corpusStubsCreated: [],
  });

  useEffect(() => {
    if (status !== "idle") return;
    runCommit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runCommit() {
    setStatus("saving");
    const commitLog: CommitLog = {
      outlineSaved: false,
      charactersAdded: [],
      charactersSkipped: [],
      corpusStubsCreated: [],
    };

    // Parse raw JSON to extract rich character data
    let rawCharacters: Record<string, unknown>[] = [];
    try {
      const parsed = JSON.parse(rawJson);
      rawCharacters = Array.isArray(parsed.characters) ? parsed.characters : [];
    } catch { /* ignore */ }

    try {
      // 1. Save outline to GitHub
      if (result.chapters) {
        await saveImportedOutline(projectId, result.chapters, rawJson);
        commitLog.outlineSaved = true;
      }

      // 2. Auto-populate CharacterDB
      const chars = result.characters_extracted ?? [];
      for (const c of chars) {
        const existing = getCharacter(c.id);
        if (existing) {
          commitLog.charactersSkipped.push(c.name);
          continue;
        }

        // Find rich data from raw JSON
        const rawChar = rawCharacters.find(
          (rc: Record<string, unknown>) => rc.name === c.name
        ) as Record<string, unknown> | undefined;

        const str = (key: string): string | null =>
          rawChar && typeof rawChar[key] === "string" ? (rawChar[key] as string) : null;

        const record: FullCharacterRecord = {
          id: c.id,
          project_id: projectId,
          name: c.name,
          role: mapRole(c.role),
          wound: str("wound"),
          flaw: str("flaw"),
          want: str("want"),
          need: str("need"),
          self_deception: str("self_deception"),
          fear: str("fear"),
          arc_entry_state: str("arc_entry_state") ?? "",
          arc_exit_state: str("arc_exit_state") ?? "",
          arc_start: str("arc_entry_state") ?? "",
          arc_end: str("arc_exit_state") ?? "",
          arc_lesson: str("karma_arc") ?? "",
          karma_arc: str("karma_arc") ?? "",
          external_goal: str("external_goal"),
          internal_desire: str("internal_desire"),
          goal_desire_gap: str("goal_desire_gap"),
          compressed_voice_dna: str("compressed_voice_dna"),
          voice_corpus_status: "PENDING",
          voice_reliability: "MISSING",
          corpus_approved: false,
        };

        const res = addCharacter(record);
        if (res.ok) {
          commitLog.charactersAdded.push(c.name);
        } else {
          commitLog.charactersSkipped.push(c.name);
        }
      }

      // 3. Create voice corpus stubs (3 arc phases per character)
      for (const c of chars) {
        createCorpusStubs(c.id);
        commitLog.corpusStubsCreated.push(c.name);
      }

      setLog(commitLog);
      setStatus("done");
    } catch (err) {
      commitLog.error = (err as Error).message;
      setLog(commitLog);
      setStatus("error");
    }
  }

  if (status === "saving") {
    return (
      <div className="border border-border bg-card p-12 flex flex-col items-center gap-4 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm font-semibold text-foreground">COMMITTING IMPORT</p>
        <p className="text-[10px] font-mono text-muted-foreground">
          Saving outline · Populating CharacterDB · Creating voice corpus stubs
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card space-y-0">
      {/* Header */}
      <div className={`px-4 py-3 border-b border-border flex items-center gap-3 ${status === "done" ? "bg-success/10" : "bg-destructive/10"}`}>
        <CheckCircle className={`w-4 h-4 ${status === "done" ? "text-success" : "text-destructive"}`} />
        <p className="text-sm font-semibold text-foreground">
          {status === "done" ? "IMPORT COMPLETE" : "IMPORT FAILED"}
        </p>
      </div>

      {/* Outline save */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <Save className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-mono text-foreground">Outline saved to GitHub</span>
        <span className={`ml-auto text-[10px] font-mono ${log.outlineSaved ? "text-success" : "text-destructive"}`}>
          {log.outlineSaved ? "OK" : "FAILED"}
        </span>
      </div>

      {/* Characters */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-mono text-foreground">CharacterDB populated</span>
          <span className="ml-auto text-[10px] font-mono text-success">
            {log.charactersAdded.length} added
          </span>
        </div>
        {log.charactersAdded.length > 0 && (
          <div className="flex flex-wrap gap-1 ml-7">
            {log.charactersAdded.map(name => (
              <span key={name} className="px-2 py-0.5 text-[10px] font-mono bg-success/10 text-success">{name}</span>
            ))}
          </div>
        )}
        {log.charactersSkipped.length > 0 && (
          <div className="flex flex-wrap gap-1 ml-7 mt-1">
            {log.charactersSkipped.map(name => (
              <span key={name} className="px-2 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground">{name} (exists)</span>
            ))}
          </div>
        )}
      </div>

      {/* Corpus stubs */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <Mic className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-mono text-foreground">Voice corpus stubs</span>
          <span className="ml-auto text-[10px] font-mono text-success">
            {log.corpusStubsCreated.length} × 3 phases
          </span>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground ml-7">
          ARC_START · ARC_MID · ARC_END stubs created — replace with actual exchanges
        </p>
      </div>

      {/* Error */}
      {log.error && (
        <div className="px-4 py-3 bg-destructive/10">
          <p className="text-xs font-mono text-destructive">{log.error}</p>
        </div>
      )}
    </div>
  );
};

export default ImportStageComplete;
