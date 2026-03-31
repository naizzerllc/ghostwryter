/**
 * Row 3 — Voice Health: Register Drift, Anti-AI Score, Warmth Spacing.
 * GHOSTLY v2.2 · Session 27
 */

import { HealthPanel, Metric } from "./HealthPrimitives";

interface Props {
  tells: number;
  antiAI: { average: number; count: number };
  warmth: { next_warmth_due: number | null };
}

export default function VoiceHealthRow({ tells, antiAI, warmth }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <HealthPanel title="Register Drift">
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Systematic Tells" value={tells} />
          <Metric label="Status" value={tells > 0 ? "DRIFT" : "CLEAN"} />
        </div>
      </HealthPanel>

      <HealthPanel title="Anti-AI Score Trend">
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Rolling Avg" value={antiAI.average > 0 ? antiAI.average.toFixed(2) : "—"} />
          <Metric label="Chapters" value={antiAI.count} />
        </div>
      </HealthPanel>

      <HealthPanel title="Warmth Spacing">
        {warmth.next_warmth_due ? (
          <Metric label="Next Warmth Due" value={`Ch. ${warmth.next_warmth_due}`} />
        ) : (
          <p className="text-[10px] font-mono text-muted-foreground">No warmth data</p>
        )}
      </HealthPanel>
    </div>
  );
}
