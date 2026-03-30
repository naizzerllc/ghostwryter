import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import StatusBar from "./StatusBar";

// ── Generation pause state (exported for use by generation modules) ─────
let generationPaused = false;
export function isGenerationPaused(): boolean {
  return generationPaused;
}

/**
 * Call before any generation call. Returns true if generation can proceed.
 * If disconnected, dispatches event to show the pause modal.
 */
export function requestGeneration(): Promise<boolean> {
  if (!generationPaused) return Promise.resolve(true);
  return new Promise((resolve) => {
    const handler = (e: Event) => {
      window.removeEventListener("ghostly:generation-decision", handler);
      resolve((e as CustomEvent<{ proceed: boolean }>).detail.proceed);
    };
    window.addEventListener("ghostly:generation-decision", handler);
    window.dispatchEvent(new CustomEvent("ghostly:show-generation-pause-modal"));
  });
}

// ── Disconnection banner state persisted in sessionStorage ──────────────
const BANNER_KEY = "ghostly_disconnect_banner_state";

type BannerState = "visible" | "dismissed_with_risk" | "hidden";

function getBannerState(): BannerState {
  return (sessionStorage.getItem(BANNER_KEY) as BannerState) || "hidden";
}

function setBannerState(state: BannerState) {
  sessionStorage.setItem(BANNER_KEY, state);
}

// ── Generation Pause Modal ──────────────────────────────────────────────

const GenerationPauseModal = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener("ghostly:show-generation-pause-modal", handler);
    return () => window.removeEventListener("ghostly:show-generation-pause-modal", handler);
  }, []);

  const decide = (proceed: boolean) => {
    setShow(false);
    window.dispatchEvent(new CustomEvent("ghostly:generation-decision", { detail: { proceed } }));
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="border border-destructive bg-card p-6 max-w-md w-full space-y-4">
        <h3 className="text-sm font-mono uppercase tracking-wider text-destructive font-semibold">
          GitHub Disconnected — Generation Paused
        </h3>
        <p className="text-xs font-mono text-muted-foreground leading-relaxed">
          Generated chapters cannot be saved to GitHub. Continue in local mode?
          Chapters generated locally will be flagged <span className="text-warning">storage_mode: 'local'</span> on
          the approved_chapter_record.
        </p>
        <div className="flex gap-3">
          <button onClick={() => decide(true)}
            className="flex-1 px-3 py-2 text-[10px] font-mono uppercase tracking-wider border border-warning text-warning hover:bg-warning/10 transition-colors">
            Continue Local
          </button>
          <button onClick={() => decide(false)}
            className="flex-1 px-3 py-2 text-[10px] font-mono uppercase tracking-wider border border-primary text-primary hover:bg-primary/10 transition-colors">
            Reconnect First
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Dismiss Confirmation Dialog ─────────────────────────────────────────

const DismissConfirmDialog = ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
    <div className="border border-destructive bg-card p-6 max-w-sm w-full space-y-4">
      <h3 className="text-sm font-mono uppercase tracking-wider text-destructive font-semibold">
        Acknowledge Risk
      </h3>
      <p className="text-xs font-mono text-muted-foreground leading-relaxed">
        Local data will be lost if you clear cache. I accept this risk.
      </p>
      <div className="flex gap-3">
        <button onClick={onConfirm}
          className="flex-1 px-3 py-2 text-[10px] font-mono uppercase tracking-wider border border-destructive text-destructive hover:bg-destructive/10 transition-colors">
          I Accept the Risk
        </button>
        <button onClick={onCancel}
          className="flex-1 px-3 py-2 text-[10px] font-mono uppercase tracking-wider border border-border text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>
    </div>
  </div>
);

// ── Disconnection Banner ────────────────────────────────────────────────

const DisconnectionBanner = () => {
  const [show, setShow] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);

  // Check connection on every mount (page load)
  useEffect(() => {
    const token = localStorage.getItem("ghostly_github_token");
    const owner = localStorage.getItem("ghostly_github_owner");

    if (!token || !owner) return;

    const savedState = getBannerState();
    if (savedState === "dismissed_with_risk") {
      setRiskAcknowledged(true);
      generationPaused = true;
      return;
    }

    const testConnection = async () => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(owner)}/ghostly-data`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
            },
          },
        );
        if (!res.ok) {
          setShow(true);
          generationPaused = true;
          setBannerState("visible");
        } else {
          setShow(false);
          generationPaused = false;
          setBannerState("hidden");
        }
      } catch {
        setShow(true);
        generationPaused = true;
        setBannerState("visible");
      }
    };

    testConnection();
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ connected: boolean }>).detail;
      if (!detail.connected) {
        setShow(true);
        setRiskAcknowledged(false);
        generationPaused = true;
        setBannerState("visible");
      } else {
        setShow(false);
        setRiskAcknowledged(false);
        generationPaused = false;
        setBannerState("hidden");
      }
    };
    window.addEventListener("ghostly:github-status", handler);
    return () => window.removeEventListener("ghostly:github-status", handler);
  }, []);

  const handleReconnect = useCallback(async () => {
    window.dispatchEvent(new CustomEvent("ghostly:github-reconnect"));
    const token = localStorage.getItem("ghostly_github_token");
    const owner = localStorage.getItem("ghostly_github_owner");
    if (token && owner) {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(owner)}/ghostly-data`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
            },
          },
        );
        if (res.ok) {
          setShow(false);
          generationPaused = false;
          setBannerState("hidden");
          window.dispatchEvent(
            new CustomEvent("ghostly:github-status", { detail: { connected: true } }),
          );
        }
      } catch {
        // still disconnected
      }
    }
  }, []);

  const handleExportBackup = useCallback(() => {
    const backup: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("ghostly_file_")) {
        backup[key] = localStorage.getItem(key) || "";
      }
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ghostly-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleDismissWithRisk = useCallback(() => {
    setShowDismissConfirm(true);
  }, []);

  const confirmDismiss = useCallback(() => {
    setRiskAcknowledged(true);
    setShowDismissConfirm(false);
    setBannerState("dismissed_with_risk");
  }, []);

  if (!show || riskAcknowledged) return null;

  return (
    <>
      {showDismissConfirm && (
        <DismissConfirmDialog
          onConfirm={confirmDismiss}
          onCancel={() => setShowDismissConfirm(false)}
        />
      )}
      <div className="bg-destructive border-b border-destructive/50 px-4 py-2.5 flex items-center gap-3 shrink-0">
        <div className="flex-1">
          <p className="text-xs font-mono text-destructive-foreground font-semibold">
            GITHUB DISCONNECTED — GENERATION PAUSED
          </p>
          <p className="text-[10px] font-mono text-destructive-foreground/80 mt-0.5">
            Writing in LOCAL MODE. Data will be lost if you clear cache. Generation calls are blocked until reconnected.
          </p>
        </div>
        <button onClick={handleReconnect}
          className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-destructive-foreground/20 text-destructive-foreground hover:bg-destructive-foreground/30 transition-colors whitespace-nowrap">
          Reconnect
        </button>
        <button onClick={handleExportBackup}
          className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-destructive-foreground/20 text-destructive-foreground hover:bg-destructive-foreground/30 transition-colors whitespace-nowrap">
          Export Local Backup
        </button>
        <button onClick={handleDismissWithRisk}
          className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-destructive-foreground/10 text-destructive-foreground/70 hover:bg-destructive-foreground/20 transition-colors whitespace-nowrap">
          Dismiss — I Understand the Risk
        </button>
      </div>
    </>
  );
};

const AppLayout = () => {
  return (
    <div className="flex h-screen w-screen min-w-[1280px] overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <DisconnectionBanner />
        <GenerationPauseModal />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
        <StatusBar />
      </div>
    </div>
  );
};

export default AppLayout;
