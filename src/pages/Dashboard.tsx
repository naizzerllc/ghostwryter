import { useEffect, useState, useSyncExternalStore, useCallback } from "react";
import { getSecurityLog, type SecurityEvent } from "@/security/sanitizer";
import { getSessionSummary, subscribe, type SessionCostSummary } from "@/api/sessionCostTracker";
import STYLE_PROFILES from "@/constants/STYLE_PROFILES.json";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  subscribe as memoryCoreSubscribe,
  getSnapshot as memoryCoreSnapshot,
  proposeUpdate,
  confirmUpdate,
  rejectUpdate,
  type MemoryCoreSnapshot,
} from "@/modules/memoryCore/memoryCore";
import { MEMORY_CORE_CONFIG } from "@/constants/MEMORY_CORE_CONFIG";

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

const useMemoryCore = (): MemoryCoreSnapshot => {
  return useSyncExternalStore(memoryCoreSubscribe, memoryCoreSnapshot, memoryCoreSnapshot);
};

const MemoryCorePanel = () => {
  const snap = useMemoryCore();
  const profiles = MEMORY_CORE_CONFIG.profiles;
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (!snap.staged) return;
    setConfirming(true);
    await confirmUpdate(snap.staged.projectId);
    setConfirming(false);
  }, [snap.staged]);

  const handleReject = useCallback(() => {
    if (!snap.staged) return;
    rejectUpdate(snap.staged.projectId);
  }, [snap.staged]);

  const statusColor =
    snap.status === "READY" ? "text-success" :
    snap.status === "PENDING_CONFIRMATION" ? "text-warning" :
    "text-muted-foreground";

  return (
    <div className="space-y-3">
      {/* Status */}
      <div className="flex justify-between items-baseline">
        <span className={`text-sm font-mono ${statusColor}`}>{snap.status}</span>
        {snap.lastUpdated && (
          <span className="text-[10px] font-mono text-muted-foreground">
            Last: {new Date(snap.lastUpdated).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* DEV TEST — remove after verification */}
      {snap.status === "READY" && (
        <button
          onClick={() => proposeUpdate("test-project", { chapter: 1, notes: "Test staged update" })}
          className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          [DEV] Stage Test Update
        </button>
      )}

      {/* Three profiles */}
      <div className="space-y-2">
        {Object.entries(profiles).map(([key, profile]) => {
          const p = profile as { hard_ceiling: number; label: string; target_budget?: number; tiers?: Record<string, { budget: number; label: string }> };
          return (
            <div key={key} className="border border-border p-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-mono font-semibold">{key}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{p.hard_ceiling.toLocaleString()}T ceiling</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{p.label}</p>
              {p.tiers && (
                <div className="mt-2 space-y-1">
                  {Object.entries(p.tiers).map(([tierKey, tier]) => (
                    <div key={tierKey} className="flex justify-between text-[10px] font-mono">
                      <span className="text-muted-foreground">{tierKey}: {tier.label}</span>
                      <span className="text-foreground">{tier.budget}T</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm / Reject buttons */}
      {snap.status === "PENDING_CONFIRMATION" && snap.staged && (
        <div className="border border-warning/50 bg-warning/5 p-3 space-y-2">
          <p className="text-xs font-mono text-warning">
            Staged update for: {snap.staged.projectId}
          </p>
          <p className="text-[10px] font-mono text-muted-foreground">
            Staged at: {new Date(snap.staged.stagedAt).toLocaleTimeString()}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider border border-success text-success hover:bg-success/10 transition-colors disabled:opacity-50"
            >
              {confirming ? "Committing…" : "Confirm"}
            </button>
            <button
              onClick={handleReject}
              className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
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
  const activeProfile = STYLE_PROFILES.profiles[STYLE_PROFILES.active_profile as keyof typeof STYLE_PROFILES.profiles];

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
                <p className="text-sm font-mono">4 / 28</p>
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
            <p className="text-sm text-foreground">Session 4 complete. Prose DNA + Style + Forbidden Words.</p>
            <p className="text-xs text-muted-foreground">
              PROSE_DNA.md · PROSE_DNA_RUNTIME · STYLE_PROFILES · FORBIDDEN_WORDS · forbiddenWordsChecker
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

      {/* STYLE LAYER + PROSE DNA */}
      <div className="grid grid-cols-2 gap-4">
        <Panel title="Style Layer">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Profile</p>
                <p className="text-sm font-mono">{STYLE_PROFILES.active_profile}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Tone</p>
                <p className="text-sm font-mono">{activeProfile.tone_register}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">POV / Tense</p>
                <p className="text-sm font-mono">{activeProfile.pov} · {activeProfile.tense}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Brand Lock</p>
                <p className="text-sm font-mono text-primary">{activeProfile.brand_lock ? "LOCKED" : "UNLOCKED"}</p>
              </div>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <button className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider border border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors">
                  View Profile
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-mono text-sm uppercase tracking-widest">Style Profile — {STYLE_PROFILES.active_profile}</DialogTitle>
                </DialogHeader>
                <pre className="text-xs font-mono text-foreground bg-muted/30 p-4 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(activeProfile, null, 2)}
                </pre>
              </DialogContent>
            </Dialog>
          </div>
        </Panel>

        <Panel title="Prose DNA">
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-mono">v2.3 — 17 rules</span>
              <span className="text-[10px] font-mono text-primary uppercase tracking-widest">Hardcoded Active</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Injection scope: generation_protagonist · anti_ai_detection_secondary
            </p>
            <p className="text-xs text-muted-foreground">
              Never injected into quality analysis calls
            </p>
          </div>
        </Panel>
      </div>

      {/* MEMORY CORE + TOKEN ECONOMY */}
      <div className="grid grid-cols-2 gap-4">
        <Panel title="Memory Core">
          <MemoryCorePanel />
        </Panel>

        <Panel title="Token Economy">
          <TokenEconomyPanel />
        </Panel>
      </div>

      {/* SECURITY LOG */}
      <Panel title="Security Log">
        <SecurityLogPanel />
      </Panel>
    </div>
  );
};

export default Dashboard;
