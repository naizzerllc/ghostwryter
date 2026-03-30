/**
 * Manuscript Health Dashboard — Minimal version, live from Chapter 1.
 * GHOSTLY v2.2 · Session 18
 *
 * Shows: tension curve, compulsion scores, override count,
 * twist integrity, next structural anchor, subplot tracker.
 */

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ── Types ───────────────────────────────────────────────────────────────

export interface ChapterHealth {
  chapter_number: number;
  tension_target: number;
  tension_actual: number | null;
  compulsion_score: number | null;
  quality_override: boolean;
}

interface ManuscriptHealthProps {
  chapters: ChapterHealth[];
  twistIntegrityStatus: string;
  nextStructuralAnchor: string;
  subplotThreads: { id: string; name: string; status: string }[];
  overrideCount: number;
}

// ── Component ───────────────────────────────────────────────────────────

export default function ManuscriptHealthDashboard({
  chapters,
  twistIntegrityStatus,
  nextStructuralAnchor,
  subplotThreads,
  overrideCount,
}: ManuscriptHealthProps) {
  const chartData = chapters.map(ch => ({
    name: `Ch ${ch.chapter_number}`,
    target: ch.tension_target,
    actual: ch.tension_actual,
    compulsion: ch.compulsion_score,
  }));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
        Manuscript Health
      </h3>

      {/* Tension Curve */}
      <div className="border border-border bg-card p-4">
        <h4 className="text-xs font-mono text-muted-foreground mb-2">Tension: Actual vs Target</h4>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="target" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" name="Target" dot={false} />
              <Line type="monotone" dataKey="actual" stroke="hsl(var(--accent))" name="Actual" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-foreground italic">No approved chapters yet</p>
        )}
      </div>

      {/* Compulsion Scores */}
      <div className="border border-border bg-card p-4">
        <h4 className="text-xs font-mono text-muted-foreground mb-2">Compulsion Scores</h4>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
              <Line type="monotone" dataKey="compulsion" stroke="hsl(var(--success))" name="Compulsion" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-foreground italic">No data</p>
        )}
      </div>

      <Separator />

      {/* Status Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-border bg-card p-3">
          <p className="text-xs font-mono text-muted-foreground">Quality Gate Overrides</p>
          <p className="text-lg font-mono text-foreground">{overrideCount}</p>
        </div>
        <div className="border border-border bg-card p-3">
          <p className="text-xs font-mono text-muted-foreground">Twist Integrity</p>
          <Badge variant="outline" className="font-mono text-xs mt-1">
            {twistIntegrityStatus}
          </Badge>
        </div>
      </div>

      {/* Next Structural Anchor */}
      <div className="border border-border bg-card p-3">
        <p className="text-xs font-mono text-muted-foreground">Next Structural Anchor</p>
        <p className="text-sm font-mono text-foreground mt-1">{nextStructuralAnchor || "—"}</p>
      </div>

      {/* Subplot Threads */}
      {subplotThreads.length > 0 && (
        <div className="border border-border bg-card p-3 space-y-1">
          <p className="text-xs font-mono text-muted-foreground">Subplot Threads</p>
          {subplotThreads.map(sp => (
            <div key={sp.id} className="flex items-center justify-between text-xs font-mono">
              <span className="text-foreground">{sp.name}</span>
              <Badge variant="outline" className="text-xs">{sp.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
