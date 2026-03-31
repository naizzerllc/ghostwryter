/**
 * Row 1 — Generation Health: Quality Gate, Compulsion Curve, Revision Loop.
 * GHOSTLY v2.2 · Session 27
 */

import { HealthPanel, Metric } from "./HealthPrimitives";
import type { getProjectAnalytics } from "@/modules/analytics/analyticsEngine";

type Analytics = ReturnType<typeof getProjectAnalytics>;

export default function GenerationHealthRow({ analytics }: { analytics: Analytics }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <HealthPanel title="Quality Gate Summary">
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Approved" value={analytics.chapters_approved} />
          <Metric label="Pending" value={analytics.chapters_pending} />
          <Metric label="Flagged" value={analytics.chapters_flagged} />
          <Metric label="Overridden" value={analytics.chapters_overridden} />
        </div>
      </HealthPanel>

      <HealthPanel title="Compulsion Curve">
        <div className="space-y-1">
          <Metric label="Avg Quality" value={analytics.average_quality_score > 0 ? analytics.average_quality_score.toFixed(2) : "—"} />
          <div className="flex gap-2 mt-2">
            <div className="text-[9px] font-mono text-muted-foreground">
              <span className="text-foreground">{analytics.quality_distribution.above_9}</span> ≥9.0
            </div>
            <div className="text-[9px] font-mono text-muted-foreground">
              <span className="text-foreground">{analytics.quality_distribution.band_8_to_9}</span> 8–9
            </div>
            <div className="text-[9px] font-mono text-muted-foreground">
              <span className="text-foreground">{analytics.quality_distribution.band_7_to_8}</span> 7–8
            </div>
            <div className="text-[9px] font-mono text-muted-foreground">
              <span className="text-foreground">{analytics.quality_distribution.below_7}</span> &lt;7
            </div>
          </div>
        </div>
      </HealthPanel>

      <HealthPanel title="Revision Loop Status">
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Avg Revisions" value={analytics.average_revisions_per_chapter.toFixed(1)} />
          <Metric label="Override Rate" value={`${(analytics.override_rate * 100).toFixed(1)}%`} />
        </div>
      </HealthPanel>
    </div>
  );
}
