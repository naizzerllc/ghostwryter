import { useState } from "react";
import { RotateCcw } from "lucide-react";

export const ResetButton = ({ onReset }: { onReset: () => void }) => {
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed) {
    return (
      <span className="inline-flex items-center gap-2 text-[10px] font-mono text-success animate-pulse">
        DEFAULTS RESTORED
      </span>
    );
  }

  return (
    <button
      onClick={() => {
        onReset();
        setConfirmed(true);
        setTimeout(() => setConfirmed(false), 2000);
      }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
    >
      <RotateCcw className="w-3 h-3" />
      Reset to Defaults
    </button>
  );
};
