import { useState, useEffect } from "react";
import { Circle } from "lucide-react";

interface StatusItem {
  label: string;
  value: string;
  status: "connected" | "disconnected" | "pending";
}

const statusColorMap: Record<StatusItem["status"], string> = {
  connected: "text-success",
  disconnected: "text-destructive",
  pending: "text-warning",
};

const StatusBar = () => {
  const [githubConnected, setGithubConnected] = useState(false);
  const [lastModel, setLastModel] = useState<{ model: string; provider: string } | null>(null);

  useEffect(() => {
    const ghHandler = (e: Event) => {
      const detail = (e as CustomEvent<{ connected: boolean }>).detail;
      setGithubConnected(detail.connected);
    };
    const llmHandler = (e: Event) => {
      const detail = (e as CustomEvent<{ model: string; provider: string; taskType: string }>).detail;
      setLastModel({ model: detail.model, provider: detail.provider });
    };
    window.addEventListener("ghostly:github-status", ghHandler);
    window.addEventListener("ghostly:llm-call", llmHandler);
    return () => {
      window.removeEventListener("ghostly:github-status", ghHandler);
      window.removeEventListener("ghostly:llm-call", llmHandler);
    };
  }, []);

  const items: StatusItem[] = [
    { label: "PROSE DNA", value: "v2.3", status: "connected" },
    { label: "STYLE", value: "leila_rex_default", status: "connected" },
    { label: "PROJECT", value: "None", status: "disconnected" },
    { label: "MEMORY CORE", value: "Idle", status: "pending" },
    {
      label: "GITHUB",
      value: githubConnected ? "Connected" : "Not connected",
      status: githubConnected ? "connected" : "disconnected",
    },
    {
      label: "LAST LLM",
      value: lastModel ? lastModel.model : "—",
      status: lastModel ? "connected" : "pending",
    },
  ];

  return (
    <footer className="h-8 min-h-[32px] bg-sidebar border-t border-sidebar-border flex items-center px-4 gap-6 overflow-x-auto">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 shrink-0">
          <Circle className={`w-2 h-2 fill-current ${statusColorMap[item.status]}`} />
          <span className="text-[10px] font-mono text-muted-foreground uppercase">
            {item.label}
          </span>
          <span className="text-[10px] font-mono text-foreground">{item.value}</span>
        </div>
      ))}
    </footer>
  );
};

export default StatusBar;
