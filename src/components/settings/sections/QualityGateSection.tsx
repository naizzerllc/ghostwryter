import { useState, useEffect } from "react";
import { SectionHeader } from "../SectionHeader";
import { ResetButton } from "../ResetButton";

const LS_KEY = "ghostly_quality_overrides";

interface QualityOverrides {
  approvalThreshold: number;
  reviewThreshold: number;
  maxRevisionLoops: number;
  generationFloor: number;
}

const DEFAULTS: QualityOverrides = {
  approvalThreshold: 8.0,
  reviewThreshold: 7.0,
  maxRevisionLoops: 3,
  generationFloor: 4.0,
};

export const QualityGateSection = () => {
  const [values, setValues] = useState<QualityOverrides>(DEFAULTS);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setValues({ ...DEFAULTS, ...JSON.parse(stored) });
    } catch {}
  }, []);

  const update = (key: keyof QualityOverrides, val: number) => {
    const next = { ...values, [key]: val };

    if (next.reviewThreshold >= next.approvalThreshold) {
      setError("Review threshold must be less than approval threshold");
      setValues(next);
      return;
    }

    setError("");
    setValues(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setValues(DEFAULTS);
    setError("");
    localStorage.removeItem(LS_KEY);
  };

  const SliderField = ({
    label,
    field,
    min,
    max,
    step,
  }: {
    label: string;
    field: keyof QualityOverrides;
    min: number;
    max: number;
    step: number;
  }) => (
    <div className="space-y-1">
      <div className="flex justify-between">
        <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          {label}
        </label>
        <span className="text-xs font-mono text-foreground">
          {values[field]}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={values[field]}
        onChange={(e) => update(field, parseFloat(e.target.value))}
        className="w-full h-1 bg-muted appearance-none cursor-pointer accent-primary"
      />
    </div>
  );

  return (
    <div className="py-6">
      <SectionHeader title="Quality Gate" />
      <div className="space-y-4">
        <SliderField
          label="Approval Threshold"
          field="approvalThreshold"
          min={6.0}
          max={10.0}
          step={0.1}
        />
        <SliderField
          label="Review Threshold"
          field="reviewThreshold"
          min={5.0}
          max={9.0}
          step={0.1}
        />
        <SliderField
          label="Max Revision Loops"
          field="maxRevisionLoops"
          min={1}
          max={5}
          step={1}
        />
        <SliderField
          label="Generation Floor"
          field="generationFloor"
          min={2.0}
          max={6.0}
          step={0.1}
        />
        {error && (
          <p className="text-[10px] font-mono text-destructive">{error}</p>
        )}
        {saved && (
          <p className="text-[10px] font-mono text-success">Saved</p>
        )}
      </div>
    </div>
  );
};
