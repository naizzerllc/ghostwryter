import { useState, useEffect } from "react";
import { SectionHeader } from "../SectionHeader";
import { ResetButton } from "../ResetButton";

const LS_KEY = "ghostly_model_overrides";

interface ProviderSlot {
  id: string;
  name: string;
  alias: string;
  tasks: string[];
}

const PROVIDER_SLOTS: ProviderSlot[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    alias: "claude-sonnet-latest",
    tasks: ["generation_protagonist", "anti_ai_detection_secondary"],
  },
  {
    id: "gemini_pro",
    name: "Gemini Pro",
    alias: "gemini-2.0-pro-latest",
    tasks: ["generation_antagonist", "generation_supporting"],
  },
  {
    id: "gemini_flash",
    name: "Gemini Flash",
    alias: "gemini-2.0-flash-latest",
    tasks: [
      "anti_ai_detection",
      "quality_analysis",
      "continuity_check",
      "living_state_update",
      "revision_scope",
      "misdirection_erosion_check",
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    alias: "gpt-4o",
    tasks: ["reader_simulation"],
  },
];

export const ModelConfigSection = () => {
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setOverrides(parsed);
      }
    } catch {}
  }, []);

  const handlePin = (id: string) => {
    const val = inputs[id]?.trim();
    if (!val) return;
    const next = { ...overrides, [id]: val };
    setOverrides(next);
    setInputs((p) => ({ ...p, [id]: "" }));
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    setSavedId(id);
    setTimeout(() => setSavedId(null), 2000);
  };

  const handleClear = (id: string) => {
    const next = { ...overrides };
    delete next[id];
    setOverrides(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  };

  return (
    <div className="py-6">
      <SectionHeader title="Model Configuration" />
      <p className="text-[10px] font-mono text-muted-foreground mb-4 leading-relaxed">
        Ghostly always uses the latest available model for each provider slot.
        Pinning a version is only needed for reproducibility testing. When in
        doubt, leave blank.
      </p>
      <div className="space-y-3">
        {PROVIDER_SLOTS.map((slot) => {
          const isPinned = !!overrides[slot.id];
          return (
            <div
              key={slot.id}
              className="border border-border bg-card p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-mono text-foreground font-medium">
                    {slot.name}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground ml-3">
                    {slot.alias}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 ${
                    isPinned
                      ? "bg-warning/20 text-warning"
                      : "bg-success/20 text-success"
                  }`}
                >
                  {isPinned ? `PINNED: ${overrides[slot.id]}` : "AUTO-LATEST"}
                </span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">
                Tasks: {slot.tasks.join(", ")}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputs[slot.id] || ""}
                  onChange={(e) =>
                    setInputs((p) => ({ ...p, [slot.id]: e.target.value }))
                  }
                  placeholder="Paste version string to pin…"
                  className="flex-1 bg-[hsl(233,40%,11%)] border border-[hsl(233,20%,20%)] px-3 py-1.5 text-xs text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
                <button
                  onClick={() => handlePin(slot.id)}
                  disabled={!inputs[slot.id]?.trim()}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-[10px] font-mono uppercase disabled:opacity-30 hover:bg-primary/80 transition-colors"
                >
                  Pin
                </button>
                <button
                  onClick={() => handleClear(slot.id)}
                  disabled={!isPinned}
                  className="px-3 py-1.5 border border-border text-[10px] font-mono uppercase text-muted-foreground disabled:opacity-30 hover:text-foreground transition-colors"
                >
                  Clear Override
                </button>
              </div>
              {savedId === slot.id && (
                <p className="text-[10px] font-mono text-success">Saved</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
