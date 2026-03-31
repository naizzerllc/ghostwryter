/**
 * Full Manuscript Health Dashboard — Consolidated real-time view of all health signals.
 * GHOSTLY v2.2 · Session 27
 *
 * 4 rows × 3–4 panels. All data derived from stored data — no blocking API calls on load.
 */

import { useMemo } from "react";
import { getProjectAnalytics, getVelocityData } from "@/modules/analytics/analyticsEngine";
import { getSessionSummary } from "@/api/sessionCostTracker";

// ── Panel Shell ─────────────────────────────────────────────────────────

function HealthPanel({ title, children, updated }: { title: string; children: React.ReactNode; updated?: string }) {
  return (
    <div className="border border-border bg-card p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{title}</h4>
        {updated && <span className="text-[9px] font-mono text-muted-foreground">{updated}</span>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function StatusBadge({ status, color }: { status: string; color: "success" | "warning" | "destructive" | "muted" }) {
  const colorMap = {
    success: "bg-success/20 text-success",
    warning: "bg-warning/20 text-warning",
    destructive: "bg-destructive/20 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  return <span className={`text-[10px] font-mono px-2 py-0.5 ${colorMap[color]}`}>{status}</span>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[9px] uppercase text-muted-foreground font-mono">{label}</p>
      <p className="text-sm font-mono text-foreground">{value}</p>
    </div>
  );
}

// ── Data Loaders (localStorage) ─────────────────────────────────────────

function loadMEIStatus(): { status: string; last_chapter: number | null } {
  try {
    const raw = localStorage.getItem("ghostly_mei_latest");
    if (raw) {
      const parsed = JSON.parse(raw);
      return { status: parsed.composite_status ?? "—", last_chapter: parsed.trigger_chapter ?? null };
    }
  } catch { /* ignore */ }
  return { status: "—", last_chapter: null };
}

function loadSubplotStatus(): { id: string; description: string; status: string }[] {
  try {
    const raw = localStorage.getItem("ghostly_subplot_registry");
    if (raw) {
      const subplots = JSON.parse(raw);
      return Array.isArray(subplots) ? subplots.map((s: { subplot_id: string; subplot_description: string; status?: string }) => ({
        id: s.subplot_id,
        description: s.subplot_description,
        status: s.status ?? "active",
      })) : [];
    }
  } catch { /* ignore */ }
  return [];
}

function loadRollercoasterStatus(): { compliant: boolean; checked_at: string | null; next_check: number | null } {
  try {
    const raw = localStorage.getItem("ghostly_rollercoaster_result");
    if (raw) {
      const parsed = JSON.parse(raw);
      return { compliant: parsed.compliant ?? true, checked_at: parsed.checked_at ?? null, next_check: null };
    }
  } catch { /* ignore */ }
  return { compliant: true, checked_at: null, next_check: null };
}

function loadAntiAITrend(): { average: number; count: number } {
  try {
    const raw = localStorage.getItem("ghostly_anti_ai_scores");
    if (raw) {
      const scores = JSON.parse(raw) as number[];
      if (scores.length > 0) {
        const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
        return { average: Math.round(avg * 100) / 100, count: scores.length };
      }
    }
  } catch { /* ignore */ }
  return { average: 0, count: 0 };
}

function loadSystematicTells(): number {
  try {
    const raw = localStorage.getItem("ghostly_systematic_tells");
    if (raw) {
      const tells = JSON.parse(raw);
      return Array.isArray(tells) ? tells.length : 0;
    }
  } catch { /* ignore */ }
  return 0;
}

function loadWarmthSpacing(): { next_warmth_due: number | null } {
  try {
    const raw = localStorage.getItem("ghostly_warmth_spacing");
    if (raw) {
      const parsed = JSON.parse(raw);
      return { next_warmth_due: parsed.next_warmth_due ?? null };
    }
  } catch { /* ignore */ }
  return { next_warmth_due: null };
}

function loadFailureLog(): { type: string; chapter: number | null; description: string; timestamp: string }[] {
  try {
    const raw = localStorage.getItem("ghostly_failure_records");
    if (raw) {
      const records = JSON.parse(raw);
      if (Array.isArray(records)) {
        return records.slice(-5).reverse().map((r: { failure_type: string; chapter_number: number | null; description: string; detected_at: string }) => ({
          type: r.failure_type,
          chapter: r.chapter_number,
          description: r.description,
          timestamp: r.detected_at,
        }));
      }
    }
  } catch { /* ignore */ }
  return [];
}

function loadMemoryCoreStatus(): { status: string; last_updated: string | null } {
  try {
    const status = localStorage.getItem("ghostly_memory_core_status") ?? "READY";
    const updated = localStorage.getItem("ghostly_memory_core_last_updated") ?? null;
    return { status, last_updated: updated };
  } catch { /* ignore */ }
  return { status: "READY", last_updated: null };
}

function loadGitHubStatus(): { connected: boolean; last_sync: string | null } {
  try {
    const token = localStorage.getItem("github_token");
    const lastSync = localStorage.getItem("ghostly_github_last_sync") ?? null;
    return { connected: !!token, last_sync: lastSync };
  } catch { /* ignore */ }
  return { connected: false, last_sync: null };
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function ManuscriptHealthPage() {
  const analytics = useMemo(() => getProjectAnalytics(), []);
  const velocity = useMemo(() => getVelocityData(), []);
  const costSummary = useMemo(() => getSessionSummary(), []);
  const mei = useMemo(() => loadMEIStatus(), []);
  const subplots = useMemo(() => loadSubplotStatus(), []);
  const rollercoaster = useMemo(() => loadRollercoasterStatus(), []);
  const antiAI = useMemo(() => loadAntiAITrend(), []);
  const tells = useMemo(() => loadSystematicTells(), []);
  const warmth = useMemo(() => loadWarmthSpacing(), []);
  const failures = useMemo(() => loadFailureLog(), []);
  const memoryCore = useMemo(() => loadMemoryCoreStatus(), []);
  const github = useMemo(() => loadGitHubStatus(), []);

  const meiColor = mei.status === "GREEN" ? "success" : mei.status === "AMBER" ? "warning" : mei.status === "RED" || mei.status === "CRITICAL" ? "destructive" : "muted";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-wide">Manuscript Health</h1>

      {/* Row 1 — Generation Health */}
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

      {/* Row 2 — Structural Health */}
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

      {/* Row 3 — Voice Health */}
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

      {/* Row 4 — Project Health */}
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
    </div>
  );
}
