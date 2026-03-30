/**
 * Character Database Page — list + editable detail view.
 * GHOSTLY v2.2 · S08
 */

import { useState, useSyncExternalStore, useCallback } from "react";
import {
  subscribe,
  getSnapshot,
  addCharacter,
  updateCharacter,
  removeCharacter,
  type FullCharacterRecord,
  type CharacterRole,
  type PsychologicalSliders,
} from "@/lib/characterDatabase";
import { Users, Shield, UserX, Eye, Plus, X, Save, Trash2 } from "lucide-react";

const ROLE_COLORS: Record<CharacterRole, string> = {
  protagonist: "bg-primary text-primary-foreground",
  antagonist: "bg-destructive text-destructive-foreground",
  supporting: "bg-secondary text-secondary-foreground",
};

const SLIDER_KEYS: (keyof PsychologicalSliders)[] = [
  "openness", "conscientiousness", "extraversion", "agreeableness",
  "neuroticism", "machiavellianism", "empathy",
];

const EMPTY_RECORD: Omit<FullCharacterRecord, "id"> = {
  name: "", role: "supporting", wound: "", flaw: "", want: "", need: "",
  self_deception: "", fear: "", arc_start: "", arc_end: "", arc_lesson: "",
  compressed_voice_dna: "", external_goal: "", internal_desire: "",
  goal_desire_gap: "", voice_corpus_status: "MISSING",
  voice_reliability: "MISSING", corpus_approved: false,
};

const CharacterDBPage = () => {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<FullCharacterRecord> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const selected = selectedId ? snap.characters.find(c => c.id === selectedId) ?? null : null;

  const handleNew = () => {
    const id = `char_${Date.now()}`;
    setEditing({ id, ...EMPTY_RECORD });
    setIsNew(true);
    setSelectedId(null);
    setErrors([]);
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setEditing(null);
    setIsNew(false);
    setErrors([]);
  };

  const handleEdit = () => {
    if (selected) {
      setEditing({ ...selected });
      setIsNew(false);
    }
  };

  const handleSave = useCallback(() => {
    if (!editing) return;
    const record = editing as FullCharacterRecord;
    let result;
    if (isNew) {
      result = addCharacter(record);
    } else {
      result = updateCharacter(record.id, record);
    }
    if (result.ok) {
      setSelectedId(record.id);
      setEditing(null);
      setIsNew(false);
      setErrors([]);
    } else {
      setErrors(result.errors?.map(e => `${e.field}: ${e.message}`) ?? []);
    }
  }, [editing, isNew]);

  const handleDelete = useCallback(() => {
    if (selectedId && confirm(`Delete character "${selected?.name}"?`)) {
      removeCharacter(selectedId);
      setSelectedId(null);
    }
  }, [selectedId, selected]);

  const handleCancel = () => {
    setEditing(null);
    setIsNew(false);
    setErrors([]);
  };

  const updateField = (field: string, value: unknown) => {
    if (!editing) return;
    if (field.startsWith("psychological_sliders.")) {
      const sliderKey = field.split(".")[1];
      setEditing({
        ...editing,
        psychological_sliders: {
          openness: 0, conscientiousness: 0, extraversion: 0,
          agreeableness: 0, neuroticism: 0, machiavellianism: 0, empathy: 0,
          ...editing.psychological_sliders,
          [sliderKey]: value,
        },
      });
    } else {
      setEditing({ ...editing, [field]: value });
    }
  };

  const activeRecord = editing ?? selected;

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">
      {/* Character List */}
      <div className="w-72 min-w-[288px] border border-border bg-card flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h1 className="text-sm font-semibold text-foreground tracking-wide uppercase">Characters</h1>
          <button onClick={handleNew} className="p-1 hover:bg-muted transition-colors" title="Add character">
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Stats */}
        <div className="px-4 py-2 border-b border-border flex gap-3 text-[10px] font-mono text-muted-foreground">
          <span>{snap.count} total</span>
          <span className="text-success">{snap.corpusApproved} approved</span>
          <span className="text-destructive">{snap.corpusBlocked} blocked</span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {snap.characters.length === 0 && !isNew && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No characters loaded. Import an outline or add manually.
            </div>
          )}
          {snap.characters.map(c => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              className={`w-full text-left px-4 py-2.5 border-b border-border hover:bg-muted/30 transition-colors ${
                selectedId === c.id ? "bg-muted/50" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground font-medium">{c.name || "Unnamed"}</span>
                <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 ${ROLE_COLORS[c.role]}`}>
                  {c.role.slice(0, 4)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-mono ${c.corpus_approved ? "text-success" : "text-destructive"}`}>
                  {c.corpus_approved ? "APPROVED" : "BLOCKED"}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {c.voice_corpus_status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail / Edit Panel */}
      <div className="flex-1 border border-border bg-card overflow-y-auto">
        {!activeRecord ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Select a character or click + to create one
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {editing ? (isNew ? "New Character" : `Editing: ${editing.name}`) : selected?.name}
                </h2>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  ID: {activeRecord.id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <button onClick={handleSave} className="px-3 py-1.5 text-[10px] font-mono uppercase bg-success text-success-foreground hover:bg-success/90">
                      <Save className="w-3 h-3 inline mr-1" />Save
                    </button>
                    <button onClick={handleCancel} className="px-3 py-1.5 text-[10px] font-mono uppercase bg-muted text-muted-foreground hover:bg-muted/80">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={handleEdit} className="px-3 py-1.5 text-[10px] font-mono uppercase bg-primary text-primary-foreground hover:bg-primary/90">
                      Edit
                    </button>
                    <button onClick={handleDelete} className="px-3 py-1.5 text-[10px] font-mono uppercase bg-destructive/20 text-destructive hover:bg-destructive/30">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/30 p-3 space-y-1">
                {errors.map((e, i) => (
                  <p key={i} className="text-[10px] font-mono text-destructive">{e}</p>
                ))}
              </div>
            )}

            {/* Corpus status badge */}
            <div className="flex items-center gap-3">
              <span className={`px-2 py-1 text-[10px] font-mono font-semibold ${
                activeRecord.corpus_approved ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
              }`}>
                corpus_approved: {activeRecord.corpus_approved ? "TRUE" : "FALSE — BLOCKED"}
              </span>
              <span className="px-2 py-1 text-[10px] font-mono bg-muted text-muted-foreground">
                voice: {activeRecord.voice_corpus_status}
              </span>
              <span className="px-2 py-1 text-[10px] font-mono bg-muted text-muted-foreground">
                reliability: {activeRecord.voice_reliability}
              </span>
            </div>

            {/* Fields */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name" field="name" value={activeRecord.name} editing={!!editing} onChange={updateField} />
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono block mb-1">Role</label>
                {editing ? (
                  <select
                    value={activeRecord.role}
                    onChange={e => updateField("role", e.target.value)}
                    className="w-full bg-background border border-border px-2 py-1.5 text-sm font-mono text-foreground"
                  >
                    <option value="protagonist">Protagonist</option>
                    <option value="antagonist">Antagonist</option>
                    <option value="supporting">Supporting</option>
                  </select>
                ) : (
                  <p className="text-sm text-foreground">{activeRecord.role}</p>
                )}
              </div>
            </div>

            <SectionHeader title="Psychological Core" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Wound" field="wound" value={activeRecord.wound} editing={!!editing} onChange={updateField} multiline />
              <Field label="Flaw" field="flaw" value={activeRecord.flaw} editing={!!editing} onChange={updateField} multiline />
              <Field label="Want" field="want" value={activeRecord.want} editing={!!editing} onChange={updateField} multiline />
              <Field label="Need" field="need" value={activeRecord.need} editing={!!editing} onChange={updateField} multiline />
              <Field label="Self-Deception" field="self_deception" value={activeRecord.self_deception} editing={!!editing} onChange={updateField} multiline />
              <Field label="Fear" field="fear" value={activeRecord.fear} editing={!!editing} onChange={updateField} multiline />
            </div>

            <SectionHeader title="Arc" />
            <div className="grid grid-cols-3 gap-4">
              <Field label="Arc Start" field="arc_start" value={activeRecord.arc_start} editing={!!editing} onChange={updateField} multiline />
              <Field label="Arc End" field="arc_end" value={activeRecord.arc_end} editing={!!editing} onChange={updateField} multiline />
              <Field label="Arc Lesson" field="arc_lesson" value={activeRecord.arc_lesson} editing={!!editing} onChange={updateField} multiline />
            </div>

            <SectionHeader title="Goals (v1.9)" />
            <div className="grid grid-cols-3 gap-4">
              <Field label="External Goal" field="external_goal" value={activeRecord.external_goal} editing={!!editing} onChange={updateField} multiline />
              <Field label="Internal Desire" field="internal_desire" value={activeRecord.internal_desire} editing={!!editing} onChange={updateField} multiline />
              <Field label="Goal/Desire Gap" field="goal_desire_gap" value={activeRecord.goal_desire_gap} editing={!!editing} onChange={updateField} multiline />
            </div>

            <SectionHeader title="Voice DNA" />
            <Field
              label={`Compressed Voice DNA (max 150T · ${activeRecord.compressed_voice_dna?.length ?? 0} chars)`}
              field="compressed_voice_dna"
              value={activeRecord.compressed_voice_dna}
              editing={!!editing}
              onChange={updateField}
              multiline
              fullWidth
            />

            <SectionHeader title="Psychological Sliders (7 dimensions)" />
            <div className="grid grid-cols-4 gap-3">
              {SLIDER_KEYS.map(key => (
                <div key={key}>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono block mb-1">
                    {key}
                  </label>
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-10}
                        max={10}
                        value={activeRecord.psychological_sliders?.[key] ?? 0}
                        onChange={e => updateField(`psychological_sliders.${key}`, Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-[10px] font-mono text-foreground w-6 text-right">
                        {activeRecord.psychological_sliders?.[key] ?? 0}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted relative">
                        <div
                          className="absolute top-0 h-full bg-primary"
                          style={{
                            left: "50%",
                            width: `${Math.abs(activeRecord.psychological_sliders?.[key] ?? 0) * 5}%`,
                            transform: (activeRecord.psychological_sliders?.[key] ?? 0) < 0 ? "translateX(-100%)" : "none",
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">
                        {activeRecord.psychological_sliders?.[key] ?? 0}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-border pb-1 pt-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{title}</p>
    </div>
  );
}

function Field({
  label, field, value, editing, onChange, multiline, fullWidth,
}: {
  label: string; field: string; value?: string; editing: boolean;
  onChange: (field: string, value: string) => void;
  multiline?: boolean; fullWidth?: boolean;
}) {
  const cls = fullWidth ? "col-span-full" : "";
  return (
    <div className={cls}>
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono block mb-1">
        {label}
      </label>
      {editing ? (
        multiline ? (
          <textarea
            value={value ?? ""}
            onChange={e => onChange(field, e.target.value)}
            className="w-full bg-background border border-border px-2 py-1.5 text-sm font-mono text-foreground resize-none h-20"
          />
        ) : (
          <input
            value={value ?? ""}
            onChange={e => onChange(field, e.target.value)}
            className="w-full bg-background border border-border px-2 py-1.5 text-sm font-mono text-foreground"
          />
        )
      ) : (
        <p className="text-sm text-foreground whitespace-pre-wrap">{value || "—"}</p>
      )}
    </div>
  );
}

export default CharacterDBPage;
