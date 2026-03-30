/**
 * Voice Corpus Page — exchange entry UI with arc counts, block status, gate results.
 * GHOSTLY v2.2 · S09
 */

import { useState, useCallback, useSyncExternalStore } from "react";
import {
  addExchange,
  loadCorpus,
  getArcCounts,
  getCorpusText,
  isChapter1Blocked,
  PRESSURE_STATES,
  type PressureState,
  type CorpusExchange,
  subscribe as corpusSubscribe,
  getSnapshot as corpusSnapshot,
} from "@/modules/voiceCorpusGate/corpusExchangeStore";
import {
  evaluateCorpus,
  getGateResult,
  type VoiceCorpusGateResult,
  DIMENSION_LABELS,
  THRESHOLDS,
  subscribe as gateSubscribe,
  getSnapshot as gateSnapshotFn,
} from "@/modules/voiceCorpusGate/voiceCorpusGate";
import {
  getAllCharacters,
  type FullCharacterRecord,
  subscribe as charSubscribe,
  getSnapshot as charSnapshotFn,
} from "@/lib/characterDatabase";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  ShieldAlert,
  Mic,
  ChevronRight,
} from "lucide-react";

const ARC_MINIMUMS: Partial<Record<PressureState, { min: number; label: string }>> = {
  ARC_START: { min: 5, label: "Chapter 1 gate" },
  ARC_MID: { min: 1, label: "Chapter 16 gate" },
  ARC_END: { min: 1, label: "Post-all-is-lost gate" },
};

const PRESSURE_LABELS: Record<PressureState, string> = {
  ARC_START: "Arc Start",
  ARC_MID: "Arc Mid",
  ARC_END: "Arc End",
  DEFLECTION: "Deflection",
  DECEPTION: "Deception",
  COLLAPSE: "Collapse",
};

const VoiceCorpus = () => {
  const charSnap = useSyncExternalStore(charSubscribe, charSnapshotFn);
  useSyncExternalStore(corpusSubscribe, corpusSnapshot);
  const gateSnap = useSyncExternalStore(gateSubscribe, gateSnapshotFn);

  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState<PressureState>("ARC_START");
  const [formPrompt, setFormPrompt] = useState("");
  const [formResponse, setFormResponse] = useState("");
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [loadingCorpus, setLoadingCorpus] = useState(false);

  const characters = charSnap.characters;
  const selectedChar = characters.find((c) => c.id === selectedCharId) ?? null;

  const handleSelectChar = useCallback(async (id: string) => {
    setSelectedCharId(id);
    setShowForm(false);
    setLoadingCorpus(true);
    await loadCorpus(id);
    setLoadingCorpus(false);
  }, []);

  const handleAddExchange = useCallback(async () => {
    if (!selectedCharId || !formPrompt.trim() || !formResponse.trim()) return;
    setSaving(true);
    await addExchange(selectedCharId, formState, formPrompt.trim(), formResponse.trim());
    setFormPrompt("");
    setFormResponse("");
    setShowForm(false);
    setSaving(false);
  }, [selectedCharId, formState, formPrompt, formResponse]);

  const handleEvaluate = useCallback(async () => {
    if (!selectedCharId) return;
    const text = getCorpusText(selectedCharId);
    if (!text) return;
    setEvaluating(true);
    await evaluateCorpus(selectedCharId, text);
    setEvaluating(false);
  }, [selectedCharId]);

  const arcCounts = selectedCharId ? getArcCounts(selectedCharId) : null;
  const ch1Blocked = selectedCharId ? isChapter1Blocked(selectedCharId) : false;
  const gateResult: VoiceCorpusGateResult | null = selectedCharId
    ? getGateResult(selectedCharId)
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-wide">VOICE CORPUS</h1>
        <p className="text-xs text-muted-foreground font-mono mt-1">
          Exchange entry · Pressure state coverage · Quality gate evaluation
        </p>
      </div>

      <div className="flex gap-4">
        {/* Character List */}
        <div className="w-72 min-w-[288px] border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
              Characters
            </p>
          </div>
          {characters.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">
              No characters loaded. Import an outline first.
            </div>
          ) : (
            <ul>
              {characters.map((c) => {
                const blocked = isChapter1Blocked(c.id);
                const gate = getGateResult(c.id);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => handleSelectChar(c.id)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-2 text-sm transition-colors border-b border-border last:border-b-0 ${
                        selectedCharId === c.id
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 shrink-0 ${
                          c.role === "protagonist"
                            ? "bg-primary"
                            : c.role === "antagonist"
                            ? "bg-destructive"
                            : "bg-secondary"
                        }`}
                      />
                      <span className="flex-1 truncate">{c.name}</span>
                      {blocked && !c.corpus_approved && (
                        <ShieldAlert className="w-3 h-3 text-destructive shrink-0" />
                      )}
                      {gate && (
                        <span
                          className={`text-[9px] font-mono ${
                            gate.gate_result === "PASSED"
                              ? "text-success"
                              : gate.gate_result === "CONDITIONAL"
                              ? "text-warning"
                              : "text-destructive"
                          }`}
                        >
                          {gate.composite_score.toFixed(0)}
                        </span>
                      )}
                      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Detail Panel */}
        <div className="flex-1 space-y-4">
          {!selectedChar ? (
            <div className="border border-border bg-card p-8 flex flex-col items-center gap-3 text-center">
              <Mic className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Select a character to manage their voice corpus</p>
            </div>
          ) : (
            <>
              {/* Character Header + Block Status */}
              <div className="border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{selectedChar.name}</h2>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase">
                      {selectedChar.role} · {selectedChar.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleEvaluate}
                      disabled={evaluating || !getCorpusText(selectedChar.id)}
                      className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                    >
                      {evaluating ? "EVALUATING..." : "RUN GATE"}
                    </button>
                    <button
                      onClick={() => setShowForm(true)}
                      className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-muted text-foreground hover:bg-muted/80 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> ADD EXCHANGE
                    </button>
                  </div>
                </div>

                {/* Block warnings */}
                {ch1Blocked && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border-l-2 border-destructive text-xs font-mono text-destructive mb-2">
                    <ShieldAlert className="w-3 h-3 shrink-0" />
                    Chapter 1 BLOCKED — ARC_START needs {5 - (arcCounts?.ARC_START ?? 0)} more exchanges
                  </div>
                )}
                {!selectedChar.corpus_approved && gateResult && gateResult.generation_blocked && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border-l-2 border-destructive text-xs font-mono text-destructive">
                    <XCircle className="w-3 h-3 shrink-0" />
                    Generation BLOCKED — corpus not approved ({gateResult.gate_result}: {gateResult.composite_score.toFixed(1)}/20)
                  </div>
                )}
              </div>

              {/* Arc Counts */}
              {arcCounts && (
                <div className="border border-border bg-card p-4">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-3">
                    Pressure State Coverage
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {PRESSURE_STATES.map((ps) => {
                      const count = arcCounts[ps];
                      const req = ARC_MINIMUMS[ps];
                      const met = req ? count >= req.min : true;
                      return (
                        <div
                          key={ps}
                          className={`px-3 py-2 border ${
                            req && !met ? "border-destructive/50 bg-destructive/5" : "border-border"
                          }`}
                        >
                          <p className="text-xs font-mono font-semibold text-foreground">
                            {PRESSURE_LABELS[ps]}
                          </p>
                          <p className={`text-lg font-mono ${req && !met ? "text-destructive" : "text-foreground"}`}>
                            {count}
                            {req && (
                              <span className="text-[10px] text-muted-foreground ml-1">/ {req.min} min</span>
                            )}
                          </p>
                          {req && (
                            <p className="text-[9px] font-mono text-muted-foreground">{req.label}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Gate Result */}
              {gateResult && (
                <div className="border border-border bg-card">
                  <div
                    className={`px-4 py-3 border-b border-border flex items-center gap-3 ${
                      gateResult.gate_result === "PASSED"
                        ? "bg-success/10"
                        : gateResult.gate_result === "CONDITIONAL"
                        ? "bg-warning/10"
                        : "bg-destructive/10"
                    }`}
                  >
                    {gateResult.gate_result === "PASSED" ? (
                      <CheckCircle className="w-4 h-4 text-success" />
                    ) : gateResult.gate_result === "CONDITIONAL" ? (
                      <AlertTriangle className="w-4 h-4 text-warning" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {gateResult.gate_result} — {gateResult.composite_score.toFixed(1)}/20
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {gateResult.evaluation_method} · {gateResult.evaluated_at}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    {(Object.keys(DIMENSION_LABELS) as (keyof typeof DIMENSION_LABELS)[]).map((dim) => {
                      const s = gateResult.scores[dim];
                      return (
                        <div key={dim} className="flex items-center gap-3 text-xs font-mono">
                          <span className="w-44 text-muted-foreground">{DIMENSION_LABELS[dim]}</span>
                          <span
                            className={`font-semibold ${
                              s.score >= 4 ? "text-success" : s.score >= 3 ? "text-warning" : "text-destructive"
                            }`}
                          >
                            {s.score}/5
                          </span>
                          {s.revision_note && (
                            <span className="text-muted-foreground italic truncate">{s.revision_note}</span>
                          )}
                        </div>
                      );
                    })}
                    {gateResult.arc_coherence && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2">
                          Arc Coherence (protagonist)
                        </p>
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <span>Wound: {gateResult.arc_coherence.q1_wound_rendered}/5</span>
                          <span>Pressure: {gateResult.arc_coherence.q2_wound_under_pressure}/5</span>
                          <span>Transform: {gateResult.arc_coherence.q3_transformation_shown}/5</span>
                          <span
                            className={
                              gateResult.arc_coherence.passed ? "text-success font-semibold" : "text-destructive font-semibold"
                            }
                          >
                            {gateResult.arc_coherence.composite}/15 {gateResult.arc_coherence.passed ? "PASSED" : "FAILED"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Exchange Form */}
              {showForm && (
                <div className="border border-border bg-card p-4 space-y-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                    New Exchange
                  </p>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono block mb-1">
                      Pressure State
                    </label>
                    <select
                      value={formState}
                      onChange={(e) => setFormState(e.target.value as PressureState)}
                      className="w-full bg-background border border-border px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary"
                    >
                      {PRESSURE_STATES.map((ps) => (
                        <option key={ps} value={ps}>
                          {PRESSURE_LABELS[ps]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono block mb-1">
                      Prompt
                    </label>
                    <textarea
                      value={formPrompt}
                      onChange={(e) => setFormPrompt(e.target.value)}
                      placeholder="The situation or question posed to the character..."
                      className="w-full h-24 bg-background border border-border p-3 text-sm font-mono text-foreground resize-none focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono block mb-1">
                      Response (in character's voice)
                    </label>
                    <textarea
                      value={formResponse}
                      onChange={(e) => setFormResponse(e.target.value)}
                      placeholder="How the character responds in their distinct voice..."
                      className="w-full h-32 bg-background border border-border p-3 text-sm font-mono text-foreground resize-none focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleAddExchange}
                      disabled={saving || !formPrompt.trim() || !formResponse.trim()}
                      className="px-4 py-2 text-xs font-mono uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                    >
                      {saving ? "SAVING..." : "SAVE EXCHANGE"}
                    </button>
                    <button
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}

              {/* Loading state */}
              {loadingCorpus && (
                <div className="text-xs font-mono text-muted-foreground p-4">Loading corpus...</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceCorpus;
