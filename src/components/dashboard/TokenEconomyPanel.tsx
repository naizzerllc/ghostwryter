import { useSyncExternalStore, useMemo } from "react";
import { getSessionSummary, subscribe } from "@/api/sessionCostTracker";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getAllChapters } from "@/modules/outline/outlineSystem";

const useSessionCost = () =>
  useSyncExternalStore(subscribe, getSessionSummary, getSessionSummary);

const COST_PER_1M: Record<string, { input: number; output: number; label: string }> = {
  anthropic:    { input: 3.00,  output: 15.00, label: "Anthropic" },
  gemini_pro:   { input: 1.25,  output: 5.00,  label: "Gemini Pro" },
  gemini_flash: { input: 0.075, output: 0.30,  label: "Gemini Flash" },
  openai:       { input: 2.50,  output: 10.00, label: "OpenAI" },
};

const PROVIDERS = ["anthropic", "gemini_pro", "gemini_flash", "openai"] as const;

const TokenEconomyPanel = () => {
  const summary = useSessionCost();

  const providerBreakdown = useMemo(() => {
    const map: Record<string, { tokens: number; calls: number; cost: number }> = {};
    for (const p of PROVIDERS) {
      map[p] = { tokens: 0, calls: 0, cost: 0 };
    }
    for (const e of summary.entries) {
      const bucket = map[e.provider] ?? (map[e.provider] = { tokens: 0, calls: 0, cost: 0 });
      bucket.tokens += e.tokens_used;
      bucket.calls += 1;
      const rates = COST_PER_1M[e.provider] ?? COST_PER_1M.openai;
      bucket.cost +=
        (e.tokens_used * 0.6 / 1_000_000) * rates.input +
        (e.tokens_used * 0.4 / 1_000_000) * rates.output;
    }
    return map;
  }, [summary]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Tokens Used</p>
          <p className="text-sm font-mono">{summary.total_tokens.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Cache Saved</p>
          <p className="text-sm font-mono text-success">{summary.total_saved.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Est. Cost</p>
          <p className="text-sm font-mono">${summary.estimated_cost_usd.toFixed(4)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">API Calls</p>
          <p className="text-sm font-mono">{summary.call_count}</p>
        </div>
      </div>

      {/* Per-provider breakdown */}
      {summary.call_count > 0 && (
        <div className="pt-2 border-t border-border space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Provider Breakdown</p>
          {PROVIDERS.map((p) => {
            const data = providerBreakdown[p];
            if (data.calls === 0) return null;
            const pct = summary.total_tokens > 0
              ? Math.round((data.tokens / summary.total_tokens) * 100)
              : 0;
            return (
              <div key={p} className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-foreground">{COST_PER_1M[p].label}</span>
                  <span className="text-muted-foreground">{data.calls} calls</span>
                  <span className="text-foreground">{data.tokens.toLocaleString()}T</span>
                  <span className="text-muted-foreground">${data.cost.toFixed(4)}</span>
                </div>
                <div className="h-1 bg-muted/30 w-full">
                  <div
                    className="h-full bg-primary/60 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manuscript cost projection */}
      {(() => {
        const chapters = getAllChapters();
        const totalChapters = chapters.length;
        const genEntries = summary.entries.filter((e) =>
          e.call_type.startsWith("generation_") ||
          e.call_type === "quality_analysis" ||
          e.call_type === "anti_ai_detection" ||
          e.call_type === "anti_ai_detection_secondary" ||
          e.call_type === "reader_simulation" ||
          e.call_type === "continuity_check"
        );
        // Count unique chapters generated (approximate: group by rough time windows)
        const chaptersGenerated = summary.call_count > 0
          ? Math.max(1, Math.round(genEntries.length / Math.max(summary.call_count, 1) * summary.call_count / 6))
          : 0;
        const avgCostPerChapter = chaptersGenerated > 0
          ? summary.estimated_cost_usd / chaptersGenerated
          : null;

        return (
          <div className="pt-2 border-t border-border space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Manuscript Projection</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Outline Chapters</p>
                <p className="text-sm font-mono">{totalChapters || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg / Chapter</p>
                <p className="text-sm font-mono">
                  {avgCostPerChapter !== null ? `$${avgCostPerChapter.toFixed(4)}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Projected Total</p>
                <p className="text-sm font-mono text-warning">
                  {avgCostPerChapter !== null && totalChapters > 0
                    ? `$${(avgCostPerChapter * totalChapters).toFixed(2)}`
                    : "—"}
                </p>
              </div>
            </div>
            {totalChapters === 0 && (
              <p className="text-[10px] text-muted-foreground">Import an outline to enable projection</p>
            )}
            {totalChapters > 0 && avgCostPerChapter === null && (
              <p className="text-[10px] text-muted-foreground">Generate a chapter to calculate projection</p>
            )}
          </div>
        );
      })()}

      {summary.call_count === 0 && (
        <p className="text-xs text-muted-foreground">No API calls this session</p>
      )}

      {/* Recent calls */}
      {summary.entries.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Recent Calls</p>
          {summary.entries.slice(-5).map((e, i) => (
            <div key={`${e.timestamp}-${i}`} className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-muted-foreground">{e.call_type}</span>
              <span className="text-foreground">{e.tokens_used.toLocaleString()}T</span>
              <span className="text-muted-foreground">{e.provider}</span>
              {e.saved_tokens > 0 && (
                <span className="text-success">-{e.saved_tokens.toLocaleString()}T cached</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TokenEconomyPanel;
