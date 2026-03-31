import { useState, useEffect } from "react";
import { Lock } from "lucide-react";
import { SectionHeader } from "../SectionHeader";

const LS_KEY = "ghostly_style_overrides";

interface StyleOverrides {
  chapterLengthMin: number;
  chapterLengthMax: number;
  act3LengthMin: number;
  act3LengthMax: number;
  readabilityMin: number;
  readabilityMax: number;
  prologueDramaticIrony: boolean;
}

const DEFAULTS: StyleOverrides = {
  chapterLengthMin: 1800,
  chapterLengthMax: 2800,
  act3LengthMin: 2200,
  act3LengthMax: 3200,
  readabilityMin: 6,
  readabilityMax: 9,
  prologueDramaticIrony: true,
};

const LockedField = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center gap-2 opacity-50">
    <Lock className="w-3 h-3 text-muted-foreground" />
    <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
      {label}:
    </span>
    <span className="text-xs font-mono text-foreground">{value}</span>
  </div>
);

export const StyleProfileSection = () => {
  const [overrides, setOverrides] = useState<StyleOverrides>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setOverrides({ ...DEFAULTS, ...JSON.parse(stored) });
    } catch {}
  }, []);

  const update = (key: keyof StyleOverrides, value: number | boolean) => {
    const next = { ...overrides, [key]: value };
    setOverrides(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const NumberField = ({
    label,
    field,
  }: {
    label: string;
    field: keyof StyleOverrides;
  }) => (
    <div className="space-y-1">
      <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      <input
        type="number"
        value={overrides[field] as number}
        onChange={(e) => update(field, parseInt(e.target.value) || 0)}
        className="w-full bg-[hsl(233,40%,11%)] border border-[hsl(233,20%,20%)] px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-primary"
      />
    </div>
  );

  return (
    <div className="py-6">
      <SectionHeader title="Style Profile" />
      <p className="text-[10px] font-mono text-muted-foreground mb-4 leading-relaxed">
        These are the active Leila Rex brand defaults. brand_lock is true — core
        register is immovable. Chapter length and quality thresholds are
        adjustable.
      </p>

      <div className="flex flex-wrap gap-6 mb-5">
        <LockedField label="POV" value="First Person" />
        <LockedField label="Tense" value="Present" />
        <LockedField label="Narrator Reliability" value="Unreliable" />
        <LockedField label="Brand Lock" value="ACTIVE" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <NumberField label="Chapter Length Min" field="chapterLengthMin" />
        <NumberField label="Chapter Length Max" field="chapterLengthMax" />
        <NumberField label="Act 3 Length Min" field="act3LengthMin" />
        <NumberField label="Act 3 Length Max" field="act3LengthMax" />
        <NumberField label="Readability Grade Min" field="readabilityMin" />
        <NumberField label="Readability Grade Max" field="readabilityMax" />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          Prologue Dramatic Irony
        </label>
        <button
          onClick={() =>
            update("prologueDramaticIrony", !overrides.prologueDramaticIrony)
          }
          className={`w-10 h-5 relative transition-colors ${
            overrides.prologueDramaticIrony
              ? "bg-success"
              : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 bg-foreground transition-transform ${
              overrides.prologueDramaticIrony
                ? "left-[22px]"
                : "left-0.5"
            }`}
          />
        </button>
        <span className="text-xs font-mono text-foreground">
          {overrides.prologueDramaticIrony ? "ON" : "OFF"}
        </span>
      </div>

      {saved && (
        <p className="text-[10px] font-mono text-success mt-2">Saved</p>
      )}
    </div>
  );
};
