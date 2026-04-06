/**
 * Character Database Page — list + editable detail view + clinical profile tab.
 * GHOSTLY v2.2 · S08 + S23 · 02C-aligned schema
 */

import { useState, useSyncExternalStore, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  subscribe,
  getSnapshot,
  addCharacter,
  updateCharacter,
  removeCharacter,
  type FullCharacterRecord,
  type CharacterRole,
} from "@/lib/characterDatabase";
import { Plus, Save, Trash2, Zap, Undo2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ClinicalProfileTab from "@/components/character/ClinicalProfileTab";
import {
  Field,
  SectionHeader,
  CollapsibleSection,
  CorpusStatusBadges,
  MetadataRow,
  AntagonistFieldsSection,
  PsychologicalSlidersSection,
} from "@/components/character/CharacterDetailFields";

const ROLE_COLORS: Record<CharacterRole, string> = {
  protagonist: "bg-primary text-primary-foreground",
  antagonist: "bg-destructive text-destructive-foreground",
  major_supporting: "bg-accent text-accent-foreground",
  minor_supporting: "bg-muted text-muted-foreground",
  supporting: "bg-secondary text-secondary-foreground",
};

const ROLE_OPTIONS: { value: CharacterRole; label: string }[] = [
  { value: "protagonist", label: "Protagonist" },
  { value: "antagonist", label: "Antagonist" },
  { value: "major_supporting", label: "Major Supporting" },
  { value: "minor_supporting", label: "Minor Supporting" },
  { value: "supporting", label: "Supporting" },
];

const EMPTY_RECORD: Omit<FullCharacterRecord, "id"> = {
  name: "", role: "supporting", wound: "", flaw: "", want: "", need: "",
  self_deception: "", fear: "", arc_start: "", arc_end: "", arc_lesson: "",
  arc_entry_state: "", arc_exit_state: "", karma_arc: "",
  compressed_voice_dna: "", external_goal: "", internal_desire: "",
  goal_desire_gap: "", voice_corpus_status: "MISSING",
  voice_reliability: "MISSING", corpus_approved: false,
  contradiction_matrix: undefined,
};

const CharacterDBPage = () => {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<FullCharacterRecord> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [previousCM, setPreviousCM] = useState<FullCharacterRecord["contradiction_matrix"] | null>(null);

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
      setPreviousCM(null);
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
    setPreviousCM(null);
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
    } else if (field.startsWith("contradiction_matrix.")) {
      const parts = field.split(".");
      const category = parts[1];
      const subField = parts[2];
      const cm = editing.contradiction_matrix ?? {};
      const existing = (cm as Record<string, Record<string, unknown>>)[category] ?? {};
      setEditing({
        ...editing,
        contradiction_matrix: {
          ...cm,
          [category]: { ...existing, [subField]: value },
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
                  {c.role.replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-[10px] font-mono ${c.corpus_approved ? "text-success" : "text-destructive"}`}>
                  {c.corpus_approved ? "APPROVED" : "BLOCKED"}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {c.voice_corpus_status}
                </span>
                {(c.role === "protagonist" || c.role === "antagonist") &&
                  (!c.contradiction_matrix?.behavioural || !c.contradiction_matrix?.moral ||
                   !c.contradiction_matrix?.historical || !c.contradiction_matrix?.competence) && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 bg-warning/20 text-warning uppercase">
                    CM incomplete
                  </span>
                )}
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
          <Tabs defaultValue="details" key={`${activeRecord.id}-${!!editing}`} className="p-4 space-y-4">
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

            <TabsList className="bg-muted/30 border border-border">
              <TabsTrigger value="details" className="text-[10px] font-mono uppercase tracking-widest">Character</TabsTrigger>
              <TabsTrigger value="clinical" className="text-[10px] font-mono uppercase tracking-widest">Clinical Profile</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              {/* Corpus status badges */}
              <CorpusStatusBadges record={activeRecord} />

              {/* Core fields */}
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
                      {ROLE_OPTIONS.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
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

              {/* Antagonist-specific fields — conditional on role */}
              <AntagonistFieldsSection record={activeRecord} editing={!!editing} onChange={updateField} />

              <SectionHeader title="Arc (02C)" />
              <div className="grid grid-cols-3 gap-4">
                <Field label="Arc Entry State" field="arc_entry_state" value={activeRecord.arc_entry_state} editing={!!editing} onChange={updateField} multiline />
                <Field label="Arc Exit State" field="arc_exit_state" value={activeRecord.arc_exit_state} editing={!!editing} onChange={updateField} multiline />
                <Field label="Karma Arc" field="karma_arc" value={activeRecord.karma_arc} editing={!!editing} onChange={updateField} multiline />
              </div>

              <SectionHeader title="Goals (v1.9)" />
              <div className="grid grid-cols-3 gap-4">
                <Field label="External Goal" field="external_goal" value={activeRecord.external_goal} editing={!!editing} onChange={updateField} multiline />
                <Field label="Internal Desire" field="internal_desire" value={activeRecord.internal_desire} editing={!!editing} onChange={updateField} multiline />
                <Field label="Goal/Desire Gap" field="goal_desire_gap" value={activeRecord.goal_desire_gap} editing={!!editing} onChange={updateField} multiline />
              </div>

              {/* Contradiction Matrix (v2.0) */}
              <SectionHeader title="Contradiction Matrix (v2.0)" />
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-muted-foreground font-mono">
                  Two things that should not coexist — and do. What makes the reader feel they know a real person.
                </p>
                {editing && (() => {
                  const hasExistingCM = !!(
                    activeRecord.contradiction_matrix?.behavioural?.stated_belief ||
                    activeRecord.contradiction_matrix?.moral?.stated_principle ||
                    activeRecord.contradiction_matrix?.historical?.past_action ||
                    activeRecord.contradiction_matrix?.competence?.exceptional_at
                  );
                  const doQuickFill = () => {
                    // Save current CM for undo
                    setPreviousCM(editing.contradiction_matrix ? JSON.parse(JSON.stringify(editing.contradiction_matrix)) : null);
                    const role = activeRecord.role;
                    const cm = role === "protagonist" ? {
                      behavioural: { stated_belief: "I am in control", actual_behaviour: "Compulsive rituals betray inner chaos", blind_spot: true },
                      moral: { stated_principle: "Truth matters above all", collapse_condition: "When truth threatens self-image", guilt_residue: "The thing she cannot look at" },
                      historical: { past_action: "Left someone behind", self_narrative: "I had no choice", gap: "She had other options" },
                      competence: { exceptional_at: "Reading others", humiliated_by: "Her own blind spots", origin: "Professional training" },
                    } : role === "antagonist" ? {
                      behavioural: { stated_belief: "I follow the rules", actual_behaviour: "Breaks every rule when unobserved", blind_spot: true },
                      moral: { stated_principle: "Loyalty is everything", collapse_condition: "When loyalty conflicts with survival", guilt_residue: "The betrayal she justified" },
                      historical: { past_action: "Chose silence over justice", self_narrative: "It was for the greater good", gap: "The greater good was self-interest" },
                      competence: { exceptional_at: "Anticipating threats", humiliated_by: "Emotional vulnerability", origin: "Childhood survival instinct" },
                    } : {
                      behavioural: { stated_belief: "I'm just here to help", actual_behaviour: "Helps only when it costs nothing", blind_spot: false },
                      moral: { stated_principle: "People deserve second chances", collapse_condition: "When forgiveness risks personal safety", guilt_residue: "The favour never returned" },
                      historical: { past_action: "Stayed silent when it mattered", self_narrative: "It wasn't my place", gap: "It was exactly her place" },
                      competence: { exceptional_at: "Blending in", humiliated_by: "Being singled out", origin: "Learned invisibility early" },
                    };
                    setEditing({
                      ...editing,
                      contradiction_matrix: { ...editing.contradiction_matrix, ...cm },
                    });
                  };

                  const doUndo = () => {
                    setEditing({
                      ...editing,
                      contradiction_matrix: previousCM ?? undefined,
                    });
                    setPreviousCM(null);
                  };

                  return (
                    <div className="flex items-center gap-2 ml-3">
                      {!hasExistingCM ? (
                        <button
                          onClick={doQuickFill}
                          className="px-2 py-1 text-[9px] font-mono uppercase bg-warning/20 text-warning hover:bg-warning/30 flex items-center gap-1 shrink-0"
                        >
                          <Zap className="w-3 h-3" />Quick-fill placeholders
                        </button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              className="px-2 py-1 text-[9px] font-mono uppercase bg-warning/20 text-warning hover:bg-warning/30 flex items-center gap-1 shrink-0"
                            >
                              <Zap className="w-3 h-3" />Quick-fill placeholders
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="border-warning/30 bg-background">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-foreground">Overwrite Contradiction Matrix?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will replace all existing CM fields with role-appropriate defaults. Your current values will be lost.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-muted-foreground/30">Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={doQuickFill} className="bg-warning text-warning-foreground hover:bg-warning/80">
                                Overwrite
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {previousCM !== null && (
                        <button
                          onClick={doUndo}
                          className="px-2 py-1 text-[9px] font-mono uppercase bg-muted/30 text-muted-foreground hover:bg-muted/50 flex items-center gap-1 shrink-0"
                        >
                          <Undo2 className="w-3 h-3" />Undo
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              <CollapsibleSection title="Behavioural" defaultOpen={activeRecord.role === "protagonist" || activeRecord.role === "antagonist"}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Stated Belief" field="contradiction_matrix.behavioural.stated_belief" value={activeRecord.contradiction_matrix?.behavioural?.stated_belief} editing={!!editing} onChange={updateField} multiline />
                  <Field label="Actual Behaviour" field="contradiction_matrix.behavioural.actual_behaviour" value={activeRecord.contradiction_matrix?.behavioural?.actual_behaviour} editing={!!editing} onChange={updateField} multiline />
                </div>
                <div className="mt-2">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono block mb-1">Blind Spot</label>
                  {editing ? (
                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input type="checkbox" checked={activeRecord.contradiction_matrix?.behavioural?.blind_spot ?? true} onChange={e => updateField("contradiction_matrix.behavioural.blind_spot", e.target.checked)} />
                      <span className="text-[10px] font-mono">Protagonist cannot see this contradiction</span>
                    </label>
                  ) : (
                    <p className="text-sm text-foreground">{activeRecord.contradiction_matrix?.behavioural?.blind_spot ? "Yes" : "No"}</p>
                  )}
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Moral" defaultOpen={activeRecord.role === "protagonist" || activeRecord.role === "antagonist"}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Stated Principle" field="contradiction_matrix.moral.stated_principle" value={activeRecord.contradiction_matrix?.moral?.stated_principle} editing={!!editing} onChange={updateField} multiline />
                  <Field label="Collapse Condition" field="contradiction_matrix.moral.collapse_condition" value={activeRecord.contradiction_matrix?.moral?.collapse_condition} editing={!!editing} onChange={updateField} multiline />
                </div>
                <Field label="Guilt Residue" field="contradiction_matrix.moral.guilt_residue" value={activeRecord.contradiction_matrix?.moral?.guilt_residue ?? ""} editing={!!editing} onChange={updateField} multiline fullWidth />
              </CollapsibleSection>

              <CollapsibleSection title="Historical" defaultOpen={activeRecord.role === "protagonist" || activeRecord.role === "antagonist"}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Past Action" field="contradiction_matrix.historical.past_action" value={activeRecord.contradiction_matrix?.historical?.past_action} editing={!!editing} onChange={updateField} multiline />
                  <Field label="Self-Narrative" field="contradiction_matrix.historical.self_narrative" value={activeRecord.contradiction_matrix?.historical?.self_narrative} editing={!!editing} onChange={updateField} multiline />
                </div>
                <Field label="Gap" field="contradiction_matrix.historical.gap" value={activeRecord.contradiction_matrix?.historical?.gap ?? ""} editing={!!editing} onChange={updateField} multiline fullWidth />
              </CollapsibleSection>

              <CollapsibleSection title="Competence" defaultOpen={activeRecord.role === "protagonist"}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Exceptional At" field="contradiction_matrix.competence.exceptional_at" value={activeRecord.contradiction_matrix?.competence?.exceptional_at} editing={!!editing} onChange={updateField} multiline />
                  <Field label="Humiliated By" field="contradiction_matrix.competence.humiliated_by" value={activeRecord.contradiction_matrix?.competence?.humiliated_by} editing={!!editing} onChange={updateField} multiline />
                </div>
                <Field label="Origin" field="contradiction_matrix.competence.origin" value={activeRecord.contradiction_matrix?.competence?.origin ?? ""} editing={!!editing} onChange={updateField} multiline fullWidth />
              </CollapsibleSection>

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

              <PsychologicalSlidersSection record={activeRecord} editing={!!editing} onChange={updateField} />

              {/* Metadata footer */}
              <MetadataRow record={activeRecord} />
            </TabsContent>

            <TabsContent value="clinical">
              <ClinicalProfileTab characterId={activeRecord.id ?? null} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default CharacterDBPage;
