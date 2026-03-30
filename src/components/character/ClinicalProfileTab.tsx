/**
 * Clinical Profile Tab — Guided 3-step flow for psychiatric condition selection.
 * S23 Follow-up · GHOSTLY v2.2
 */

import { useState, useMemo } from "react";
import conditionsData from "@/data/PSYCHIATRIC_CONDITIONS_DB.json";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────

interface Condition {
  condition_id: string;
  condition_name: string;
  narrative_function: string;
  surface_presentation: string;
  institutional_behaviour: string;
  control_mechanism: string;
  fear_substrate: string;
  rationalisation_pattern: string;
  verbal_tics: string[];
  behavioural_tells: string[];
  masking_behaviours: string;
  comorbidities: string;
  tropes_generated: string[];
  leila_rex_angle: string;
}

type StoryRole = "primary_threat" | "false_ally" | "victim" | "narrator";
type ReaderFeeling = "trust" | "unease" | "sympathy" | "admiration";
type Setting = "hospital" | "one_on_one" | "forensic" | "domestic";
type MaskingLevel = "LOW" | "MEDIUM" | "HIGH" | "INSTITUTIONAL_PERFECT";

interface WriterFields {
  primary_tell: string;
  role_in_story: string;
  notes: string;
  masking_level: MaskingLevel;
}

export interface PsychiatricProfile {
  condition_ids: string[];
  masking_level: MaskingLevel;
  primary_tell: string;
  role_in_story: string;
  notes: string;
}

interface ClinicalProfileTabProps {
  characterId: string | null;
  onSave?: (profile: PsychiatricProfile) => void;
}

const conditions = conditionsData as Condition[];

// ── Matching Logic ──────────────────────────────────────────────────────

function matchConditions(role: StoryRole, feeling: ReaderFeeling, setting: Setting): string[] {
  // Specific rules first
  if (role === "primary_threat" && (feeling === "trust" || feeling === "admiration") && setting === "hospital")
    return ["dark_triad_institutional", "npd", "ocpd_authority"];

  if (role === "primary_threat" && feeling === "unease" && setting === "hospital")
    return ["aspd", "dark_triad_institutional", "npd"];

  if (role === "primary_threat" && setting === "forensic")
    return ["aspd", "dark_triad_institutional", "ppd"];

  if (role === "false_ally" && feeling === "trust")
    return ["npd", "hpd", "dark_triad_institutional"];

  if (role === "false_ally" && feeling === "sympathy")
    return ["bpd_victim_presenting", "hpd", "fdia"];

  if (role === "victim" && feeling === "sympathy" && setting === "one_on_one")
    return ["fdia", "bpd_victim_presenting", "folie_a_deux"];

  if (role === "victim")
    return ["bpd_victim_presenting", "did_narrator", "folie_a_deux"];

  if (role === "narrator")
    return ["did_narrator", "bpd_victim_presenting", "ppd"];

  if (feeling === "unease" && setting === "domestic")
    return ["fdia", "folie_a_deux", "bpd_victim_presenting"];

  // Fallback: match by narrative_function keywords based on role
  const roleKeywords: Record<StoryRole, string[]> = {
    primary_threat: ["threat", "authority", "power", "control", "dominance"],
    false_ally: ["ally", "trust", "appears", "charming", "surface"],
    victim: ["victim", "sympathy", "vulnerable", "presenting"],
    narrator: ["narrator", "identity", "self", "perception"],
  };
  const keywords = roleKeywords[role];
  const scored = conditions.map(c => ({
    id: c.condition_id,
    score: keywords.reduce((s, kw) => s + (c.narrative_function.toLowerCase().includes(kw) ? 1 : 0), 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map(s => s.id);
}

function defaultMaskingLevel(role: StoryRole): MaskingLevel {
  switch (role) {
    case "primary_threat": return "HIGH";
    case "false_ally": return "HIGH";
    case "victim": return "LOW";
    case "narrator": return "HIGH";
  }
}

// ── Component ───────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: StoryRole; label: string }[] = [
  { value: "primary_threat", label: "The primary threat (antagonist)" },
  { value: "false_ally", label: "The false ally (appears safe, isn't)" },
  { value: "victim", label: "The victim who isn't what they seem" },
  { value: "narrator", label: "The narrator herself" },
];

const FEELING_OPTIONS: { value: ReaderFeeling; label: string }[] = [
  { value: "trust", label: "Trust — reader likes and believes them" },
  { value: "unease", label: "Unease they can't name — something is off but reader can't say what" },
  { value: "sympathy", label: "Sympathy — reader feels sorry for them" },
  { value: "admiration", label: "Admiration — reader is impressed by them" },
];

const SETTING_OPTIONS: { value: Setting; label: string }[] = [
  { value: "hospital", label: "Hospital or clinical hierarchy" },
  { value: "one_on_one", label: "One-on-one patient or carer relationship" },
  { value: "forensic", label: "Forensic or investigative setting" },
  { value: "domestic", label: "Domestic or family setting" },
];

const MASKING_OPTIONS: { value: MaskingLevel; label: string }[] = [
  { value: "LOW", label: "LOW: visible to most observers" },
  { value: "MEDIUM", label: "MEDIUM: visible to trained observers or those close" },
  { value: "HIGH", label: "HIGH: visible only under sustained pressure" },
  { value: "INSTITUTIONAL_PERFECT", label: "INSTITUTIONAL PERFECT: the institution protects the mask" },
];

const ClinicalProfileTab = ({ characterId, onSave }: ClinicalProfileTabProps) => {
  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [role, setRole] = useState<StoryRole | null>(null);
  const [feeling, setFeeling] = useState<ReaderFeeling | null>(null);
  const [setting, setSetting] = useState<Setting | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMoreClinical, setShowMoreClinical] = useState(false);

  // Writer fields — persist across resets
  const [writerFields, setWriterFields] = useState<WriterFields>({
    primary_tell: "",
    role_in_story: "",
    notes: "",
    masking_level: "HIGH",
  });

  const allAnswered = role !== null && feeling !== null && setting !== null;

  const matchedIds = useMemo(() => {
    if (!allAnswered) return [];
    return matchConditions(role!, feeling!, setting!);
  }, [role, feeling, setting, allAnswered]);

  const matchedConditions = useMemo(
    () => matchedIds.map(id => conditions.find(c => c.condition_id === id)).filter(Boolean) as Condition[],
    [matchedIds]
  );

  const selectedConditions = useMemo(
    () => selectedIds.map(id => conditions.find(c => c.condition_id === id)).filter(Boolean) as Condition[],
    [selectedIds]
  );

  const handleFindConditions = () => {
    setStep(2);
    setWriterFields(f => ({ ...f, masking_level: defaultMaskingLevel(role!) }));
  };

  const handleSelectCondition = (id: string) => {
    const condition = conditions.find(c => c.condition_id === id);
    setSelectedIds([id]);
    setStep(3);
    if (condition && condition.behavioural_tells.length > 0) {
      setWriterFields(f => ({ ...f, primary_tell: f.primary_tell || condition.behavioural_tells[0] }));
    }
  };

  const handleAddSecondCondition = () => {
    setStep(2);
  };

  const handleSelectSecond = (id: string) => {
    if (!selectedIds.includes(id) && selectedIds.length < 2) {
      const condition = conditions.find(c => c.condition_id === id);
      setSelectedIds(prev => [...prev, id]);
      if (condition && condition.behavioural_tells.length > 0 && !writerFields.primary_tell) {
        setWriterFields(f => ({ ...f, primary_tell: condition.behavioural_tells[0] }));
      }
    }
    setStep(3);
  };

  const handleStartOver = () => {
    setStep(1);
    setRole(null);
    setFeeling(null);
    setSetting(null);
    setSelectedIds([]);
    setShowMoreClinical(false);
    // Writer fields persist per spec
  };

  const handleSave = () => {
    onSave?.({
      condition_ids: selectedIds,
      masking_level: writerFields.masking_level,
      primary_tell: writerFields.primary_tell,
      role_in_story: writerFields.role_in_story,
      notes: writerFields.notes,
    });
  };

  if (!characterId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a character to assign a clinical profile.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Start over link */}
      {step > 1 && (
        <button
          onClick={handleStartOver}
          className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground uppercase tracking-widest"
        >
          <RotateCcw className="w-3 h-3" /> Start over
        </button>
      )}

      {/* ── STEP 1: Three Questions ── */}
      {step === 1 && (
        <div className="space-y-6">
          <QuestionGroup
            title="What is this character's role in the story?"
            options={ROLE_OPTIONS}
            value={role}
            onChange={(v) => setRole(v as StoryRole)}
          />
          <QuestionGroup
            title="What should the reader feel about this character before any reveal?"
            options={FEELING_OPTIONS}
            value={feeling}
            onChange={(v) => setFeeling(v as ReaderFeeling)}
          />
          <QuestionGroup
            title="Where does this character operate?"
            options={SETTING_OPTIONS}
            value={setting}
            onChange={setSetting}
          />

          {allAnswered && (
            <button
              onClick={handleFindConditions}
              className="px-4 py-2 text-xs font-mono uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Find Conditions
            </button>
          )}
        </div>
      )}

      {/* ── STEP 2: Matched Conditions ── */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {selectedIds.length === 0 ? "Matched conditions" : "Add second condition (comorbidity)"}
          </p>
          {matchedConditions
            .filter(c => !selectedIds.includes(c.condition_id))
            .map(c => (
              <div key={c.condition_id} className="border border-border p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">{c.condition_name}</h3>
                <p className="text-xs text-muted-foreground font-serif italic">
                  {c.leila_rex_angle.split(".")[0]}.
                </p>
                <button
                  onClick={() =>
                    selectedIds.length === 0
                      ? handleSelectCondition(c.condition_id)
                      : handleSelectSecond(c.condition_id)
                  }
                  className="px-3 py-1.5 text-[10px] font-mono uppercase bg-accent text-accent-foreground hover:bg-accent/80"
                >
                  Select this condition
                </button>
              </div>
            ))}
        </div>
      )}

      {/* ── STEP 3: Condition Detail + Writer Fields ── */}
      {step === 3 && selectedConditions.length > 0 && (
        <div className="space-y-6">
          {selectedConditions.map(c => (
            <ConditionDetail
              key={c.condition_id}
              condition={c}
              showMoreClinical={showMoreClinical}
              onToggleMore={() => setShowMoreClinical(v => !v)}
            />
          ))}

          {/* Add second condition */}
          {selectedIds.length < 2 && (
            <button
              onClick={handleAddSecondCondition}
              className="text-[10px] font-mono uppercase text-muted-foreground hover:text-foreground underline"
            >
              + Add second condition (comorbidity)
            </button>
          )}

          {/* Writer Fields */}
          <div className="border-t border-border pt-4 space-y-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Writer fields</p>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono block mb-1">
                Masking Level
              </label>
              <select
                value={writerFields.masking_level}
                onChange={e => setWriterFields(f => ({ ...f, masking_level: e.target.value as MaskingLevel }))}
                className="w-full bg-background border border-border px-2 py-1.5 text-sm font-mono text-foreground"
              >
                {MASKING_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono block mb-1">
                The one thing your narrator might notice first
              </label>
              <input
                value={writerFields.primary_tell}
                onChange={e => setWriterFields(f => ({ ...f, primary_tell: e.target.value }))}
                className="w-full bg-background border border-border px-2 py-1.5 text-sm font-mono text-foreground"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono block mb-1">
                Describe their specific position in the hierarchy
              </label>
              <input
                value={writerFields.role_in_story}
                onChange={e => setWriterFields(f => ({ ...f, role_in_story: e.target.value }))}
                className="w-full bg-background border border-border px-2 py-1.5 text-sm font-mono text-foreground"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono block mb-1">
                Anything else about how this character uses this condition
              </label>
              <textarea
                value={writerFields.notes}
                onChange={e => setWriterFields(f => ({ ...f, notes: e.target.value }))}
                className="w-full bg-background border border-border px-2 py-1.5 text-sm font-mono text-foreground resize-none h-24"
              />
            </div>

            <button
              onClick={handleSave}
              className="px-4 py-2 text-xs font-mono uppercase tracking-widest bg-success text-success-foreground hover:bg-success/90"
            >
              Save Clinical Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────

function QuestionGroup<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <div className="space-y-1">
        {options.map(o => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`w-full text-left px-3 py-2 text-xs font-mono border transition-colors ${
              value === o.value
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:border-muted-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConditionDetail({
  condition: c,
  showMoreClinical,
  onToggleMore,
}: {
  condition: Condition;
  showMoreClinical: boolean;
  onToggleMore: () => void;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">{c.condition_name}</h3>

      {/* 1. Leila Rex Angle — highlighted */}
      <div className="bg-muted/50 border border-border p-4">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
          How your narrator sees this character
        </p>
        <p className="text-sm font-serif text-foreground italic leading-relaxed">{c.leila_rex_angle}</p>
      </div>

      {/* 2–5: Panels */}
      <DetailPanel label="What everyone sees" text={c.surface_presentation} />
      <DetailPanel label="How they operate in the hierarchy" text={c.institutional_behaviour} />
      <DetailPanel label="Their control mechanism" text={c.control_mechanism} />
      <DetailPanel label="What's underneath" text={c.fear_substrate} />

      {/* 6. Tells */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
          Tells under pressure
        </p>
        <ul className="list-disc list-inside space-y-0.5 text-xs text-foreground">
          {c.verbal_tics.map((t, i) => <li key={`v${i}`}>{t}</li>)}
        </ul>
        <ul className="list-disc list-inside space-y-0.5 text-xs text-foreground mt-2">
          {c.behavioural_tells.map((t, i) => <li key={`b${i}`}>{t}</li>)}
        </ul>
      </div>

      {/* 7. Tropes */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
          Narrative patterns this character naturally produces
        </p>
        <ul className="list-disc list-inside space-y-0.5 text-xs text-foreground">
          {c.tropes_generated.map((t, i) => <li key={`t${i}`}>{t}</li>)}
        </ul>
      </div>

      {/* More clinical detail toggle */}
      <button
        onClick={onToggleMore}
        className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground uppercase"
      >
        {showMoreClinical ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Show more clinical detail
      </button>
      {showMoreClinical && (
        <div className="space-y-3 pl-2 border-l border-border">
          <DetailPanel label="Rationalisation pattern" text={c.rationalisation_pattern} />
          <DetailPanel label="Masking behaviours" text={c.masking_behaviours} />
          <DetailPanel label="Comorbidities" text={c.comorbidities} />
        </div>
      )}
    </div>
  );
}

function DetailPanel({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className="text-xs text-foreground leading-relaxed">{text}</p>
    </div>
  );
}

export default ClinicalProfileTab;
