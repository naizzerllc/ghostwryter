/**
 * Voice Corpus Gate Panel — Per-dimension LLM evaluation results.
 * GHOSTLY v2.2 · DOC_F specification
 */

import { useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  DIMENSION_LABELS,
  DIMENSION_SHORT,
  type VoiceCorpusGateSnapshot,
  type VoiceCorpusGateResult,
  type VoiceCorpusScores,
} from "@/modules/voiceCorpusGate/voiceCorpusGate";

const gateColor: Record<string, string> = {
  PASSED: "text-success",
  CONDITIONAL: "text-warning",
  FAILED: "text-destructive",
};

const scoreColor = (score: number): string => {
  if (score >= 4) return "text-success";
  if (score >= 3) return "text-warning";
  return "text-destructive";
};

const DimensionBar = ({ dim, score }: { dim: keyof VoiceCorpusScores; score: { score: number; revision_note: string } }) => (
  <div className="flex items-center gap-2">
    <span className="text-[9px] font-mono text-muted-foreground w-8">{DIMENSION_SHORT[dim]}</span>
    <div className="flex-1 h-1.5 bg-muted">
      <div
        className={`h-full ${score.score >= 4 ? "bg-success" : score.score >= 3 ? "bg-warning" : "bg-destructive"}`}
        style={{ width: `${(score.score / 5) * 100}%` }}
      />
    </div>
    <span className={`text-[10px] font-mono font-semibold w-5 text-right ${scoreColor(score.score)}`}>
      {score.score}
    </span>
  </div>
);

const GateResultCard = ({ result }: { result: VoiceCorpusGateResult }) => {
  const failingDims = Object.entries(result.scores).filter(
    ([, s]) => s.score < 4 && s.revision_note
  ) as [keyof VoiceCorpusScores, { score: number; revision_note: string }][];

  return (
    <div className="border-b border-border/50 last:border-0 py-2 space-y-1.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono">{result.character_name}</span>
          <span className="text-[9px] font-mono text-muted-foreground uppercase">{result.character_role}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-semibold">
            {result.composite_score.toFixed(1)}/20
          </span>
          <span className={`text-[9px] font-mono font-semibold uppercase ${gateColor[result.gate_result]}`}>
            {result.gate_result}
          </span>
        </div>
      </div>

      {/* Dimension bars */}
      <div className="space-y-0.5">
        {(Object.keys(DIMENSION_LABELS) as (keyof VoiceCorpusScores)[]).map((dim) => (
          <DimensionBar key={dim} dim={dim} score={result.scores[dim]} />
        ))}
      </div>

      {/* Arc coherence (protagonist only) */}
      {result.arc_coherence && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[9px] font-mono text-muted-foreground">ARC</span>
          <span className={`text-[10px] font-mono font-semibold ${result.arc_coherence.passed ? "text-success" : "text-destructive"}`}>
            {result.arc_coherence.composite}/15
            {result.arc_coherence.passed ? " ✓" : " ✗"}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground">
            (W:{result.arc_coherence.q1_wound_rendered} P:{result.arc_coherence.q2_wound_under_pressure} T:{result.arc_coherence.q3_transformation_shown})
          </span>
        </div>
      )}

      {/* Revision instructions for failing dimensions */}
      {failingDims.length > 0 && (
        <div className="space-y-0.5 pt-1">
          {failingDims.map(([dim, s]) => (
            <p key={dim} className="text-[9px] font-mono text-warning">
              ↳ {DIMENSION_LABELS[dim]}: {s.revision_note}
            </p>
          ))}
        </div>
      )}
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
          Evaluate character voice corpus via Gemini Flash. Gate: ≥16/20 PASSED · 12–15 CONDITIONAL · &lt;12 FAILED
        </p>
        <p className="text-[10px] text-muted-foreground">
          Use <code className="text-foreground">__ghostly_voiceCorpusGate.evaluateCorpus(characterId, corpusText)</code>
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
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Passed</p>
          <p className="text-sm font-mono text-success">{snap.passed}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Conditional</p>
          <p className="text-sm font-mono text-warning">{snap.conditional}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Blocked</p>
          <p className="text-sm font-mono text-destructive">{snap.blocked}</p>
        </div>
      </div>

      {/* Results */}
      <div className="border-t border-border pt-2">
        {snap.results.map((r) => (
          <GateResultCard key={r.character_id} result={r} />
        ))}
      </div>
    </div>
  );
};

export default VoiceCorpusGatePanel;
