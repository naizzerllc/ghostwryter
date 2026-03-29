/**
 * Voice Corpus Gate Panel — Dashboard display of corpus evaluation results.
 * GHOSTLY v2.2 · Prompt 02 · MSG-2
 */

import { useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  type VoiceCorpusGateSnapshot,
  type VoiceCorpusGateResult,
} from "@/modules/voiceCorpusGate/voiceCorpusGate";

const dimensionLabels: Record<string, string> = {
  distinctiveness: "DIST",
  consistency: "CONS",
  register_range: "RANGE",
  dialogue_authenticity: "AUTH",
};

const GateResultBadge = ({ result }: { result: VoiceCorpusGateResult }) => {
  const color =
    result.gate_result === "APPROVED"
      ? "text-success"
      : result.gate_result === "REVIEW"
      ? "text-warning"
      : "text-destructive";

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono">{result.character_name}</span>
        <span className={`text-[9px] font-mono uppercase ${color}`}>
          {result.gate_result}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {Object.entries(result.scores).map(([dim, score]) => (
          <span
            key={dim}
            className={`text-[9px] font-mono ${
              score.score >= 7 ? "text-success" : score.score >= 5 ? "text-warning" : "text-destructive"
            }`}
            title={`${dim}: ${score.score.toFixed(1)}`}
          >
            {dimensionLabels[dim]}:{score.score.toFixed(1)}
          </span>
        ))}
        <span className="text-[10px] font-mono font-semibold ml-1">
          {result.composite_score.toFixed(1)}
        </span>
      </div>
    </div>
  );
};

const VoiceCorpusGatePanel = () => {
  const snap: VoiceCorpusGateSnapshot = useSyncExternalStore(subscribe, getSnapshot);

  if (snap.totalEvaluated === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-mono">No evaluations yet</p>
        <p className="text-[10px] text-muted-foreground">
          Evaluate character voice corpus samples to unlock generation. Gate: ≥7.0 APPROVED · 5.0–6.9 REVIEW · &lt;5.0 REJECTED
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Evaluated</p>
          <p className="text-sm font-mono">{snap.totalEvaluated}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Approved</p>
          <p className="text-sm font-mono text-success">{snap.approved}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Review</p>
          <p className="text-sm font-mono text-warning">{snap.review}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Blocked</p>
          <p className="text-sm font-mono text-destructive">{snap.blocked}</p>
        </div>
      </div>

      {/* Results list */}
      <div className="border-t border-border pt-2">
        {snap.results.map((r) => (
          <GateResultBadge key={r.character_id} result={r} />
        ))}
      </div>
    </div>
  );
};

export default VoiceCorpusGatePanel;
