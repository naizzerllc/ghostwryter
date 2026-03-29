import { useState, useCallback, useSyncExternalStore } from "react";
import {
  subscribe as memoryCoreSubscribe,
  getSnapshot as memoryCoreSnapshot,
  confirmUpdate,
  rejectUpdate,
} from "@/modules/memoryCore/memoryCore";
import { MEMORY_CORE_CONFIG } from "@/constants/MEMORY_CORE_CONFIG";

const useMemoryCore = () =>
  useSyncExternalStore(memoryCoreSubscribe, memoryCoreSnapshot, memoryCoreSnapshot);

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
      <div className="flex justify-between items-baseline">
        <span className={`text-sm font-mono ${statusColor}`}>{snap.status}</span>
        {snap.lastUpdated && (
          <span className="text-[10px] font-mono text-muted-foreground">
            Last: {new Date(snap.lastUpdated).toLocaleTimeString()}
          </span>
        )}
      </div>

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

export default MemoryCorePanel;
