/**
 * Catalogue Registry Page — full title list, status management, fit check.
 * GHOSTLY v2.2 · S10
 */

import { useState, useCallback, useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  addTitle,
  updateTitle,
  removeTitle,
  runFitCheck,
  loadRegistry,
  type CatalogueRegistryRecord,
  type CatalogueFitResult,
} from "@/modules/catalogueRegistry/catalogueRegistry";
import { BookOpen, Plus, Trash2, CheckCircle, AlertTriangle, Archive, RefreshCw } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-warning/20 text-warning",
  COMPLETE: "bg-success/20 text-success",
  ARCHIVED: "bg-muted text-muted-foreground",
};

const EMPTY_FORM = {
  title_id: "",
  title_name: "",
  self_deception_category: "",
  protagonist_wound_type: "",
  antagonist_type: "",
  revelation_mechanism: "",
  key_imagery: "",
  genre_mode: "psychological_thriller",
};

const CatalogueRegistryPage = () => {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<typeof EMPTY_FORM | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [fitResult, setFitResult] = useState<CatalogueFitResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const selected = selectedId ? snap.titles.find(t => t.title_id === selectedId) ?? null : null;

  const handleNew = () => {
    setEditing({ ...EMPTY_FORM, title_id: `title_${Date.now()}` });
    setIsNew(true);
    setSelectedId(null);
    setFitResult(null);
    setErrors([]);
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setEditing(null);
    setIsNew(false);
    setFitResult(null);
    setErrors([]);
  };

  const handleEdit = () => {
    if (!selected) return;
    setEditing({
      title_id: selected.title_id,
      title_name: selected.title_name || selected.title,
      self_deception_category: selected.self_deception_category,
      protagonist_wound_type: selected.protagonist_wound_type,
      antagonist_type: selected.antagonist_type,
      revelation_mechanism: selected.revelation_mechanism,
      key_imagery: selected.key_imagery_set.join(", "),
      genre_mode: selected.genre_mode || "psychological_thriller",
    });
    setIsNew(false);
  };

  const handleSave = useCallback(() => {
    if (!editing) return;
    const now = new Date().toISOString();
    const imagery = editing.key_imagery.split(",").map(s => s.trim()).filter(Boolean);

    if (isNew) {
      const record: CatalogueRegistryRecord = {
        title_id: editing.title_id,
        title_name: editing.title_name,
        title: editing.title_name,
        self_deception_category: editing.self_deception_category,
        protagonist_wound_type: editing.protagonist_wound_type,
        antagonist_type: editing.antagonist_type,
        revelation_mechanism: editing.revelation_mechanism,
        key_imagery_set: imagery,
        status: "ACTIVE",
        genre_mode: editing.genre_mode,
        creation_date: now,
        created_at: now,
      };
      const result = addTitle(record);
      if (!result.ok) { setErrors([result.error || "Failed"]); return; }
      setSelectedId(editing.title_id);
    } else {
      const result = updateTitle(editing.title_id, {
        title_name: editing.title_name,
        title: editing.title_name,
        self_deception_category: editing.self_deception_category,
        protagonist_wound_type: editing.protagonist_wound_type,
        antagonist_type: editing.antagonist_type,
        revelation_mechanism: editing.revelation_mechanism,
        key_imagery_set: imagery,
        genre_mode: editing.genre_mode,
      });
      if (!result.ok) { setErrors([result.error || "Failed"]); return; }
    }
    setEditing(null);
    setIsNew(false);
    setErrors([]);
  }, [editing, isNew]);

  const handleFitCheck = useCallback(() => {
    if (!editing) return;
    const imagery = editing.key_imagery.split(",").map(s => s.trim()).filter(Boolean);
    const result = runFitCheck(editing.title_id, {
      self_deception_category: editing.self_deception_category,
      revelation_mechanism: editing.revelation_mechanism,
      protagonist_wound_type: editing.protagonist_wound_type,
      key_imagery_set: imagery,
    });
    setFitResult(result);
  }, [editing]);

  const handleDelete = useCallback(() => {
    if (selectedId && confirm(`Remove "${selected?.title_name || selected?.title}"?`)) {
      removeTitle(selectedId);
      setSelectedId(null);
    }
  }, [selectedId, selected]);

  const handleStatusChange = useCallback((status: "ACTIVE" | "COMPLETE" | "ARCHIVED") => {
    if (!selectedId) return;
    const updates: Partial<CatalogueRegistryRecord> = { status };
    if (status === "COMPLETE") updates.completion_date = new Date().toISOString();
    updateTitle(selectedId, updates);
  }, [selectedId]);

  const handleLoad = useCallback(async () => {
    setLoading(true);
    await loadRegistry();
    setLoading(false);
  }, []);

  const updateField = (field: string, value: string) => {
    if (!editing) return;
    setEditing(prev => prev ? { ...prev, [field]: value } : prev);
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Left: Title list */}
      <div className="w-80 shrink-0 border border-border bg-card">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h2 className="text-xs font-mono uppercase tracking-widest text-foreground flex items-center gap-2">
            <BookOpen size={14} /> Catalogue Registry
          </h2>
          <div className="flex gap-1">
            <button onClick={handleLoad} className="p-1 text-muted-foreground hover:text-foreground" title="Load from storage">
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={handleNew} className="p-1 text-muted-foreground hover:text-foreground" title="Add title">
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="p-2 text-[10px] font-mono text-muted-foreground flex gap-3">
          <span>{snap.count} total</span>
          <span className="text-warning">{snap.byStatus.ACTIVE} active</span>
          <span className="text-success">{snap.byStatus.COMPLETE} complete</span>
        </div>

        <div className="overflow-y-auto max-h-[calc(100vh-220px)]">
          {snap.titles.map(t => (
            <button
              key={t.title_id}
              onClick={() => handleSelect(t.title_id)}
              className={`w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted/50 transition-colors ${
                selectedId === t.title_id ? "bg-muted" : ""
              }`}
            >
              <p className="text-xs font-mono text-foreground">{t.title_name || t.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 ${STATUS_COLORS[t.status]}`}>
                  {t.status}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground">{t.self_deception_category}</span>
              </div>
            </button>
          ))}
          {snap.titles.length === 0 && (
            <p className="text-xs font-mono text-muted-foreground p-4 text-center">No titles registered</p>
          )}
        </div>
      </div>

      {/* Right: Detail / Edit */}
      <div className="flex-1 border border-border bg-card overflow-y-auto">
        {!editing && !selected && (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs font-mono text-muted-foreground">Select a title or click + to add</p>
          </div>
        )}

        {selected && !editing && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-mono text-foreground">{selected.title_name || selected.title}</h2>
              <div className="flex gap-2">
                <button onClick={handleEdit}
                  className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider border border-border text-muted-foreground hover:text-foreground transition-colors">
                  Edit
                </button>
                <button onClick={handleDelete}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              {(["ACTIVE", "COMPLETE", "ARCHIVED"] as const).map(s => (
                <button key={s} onClick={() => handleStatusChange(s)}
                  className={`px-2 py-1 text-[9px] font-mono uppercase ${
                    selected.status === s ? STATUS_COLORS[s] + " font-bold" : "text-muted-foreground border border-border hover:text-foreground"
                  } transition-colors`}>
                  {s === "COMPLETE" && <CheckCircle size={10} className="inline mr-1" />}
                  {s === "ARCHIVED" && <Archive size={10} className="inline mr-1" />}
                  {s}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Title ID", value: selected.title_id },
                { label: "Genre Mode", value: selected.genre_mode },
                { label: "Self-Deception Category", value: selected.self_deception_category },
                { label: "Protagonist Wound", value: selected.protagonist_wound_type },
                { label: "Antagonist Type", value: selected.antagonist_type },
                { label: "Revelation Mechanism", value: selected.revelation_mechanism },
                { label: "Created", value: selected.creation_date || selected.created_at },
                { label: "Completed", value: selected.completion_date || "—" },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{f.label}</p>
                  <p className="text-xs font-mono text-foreground mt-0.5">{f.value || "—"}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Key Imagery</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {selected.key_imagery_set.map((img, i) => (
                  <span key={i} className="text-[9px] font-mono bg-muted px-2 py-0.5 text-foreground">{img}</span>
                ))}
                {selected.key_imagery_set.length === 0 && <span className="text-[9px] font-mono text-muted-foreground">None</span>}
              </div>
            </div>
          </div>
        )}

        {editing && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-mono text-foreground">{isNew ? "New Title" : "Edit Title"}</h2>
              <div className="flex gap-2">
                <button onClick={handleSave}
                  className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider border border-primary text-primary hover:bg-primary/10 transition-colors">
                  Save
                </button>
                <button onClick={() => { setEditing(null); setIsNew(false); setFitResult(null); }}
                  className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/30 p-2">
                {errors.map((e, i) => <p key={i} className="text-[9px] font-mono text-destructive">{e}</p>)}
              </div>
            )}

            {[
              { key: "title_name", label: "Title Name", placeholder: "The Glass House" },
              { key: "self_deception_category", label: "Self-Deception Category", placeholder: "protective_amnesia" },
              { key: "protagonist_wound_type", label: "Protagonist Wound Type", placeholder: "abandonment" },
              { key: "antagonist_type", label: "Antagonist Type", placeholder: "intimate_betrayer" },
              { key: "revelation_mechanism", label: "Revelation Mechanism", placeholder: "object_recognition" },
              { key: "key_imagery", label: "Key Imagery (comma-separated)", placeholder: "glass, reflections, fractures" },
              { key: "genre_mode", label: "Genre Mode", placeholder: "psychological_thriller" },
            ].map(f => (
              <div key={f.key}>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">{f.label}</p>
                <input
                  value={(editing as Record<string, string>)[f.key]}
                  onChange={e => updateField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full bg-muted border border-border text-foreground text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary"
                />
              </div>
            ))}

            <button onClick={handleFitCheck}
              className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider border border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors flex items-center gap-1">
              <AlertTriangle size={10} /> Run Fit Check
            </button>

            {fitResult && (
              <div className="bg-muted/50 border border-border p-3 space-y-1">
                <p className={`text-xs font-mono font-semibold ${
                  fitResult.fit_score >= 4 ? "text-success" : fitResult.fit_score >= 3 ? "text-warning" : "text-destructive"
                }`}>
                  Fit Score: {fitResult.fit_score}/5
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">{fitResult.recommendation}</p>
                {fitResult.warnings.map((w, i) => (
                  <p key={`w${i}`} className="text-[9px] font-mono text-warning">⚠ {w.message}</p>
                ))}
                {fitResult.notes.map((n, i) => (
                  <p key={`n${i}`} className="text-[9px] font-mono text-muted-foreground">ℹ {n.message}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CatalogueRegistryPage;
