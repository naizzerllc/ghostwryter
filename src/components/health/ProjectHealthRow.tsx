/**
 * Row 4 — Project Health: Failure Log, Memory Core, GitHub, Cost.
 * GHOSTLY v2.2 · Session 27
 */

import { HealthPanel, StatusBadge, Metric } from "./HealthPrimitives";
import type { SessionCostSummary } from "@/api/sessionCostTracker";

interface Props {
  failures: { type: string; chapter: number | null; description: string; timestamp: string }[];
  memoryCore: { status: string; last_updated: string | null };
  github: { connected: boolean; last_sync: string | null };
  costSummary: SessionCostSummary;
}

export default function ProjectHealthRow({ failures, memoryCore, github, costSummary }: Props) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <HealthPanel title="Failure Log">
        {failures.length === 0 ? (
          <p className="text-[10px] font-mono text-muted-foreground">No failures recorded</p>
        ) : (
          <div className="space-y-1 max-h-[80px] overflow-y-auto">
            {failures.map((f, i) => (
              <div key={i} className="text-[10px] font-mono flex items-center gap-1">
                <StatusBadge
                  status={f.type.replace(/_/g, " ")}
                  color={f.type.includes("CRITICAL") || f.type.includes("REFUSAL") ? "destructive" : "warning"}
                />
                {f.chapter && <span className="text-muted-foreground">Ch.{f.chapter}</span>}
              </div>
            ))}
          </div>
        )}
      </HealthPanel>

      <HealthPanel title="Memory Core" updated={memoryCore.last_updated?.slice(0, 10) ?? undefined}>
        <StatusBadge
          status={memoryCore.status}
          color={memoryCore.status === "READY" ? "success" : "warning"}
        />
      </HealthPanel>

      <HealthPanel title="GitHub Status" updated={github.last_sync?.slice(0, 10) ?? undefined}>
        <StatusBadge
          status={github.connected ? "CONNECTED" : "DISCONNECTED"}
          color={github.connected ? "success" : "destructive"}
        />
      </HealthPanel>

      <HealthPanel title="Cost Running Total">
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Spend" value={`$${costSummary.estimated_cost_usd.toFixed(4)}`} />
          <Metric label="Tokens" value={costSummary.total_tokens.toLocaleString()} />
        </div>
      </HealthPanel>
    </div>
  );
}
