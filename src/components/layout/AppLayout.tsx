import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import StatusBar from "./StatusBar";

const DisconnectionBanner = () => {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ connected: boolean }>).detail;
      if (!detail.connected) {
        setShow(true);
        setDismissed(false);
      } else {
        setShow(false);
      }
    };
    window.addEventListener("ghostly:github-status", handler);
    return () => window.removeEventListener("ghostly:github-status", handler);
  }, []);

  // Reappear on every page load if not connected
  useEffect(() => {
    if (dismissed) return;
    const token = localStorage.getItem("ghostly_github_token");
    const owner = localStorage.getItem("ghostly_github_owner");
    if (!token || !owner) {
      // Don't show banner if user hasn't configured GitHub at all
      return;
    }
  }, [dismissed]);

  if (!show || dismissed) return null;

  return (
    <div className="bg-destructive border-b border-destructive/50 px-4 py-2 flex items-center gap-4 shrink-0">
      <span className="text-xs font-mono text-destructive-foreground flex-1">
        GITHUB DISCONNECTED — Writing in LOCAL MODE. Data will be lost if you clear cache.
      </span>
      <button
        onClick={() => {
          window.dispatchEvent(new CustomEvent("ghostly:github-reconnect"));
          setDismissed(true);
        }}
        className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider bg-destructive-foreground/20 text-destructive-foreground hover:bg-destructive-foreground/30 transition-colors"
      >
        Reconnect
      </button>
      <button
        onClick={() => {
          // Export all ghostly_file_ entries
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
        }}
        className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider bg-destructive-foreground/20 text-destructive-foreground hover:bg-destructive-foreground/30 transition-colors"
      >
        Export Local Backup
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider bg-destructive-foreground/10 text-destructive-foreground/80 hover:bg-destructive-foreground/20 transition-colors"
      >
        Dismiss — I understand the risk
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
        {/* Disconnection Banner */}
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
