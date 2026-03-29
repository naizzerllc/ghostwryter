import { useSyncExternalStore } from "react";
import { getSessionSummary, subscribe } from "@/api/sessionCostTracker";

const useSessionCost = () =>
  useSyncExternalStore(subscribe, getSessionSummary, getSessionSummary);

const TokenEconomyPanel = () => {
  const summary = useSessionCost();

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
      {summary.call_count === 0 && (
        <p className="text-xs text-muted-foreground">No API calls this session</p>
      )}
      {summary.entries.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border">
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
