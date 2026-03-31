/**
 * Analytics Page — Project analytics, quality distribution, cost breakdown, velocity, completion.
 * GHOSTLY v2.2 · Session 27
 *
 * All data derived from stored data — no blocking API calls on load.
 */

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  getProjectAnalytics,
  getVelocityData,
  getCompletionProjection,
  type ProjectAnalytics,
  type VelocityData,
  type CompletionProjection,
} from "@/modules/analytics/analyticsEngine";

// ── Colors ──────────────────────────────────────────────────────────────

const CHART_COLORS = ["hsl(0, 63%, 32%)", "hsl(45, 65%, 29%)", "hsl(145, 53%, 23%)", "hsl(220, 60%, 40%)"];
const QUALITY_COLORS = ["hsl(0, 63%, 32%)", "hsl(45, 65%, 29%)", "hsl(145, 53%, 23%)", "hsl(200, 70%, 35%)"];

// ── Summary Card ────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">{label}</p>
      <p className="text-2xl font-mono text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground font-mono mt-1">{sub}</p>}
    </div>
  );
}

// ── Quality Distribution Chart ──────────────────────────────────────────

function QualityDistributionChart({ analytics }: { analytics: ProjectAnalytics }) {
  const data = [
    { band: "< 7.0", count: analytics.quality_distribution.below_7 },
    { band: "7.0–7.9", count: analytics.quality_distribution.band_7_to_8 },
    { band: "8.0–8.9", count: analytics.quality_distribution.band_8_to_9 },
    { band: "9.0+", count: analytics.quality_distribution.above_9 },
  ];

  return (
    <div className="border border-border bg-card p-4">
      <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">Quality Distribution</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="band" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}
          />
          <Bar dataKey="count" name="Chapters">
            {data.map((_, i) => (
              <Cell key={i} fill={QUALITY_COLORS[i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Cost Breakdown Chart ────────────────────────────────────────────────

function CostBreakdownChart({ analytics }: { analytics: ProjectAnalytics }) {
  const data = analytics.provider_breakdown.map(p => ({
    name: p.provider,
    value: p.cost_usd,
  }));

  if (data.length === 0) {
    return (
      <div className="border border-border bg-card p-4">
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">Cost by Provider</h3>
        <p className="text-sm text-muted-foreground font-mono text-center py-8">No cost data yet</p>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card p-4">
      <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">Cost by Provider</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: $${value.toFixed(4)}`}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}
            formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Module Performance Table ────────────────────────────────────────────

function ModulePerformanceTable({ analytics }: { analytics: ProjectAnalytics }) {
  return (
    <div className="border border-border bg-card p-4">
      <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">Module Performance</h3>
      {analytics.module_performance.length === 0 ? (
        <p className="text-sm text-muted-foreground font-mono text-center py-4">No module data yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground">Module</th>
                <th className="text-right py-2 text-muted-foreground">Avg Score</th>
                <th className="text-right py-2 text-muted-foreground">Chapters</th>
              </tr>
            </thead>
            <tbody>
              {analytics.module_performance.map(m => (
                <tr key={m.module_name} className="border-b border-border/50">
                  <td className="py-2 text-foreground">{m.module_name.replace(/_/g, " ")}</td>
                  <td className={`text-right py-2 ${m.average_score >= 8 ? "text-success" : m.average_score >= 7 ? "text-warning" : "text-destructive"}`}>
                    {m.average_score.toFixed(2)}
                  </td>
                  <td className="text-right py-2 text-muted-foreground">{m.chapters_evaluated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Velocity Chart ──────────────────────────────────────────────────────

function VelocityChart({ velocity }: { velocity: VelocityData }) {
  if (velocity.daily_approvals.length === 0) {
    return (
      <div className="border border-border bg-card p-4">
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">Velocity — Chapters per Day</h3>
        <p className="text-sm text-muted-foreground font-mono text-center py-8">No velocity data yet</p>
      </div>
    );
  }

  // Show max last 30 days
  const chartData = velocity.daily_approvals.slice(-30).map(d => ({
    date: d.date.slice(5), // MM-DD
    chapters: d.count,
  }));

  return (
    <div className="border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Velocity — Chapters per Day</h3>
        <span className={`text-xs font-mono px-2 py-0.5 ${
          velocity.velocity_trend === "ACCELERATING" ? "bg-success/20 text-success" :
          velocity.velocity_trend === "DECELERATING" ? "bg-destructive/20 text-destructive" :
          "bg-muted text-muted-foreground"
        }`}>
          {velocity.velocity_trend}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}
          />
          <Line type="monotone" dataKey="chapters" stroke="hsl(0, 63%, 32%)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Completion Projector ────────────────────────────────────────────────

function CompletionProjectorPanel({ projection }: { projection: CompletionProjection }) {
  return (
    <div className="border border-border bg-card p-4">
      <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">Completion Projector</h3>

      {projection.blockers.length > 0 && (
        <div className="border border-destructive bg-destructive/10 p-3 mb-4">
          <p className="text-xs font-mono text-destructive">
            Completion projection paused — active blockers must be resolved.
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {projection.blockers.map(b => (
              <span key={b} className="text-[10px] font-mono bg-destructive/20 text-destructive px-2 py-0.5">{b}</span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div>
          <p className="text-[10px] uppercase text-muted-foreground font-mono">Total</p>
          <p className="text-lg font-mono text-foreground">{projection.total_chapters}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground font-mono">Approved</p>
          <p className="text-lg font-mono text-foreground">{projection.approved_to_date}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground font-mono">Remaining</p>
          <p className="text-lg font-mono text-foreground">{projection.remaining_chapters}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground font-mono">Confidence</p>
          <p className={`text-lg font-mono ${
            projection.confidence === "HIGH" ? "text-success" :
            projection.confidence === "MEDIUM" ? "text-warning" :
            "text-muted-foreground"
          }`}>{projection.confidence}</p>
        </div>
      </div>

      {projection.scenarios.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase text-muted-foreground font-mono mb-2">Scenarios</p>
          {projection.scenarios.map(s => (
            <div key={s.label} className="flex items-center justify-between text-xs font-mono border-b border-border/50 py-1.5">
              <span className="text-foreground">{s.label}</span>
              <span className="text-muted-foreground">{s.velocity.toFixed(2)} ch/day</span>
              <span className="text-foreground">{s.projected_days_remaining}d → {s.projected_completion_date}</span>
            </div>
          ))}
        </div>
      )}

      {projection.scenarios.length === 0 && projection.blockers.length === 0 && (
        <p className="text-sm text-muted-foreground font-mono text-center py-4">
          No outline loaded — load an outline to see completion projections.
        </p>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const analytics = useMemo(() => getProjectAnalytics(), []);
  const velocity = useMemo(() => getVelocityData(), []);
  const projection = useMemo(() => getCompletionProjection(), []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-wide">Analytics</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard
          label="Chapters Done"
          value={analytics.chapters_approved}
          sub={`${analytics.chapters_pending} pending · ${analytics.chapters_flagged} flagged`}
        />
        <SummaryCard
          label="Quality Average"
          value={analytics.average_quality_score > 0 ? analytics.average_quality_score.toFixed(2) : "—"}
          sub={`${analytics.average_revisions_per_chapter.toFixed(1)} avg revisions`}
        />
        <SummaryCard
          label="Days Active"
          value={velocity.days_since_start}
          sub={`${velocity.chapters_per_day.toFixed(2)} ch/day`}
        />
        <SummaryCard
          label="Est. Completion"
          value={velocity.estimated_completion_date ?? "—"}
          sub={projection.confidence !== "LOW" ? `Confidence: ${projection.confidence}` : "Insufficient data"}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-3">
        <QualityDistributionChart analytics={analytics} />
        <CostBreakdownChart analytics={analytics} />
      </div>

      {/* Module Performance + Velocity */}
      <div className="grid grid-cols-2 gap-3">
        <ModulePerformanceTable analytics={analytics} />
        <VelocityChart velocity={velocity} />
      </div>

      {/* Completion Projector */}
      <CompletionProjectorPanel projection={projection} />
    </div>
  );
}
