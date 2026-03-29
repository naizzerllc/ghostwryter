/**
 * Corpus Exchange Panel — add/view voice corpus exchanges per character.
 * GHOSTLY v2.2 · Prompt 02
 *
 * Accessible from Dashboard. Pressure state selector, prompt/response fields,
 * arc point counts, Chapter 1 block warning.
 */

import { useState, useCallback, useSyncExternalStore } from "react";
import {
  subscribe as charSubscribe,
  getSnapshot as charSnapshot,
} from "@/modules/characterDB/characterDB";
import {
  addExchange,
  loadCorpus,
  getArcCounts,
  isChapter1Blocked,
  getCorpusText,
  subscribe as corpusSubscribe,
  getSnapshot as corpusSnapshot,
  PRESSURE_STATES,
  type PressureState,
} from "@/modules/voiceCorpusGate/corpusExchangeStore";

const CorpusExchangePanel = () => {
  const charSnap = useSyncExternalStore(charSubscribe, charSnapshot);
  const corpSnap = useSyncExternalStore(corpusSubscribe, corpusSnapshot);

  const [selectedCharId, setSelectedCharId] = useState("");
  const [pressureState, setPressureState] = useState<PressureState>("ARC_START");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);

  const characters = charSnap.characters;
  const selectedCorpus = selectedCharId ? corpSnap.corpora.get(selectedCharId) : null;
  const arcCounts = selectedCharId ? getArcCounts(selectedCharId) : null;
  const ch1Blocked = selectedCharId ? isChapter1Blocked(selectedCharId) : false;

  const handleCharSelect = useCallback(async (id: string) => {
    setSelectedCharId(id);
    if (id) await loadCorpus(id);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedCharId || !prompt.trim() || !response.trim()) return;
    setSaving(true);
    try {
      await addExchange(selectedCharId, pressureState, prompt.trim(), response.trim());
      setPrompt("");
      setResponse("");
    } finally {
      setSaving(false);
    }
  }, [selectedCharId, pressureState, prompt, response]);

  if (characters.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-mono">No characters in DB. Add characters first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Character selector */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Character</p>
        <select
          value={selectedCharId}
          onChange={e => handleCharSelect(e.target.value)}
          className="w-full bg-muted border border-border text-foreground text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary"
        >
          <option value="">Select character…</option>
          {characters.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
          ))}
        </select>
      </div>

      {selectedCharId && (
        <>
          {/* Arc counts */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Exchange Counts</p>
            <div className="flex gap-2 flex-wrap">
              {arcCounts && PRESSURE_STATES.map(ps => {
                const count = arcCounts[ps];
                const isArcStart = ps === "ARC_START";
                const warn = isArcStart && count < 5;
                return (
                  <span
                    key={ps}
                    className={`text-[9px] font-mono px-1.5 py-0.5 border ${
                      warn ? "border-destructive text-destructive" : "border-border text-muted-foreground"
                    }`}
                  >
                    {ps}: <span className="text-foreground">{count}</span>
                    {isArcStart && <span className="text-muted-foreground">/5</span>}
                  </span>
                );
              })}
            </div>
            {ch1Blocked && (
              <p className="text-[9px] font-mono text-destructive mt-1">
                ⚠ Chapter 1 BLOCKED — need ≥5 ARC_START exchanges ({arcCounts?.ARC_START ?? 0}/5)
              </p>
            )}
          </div>

          {/* Add exchange form */}
          <div className="border-t border-border pt-3 space-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Pressure State</p>
              <select
                value={pressureState}
                onChange={e => setPressureState(e.target.value as PressureState)}
                className="w-full bg-muted border border-border text-foreground text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary"
              >
                {PRESSURE_STATES.map(ps => (
                  <option key={ps} value={ps}>{ps}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Prompt</p>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Situation / pressure scenario…"
                className="w-full bg-muted border border-border text-foreground text-xs font-mono px-2 py-1.5 h-14 resize-none focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Response</p>
              <textarea
                value={response}
                onChange={e => setResponse(e.target.value)}
                placeholder="Character's voice response in register…"
                className="w-full bg-muted border border-border text-foreground text-xs font-mono px-2 py-1.5 h-20 resize-none focus:outline-none focus:border-primary"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={saving || !prompt.trim() || !response.trim()}
              className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider border border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Add Exchange"}
            </button>
          </div>

          {/* Exchange list */}
          {selectedCorpus && selectedCorpus.exchanges.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                Exchanges ({selectedCorpus.exchanges.length})
              </p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {selectedCorpus.exchanges.slice().reverse().map(ex => (
                  <div key={ex.id} className="border border-border/50 p-1.5">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[9px] font-mono text-primary">{ex.pressure_state}</span>
                      <span className="text-[8px] font-mono text-muted-foreground">
                        {new Date(ex.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[9px] font-mono text-muted-foreground truncate">P: {ex.prompt}</p>
                    <p className="text-[9px] font-mono text-foreground truncate">R: {ex.response}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CorpusExchangePanel;
