import { Circle } from "lucide-react";

interface StatusItem {
  label: string;
  value: string;
  status: "connected" | "disconnected" | "pending";
}

const STATUS_ITEMS: StatusItem[] = [
  { label: "PROSE DNA", value: "v2.3", status: "connected" },
  { label: "STYLE", value: "leila_rex_default", status: "connected" },
  { label: "PROJECT", value: "None", status: "disconnected" },
  { label: "MEMORY CORE", value: "Idle", status: "pending" },
  { label: "GITHUB", value: "Not connected", status: "disconnected" },
  { label: "LAST LLM", value: "—", status: "pending" },
];

const statusColorMap: Record<StatusItem["status"], string> = {
  connected: "text-success",
  disconnected: "text-destructive",
  pending: "text-warning",
};

const StatusBar = () => {
  return (
    <footer className="h-8 min-h-[32px] bg-sidebar border-t border-sidebar-border flex items-center px-4 gap-6 overflow-x-auto">
      {STATUS_ITEMS.map((item) => (
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
