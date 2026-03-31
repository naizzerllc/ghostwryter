/**
 * Compulsion Curve Dashboard — Target vs Actual visualization.
 * GHOSTLY v2.2 · Session 25
 */

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  getCompulsionCurve,
  analyzeTensionCurve,
  type CompulsionCurveRecord,
} from "@/modules/dramaticArchitecture/tensionCurve";
import { AlertTriangle, ArrowRight } from "lucide-react";

interface CompulsionCurveDashboardProps {
  incitingIncidentChapter?: number;
  allIsLostChapter?: number;
  revelationChapter?: number;
  totalChapters?: number;
  onReviewChapter?: (chapterNumber: number) => void;
}

export default function CompulsionCurveDashboard({
  incitingIncidentChapter,
  allIsLostChapter,
  revelationChapter,
  totalChapters,
  onReviewChapter,
}: CompulsionCurveDashboardProps) {
  const [curveData] = useState<CompulsionCurveRecord[]>(() => getCompulsionCurve());

  const chartData = useMemo(() => {
    return curveData.map((r) => ({
      chapter: r.chapter_number,
      target: r.tension_score_target,
      actual: r.compulsion_score,
      tension_actual: r.tension_score_actual,
      act: r.act,
    }));
  }, [curveData]);

  const analysis = useMemo(() => {
    return analyzeTensionCurve(
      curveData,
      incitingIncidentChapter,
      allIsLostChapter,
      totalChapters
    );
  }, [curveData, incitingIncidentChapter, allIsLostChapter, totalChapters]);

  const divergenceFlags = useMemo(() => {
    const flags: Array<{ message: string; chapter?: number; severity: "warning" | "critical" }> = [];

    if (!analysis.inciting_incident_met && incitingIncidentChapter) {
      flags.push({
        message: `Inciting incident (Ch${incitingIncidentChapter}) tension below 8.0`,
        chapter: incitingIncidentChapter,
        severity: "critical",
      });
    }

    if (!analysis.all_is_lost_ranked && allIsLostChapter) {
      flags.push({
        message: `All-is-lost (Ch${allIsLostChapter}) not in top 5 compulsion scores`,
        chapter: allIsLostChapter,
        severity: "critical",
      });
    }

    if (!analysis.final_stretch_met) {
      flags.push({
        message: "Final 10 chapters average ≤ Act 2 average — insufficient escalation",
        severity: "warning",
      });
    }

    if (!analysis.act2_variance_met) {
      flags.push({
        message: "Act 2 standard deviation < 1.2 — pacing too flat",
        severity: "warning",
      });
    }

    if (!analysis.act2_peaks_met) {
      flags.push({
        message: "Act 2 missing two chapters ≥ 8.5 separated by 5+ chapters",
        severity: "warning",
      });
    }

    return flags;
  }, [analysis, incitingIncidentChapter, allIsLostChapter]);

  if (curveData.length === 0) {
    return (
      <div className="border border-border bg-card p-6 text-center">
        <p className="text-muted-foreground text-sm font-mono">
          No compulsion curve data — approve chapters to populate
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="border border-border bg-card p-4">
        <h3 className="text-sm font-semibold tracking-wide text-foreground mb-4">
          COMPULSION CURVE — TARGET vs ACTUAL
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="chapter"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              label={{ value: "Chapter", position: "insideBottom", offset: -4, fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            />
            <YAxis
              domain={[0, 10]}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              label={{ value: "Score", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--foreground))",
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            {/* Structural anchors */}
            {incitingIncidentChapter && (
              <ReferenceLine x={incitingIncidentChapter} stroke="hsl(var(--warning))" strokeDasharray="3 3" label={{ value: "II", fill: "hsl(var(--warning))", fontSize: 10 }} />
            )}
            {allIsLostChapter && (
              <ReferenceLine x={allIsLostChapter} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label={{ value: "AIL", fill: "hsl(var(--destructive))", fontSize: 10 }} />
            )}
            {revelationChapter && (
              <ReferenceLine x={revelationChapter} stroke="hsl(var(--success))" strokeDasharray="3 3" label={{ value: "REV", fill: "hsl(var(--success))", fontSize: 10 }} />
            )}

            {/* Target line (dashed) */}
            <Line
              type="monotone"
              dataKey="target"
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              dot={false}
              name="Target"
            />
            {/* Actual line (solid) */}
            <Line
              type="monotone"
              dataKey="actual"
              stroke="hsl(var(--accent))"
              strokeWidth={2}
              dot={{ r: 3, fill: "hsl(var(--accent))" }}
              name="Actual"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Divergence Flags */}
      {divergenceFlags.length > 0 && (
        <div className="border border-border bg-card p-4 space-y-2">
          <h3 className="text-sm font-semibold tracking-wide text-foreground">
            DIVERGENCE FLAGS
          </h3>
          {divergenceFlags.map((flag, i) => (
            <div
              key={i}
              className={`flex items-center justify-between px-3 py-2 border text-xs font-mono ${
                flag.severity === "critical"
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : "border-warning/50 bg-warning/10 text-warning"
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{flag.message}</span>
              </div>
              {flag.chapter && onReviewChapter && (
                <button
                  onClick={() => onReviewChapter(flag.chapter!)}
                  className="flex items-center gap-1 px-2 py-1 text-xs border border-current hover:bg-foreground/10 transition-colors"
                >
                  REVIEW CHAPTER <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Analysis Summary */}
      {analysis.issues.length > 0 && (
        <div className="border border-border bg-card p-4">
          <h3 className="text-sm font-semibold tracking-wide text-foreground mb-2">
            ANALYSIS ISSUES
          </h3>
          <ul className="space-y-1">
            {analysis.issues.map((issue, i) => (
              <li key={i} className="text-xs text-muted-foreground font-mono">
                • {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
