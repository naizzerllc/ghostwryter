import { useEffect, useState, useSyncExternalStore } from "react";
import { getSecurityLog, type SecurityEvent } from "@/security/sanitizer";
import { getSessionSummary, subscribe, type SessionCostSummary } from "@/api/sessionCostTracker";
import STYLE_PROFILES from "@/constants/STYLE_PROFILES.json";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const MODULE_REGISTRY = Array.from({ length: 28 }, (_, i) => ({
  id: i + 1,
  label: `Session ${String(i + 1).padStart(2, "0")}`,
  status: i === 0 ? "ACTIVE" : "PENDING",
}));

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border border-border bg-card">
    <div className="px-4 py-2 border-b border-border">
      <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{title}</h2>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const SecurityLogPanel = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);

  useEffect(() => {
    // Poll every 2 seconds for new events
    const update = () => setEvents(getSecurityLog().slice(0, 5));
    update();
    const interval = setInterval(update, 2000);
    return () => clearInterval(interval);
  }, []);

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No security events</p>;
  }

  return (
    <div className="space-y-2">
      {events.map((event, i) => (
        <div key={`${event.timestamp}-${i}`} className="border border-destructive/30 bg-destructive/5 p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-destructive uppercase">{event.severity}</span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-xs font-mono text-foreground mt-1">
            Field: <span className="text-destructive">{event.field}</span>
          </p>
          <p className="text-[10px] font-mono text-muted-foreground">
            Patterns: {event.patterns.join(", ")}
          </p>
        </div>
      ))}
    </div>
  );
};

const useSessionCost = (): SessionCostSummary => {
  return useSyncExternalStore(
    subscribe,
    getSessionSummary,
    getSessionSummary
  );
};

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

const Dashboard = () => {
  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-xl font-semibold tracking-wide">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4">
        {/* ENGINE STATUS */}
        <Panel title="Engine Status">
          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-2xl font-bold tracking-wide">GHOSTLY</span>
              <span className="text-xs font-mono text-muted-foreground">AI Fiction Production Platform</span>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Version</p>
                <p className="text-sm font-mono">2.2.0</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Build</p>
                <p className="text-sm font-mono">3 / 28</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</p>
                <p className="text-sm font-mono text-warning">Foundation</p>
              </div>
            </div>
          </div>
        </Panel>

        {/* BUILD NOTES */}
        <Panel title="Build Notes">
          <div className="space-y-2">
            <p className="text-sm text-foreground">Session 3 complete. LLM Router + Prompt Caching.</p>
            <p className="text-xs text-muted-foreground">
              LLM Router · callAnthropic · Prompt Caching · Token Economy · Session Cost Tracker
            </p>
          </div>
        </Panel>
      </div>

      {/* MODULE REGISTRY */}
      <Panel title="Module Registry">
        <div className="grid grid-cols-7 gap-2">
          {MODULE_REGISTRY.map((mod) => (
            <div
              key={mod.id}
              className={`border p-2 text-center ${
                mod.status === "ACTIVE"
                  ? "border-primary bg-primary/10"
                  : "border-border"
              }`}
            >
              <p className="text-xs font-mono font-semibold">
                S{String(mod.id).padStart(2, "0")}
              </p>
              <p
                className={`text-[9px] font-mono mt-1 ${
                  mod.status === "ACTIVE" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {mod.status}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      {/* TOKEN ECONOMY */}
      <Panel title="Token Economy">
        <TokenEconomyPanel />
      </Panel>

      {/* SECURITY LOG */}
      <Panel title="Security Log">
        <SecurityLogPanel />
      </Panel>
    </div>
  );
};

export default Dashboard;
