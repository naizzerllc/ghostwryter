import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import StatusBar from "./StatusBar";

// ── Generation pause state (exported for use by generation modules) ─────
let generationPaused = false;
export function isGenerationPaused(): boolean {
  return generationPaused;
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

const DisconnectionBanner = () => {
  const [show, setShow] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);

  // Check connection on every mount (page load)
  useEffect(() => {
    const token = localStorage.getItem("ghostly_github_token");
    const owner = localStorage.getItem("ghostly_github_owner");

    // If GitHub was never configured, no banner
    if (!token || !owner) return;

    // Check if previously dismissed with risk in this session
    const savedState = getBannerState();
    if (savedState === "dismissed_with_risk") {
      setRiskAcknowledged(true);
      // Still mark generation as paused
      generationPaused = true;
      return;
    }

    // Test connection
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

  // Listen for runtime disconnection events
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
    // Re-test connection
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
    setRiskAcknowledged(true);
    setBannerState("dismissed_with_risk");
    // Generation remains paused — banner just hides visually
  }, []);

  if (!show || riskAcknowledged) return null;

  return (
    <div className="bg-destructive border-b border-destructive/50 px-4 py-2.5 flex items-center gap-3 shrink-0">
      <div className="flex-1">
        <p className="text-xs font-mono text-destructive-foreground font-semibold">
          GITHUB DISCONNECTED — GENERATION PAUSED
        </p>
        <p className="text-[10px] font-mono text-destructive-foreground/80 mt-0.5">
          Writing in LOCAL MODE. Data will be lost if you clear cache. Generation calls are blocked until reconnected.
        </p>
      </div>
      <button
        onClick={handleReconnect}
        className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-destructive-foreground/20 text-destructive-foreground hover:bg-destructive-foreground/30 transition-colors whitespace-nowrap"
      >
        Reconnect
      </button>
      <button
        onClick={handleExportBackup}
        className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-destructive-foreground/20 text-destructive-foreground hover:bg-destructive-foreground/30 transition-colors whitespace-nowrap"
      >
        Export Local Backup
      </button>
      <button
        onClick={handleDismissWithRisk}
        className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-destructive-foreground/10 text-destructive-foreground/70 hover:bg-destructive-foreground/20 transition-colors whitespace-nowrap"
      >
        Dismiss with Risk Acknowledgement
      </button>
    </div>
  );
};

const AppLayout = () => {
  return (
    <div className="flex h-screen w-screen min-w-[1280px] overflow-hidden">
      {/* Zone 1: Sidebar */}
      <Sidebar />

      {/* Zone 2 + 3: Main + Status Bar */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Disconnection Banner — persistent, reappears on page load */}
        <DisconnectionBanner />

        {/* Zone 2: Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>

        {/* Zone 3: Status Bar */}
        <StatusBar />
      </div>
    </div>
  );
};

export default AppLayout;
