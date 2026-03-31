/**
 * Row 2 — Structural Health: Twist Integrity, Subplot Tracker, Rollercoaster.
 * GHOSTLY v2.2 · Session 27
 */

import { HealthPanel, StatusBadge } from "./HealthPrimitives";

interface Props {
  mei: { status: string; last_chapter: number | null };
  subplots: { id: string; description: string; status: string }[];
  rollercoaster: { compliant: boolean; checked_at: string | null };
}

export default function StructuralHealthRow({ mei, subplots, rollercoaster }: Props) {
  const meiColor = mei.status === "GREEN" ? "success" : mei.status === "AMBER" ? "warning" : mei.status === "RED" || mei.status === "CRITICAL" ? "destructive" : "muted";

  return (
    <div className="grid grid-cols-3 gap-3">
      <HealthPanel title="Twist Integrity (MEI)">
        <div className="flex items-center justify-between">
          <StatusBadge status={mei.status} color={meiColor} />
          {mei.last_chapter && (
            <span className="text-[10px] font-mono text-muted-foreground">Last: Ch.{mei.last_chapter}</span>
          )}
        </div>
        {mei.status === "—" && (
          <p className="text-[10px] font-mono text-muted-foreground mt-2">MEI not yet triggered</p>
        )}
      </HealthPanel>

      <HealthPanel title="Subplot Tracker">
        {subplots.length === 0 ? (
          <p className="text-[10px] font-mono text-muted-foreground">No subplots registered</p>
        ) : (
          <div className="space-y-1 max-h-[80px] overflow-y-auto">
            {subplots.map(s => (
              <div key={s.id} className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-foreground truncate max-w-[120px]" title={s.description}>{s.description}</span>
                <StatusBadge
                  status={s.status.toUpperCase()}
                  color={s.status === "active" ? "success" : s.status === "dark" ? "destructive" : "warning"}
                />
              </div>
            ))}
          </div>
        )}
      </HealthPanel>

      <HealthPanel title="Rollercoaster Integrity" updated={rollercoaster.checked_at?.slice(0, 10) ?? undefined}>
        <div className="flex items-center gap-2">
          <StatusBadge
            status={rollercoaster.compliant ? "COMPLIANT" : "VIOLATION"}
            color={rollercoaster.compliant ? "success" : "destructive"}
          />
        </div>
        {!rollercoaster.checked_at && (
          <p className="text-[10px] font-mono text-muted-foreground mt-2">Not yet checked</p>
        )}
      </HealthPanel>
    </div>
  );
}
