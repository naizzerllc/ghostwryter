/**
 * Catalogue Registry Panel — Dashboard display of catalogue titles + fit check results.
 * GHOSTLY v2.2 · S10
 */

import { useSyncExternalStore, useState, useCallback } from "react";
import {
  subscribe,
  getSnapshot,
  addTitle,
  runFitCheck,
  type CatalogueRegistryRecord,
  type CatalogueSnapshot,
} from "@/modules/catalogueRegistry/catalogueRegistry";

const CatalogueRegistryPanel = () => {
  const snap: CatalogueSnapshot = useSyncExternalStore(subscribe, getSnapshot);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title_id: "",
    title: "",
    self_deception_category: "",
    protagonist_wound_type: "",
    antagonist_type: "",
    revelation_mechanism: "",
    key_imagery: "",
  });
  const [fitResult, setFitResult] = useState<ReturnType<typeof runFitCheck> | null>(null);
  const [error, setError] = useState("");

  const handleFitCheck = useCallback(() => {
    if (!form.title_id) return;
    const result = runFitCheck(form.title_id, {
      self_deception_category: form.self_deception_category,
      revelation_mechanism: form.revelation_mechanism,
      protagonist_wound_type: form.protagonist_wound_type,
      key_imagery_set: form.key_imagery.split(",").map(s => s.trim()).filter(Boolean),
    });
    setFitResult(result);
  }, [form]);

  const handleAdd = useCallback(() => {
    const now = new Date().toISOString();
    const record: CatalogueRegistryRecord = {
      title_id: form.title_id,
      title_name: form.title,
      title: form.title,
      self_deception_category: form.self_deception_category,
      protagonist_wound_type: form.protagonist_wound_type,
      antagonist_type: form.antagonist_type,
      revelation_mechanism: form.revelation_mechanism,
      key_imagery_set: form.key_imagery.split(",").map(s => s.trim()).filter(Boolean),
      status: "ACTIVE",
      genre_mode: "psychological_thriller",
      creation_date: now,
      created_at: now,
    };
    const result = addTitle(record);
    if (!result.ok) {
      setError(result.error || "Failed to add");
    } else {
      setForm({ title_id: "", title: "", self_deception_category: "", protagonist_wound_type: "", antagonist_type: "", revelation_mechanism: "", key_imagery: "" });
      setFitResult(null);
      setError("");
      setShowForm(false);
    }
  }, [form]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Titles</p>
          <p className="text-sm font-mono">{snap.count}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Active</p>
          <p className="text-sm font-mono text-warning">{snap.byStatus.ACTIVE}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Complete</p>
          <p className="text-sm font-mono text-success">{snap.byStatus.COMPLETE}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Archived</p>
          <p className="text-sm font-mono text-muted-foreground">{snap.byStatus.ARCHIVED}</p>
        </div>
      </div>

      {snap.titles.length > 0 && (
        <div className="border-t border-border pt-2 space-y-1 max-h-24 overflow-y-auto">
          {snap.titles.map(t => (
            <div key={t.title_id} className="flex justify-between items-center py-0.5">
              <span className="text-xs font-mono">{t.title_name || t.title}</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-muted-foreground">{t.self_deception_category}</span>
                <span className={`text-[9px] font-mono uppercase ${
                  t.status === "COMPLETE" ? "text-success" : t.status === "ACTIVE" ? "text-warning" : "text-muted-foreground"
                }`}>{t.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider border border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
        >
          Add Title
        </button>
      ) : (
        <div className="border-t border-border pt-3 space-y-2">
          {[
            { key: "title_id", label: "Title ID", placeholder: "book_001" },
            { key: "title", label: "Title", placeholder: "The Glass House" },
            { key: "self_deception_category", label: "Self-Deception Category", placeholder: "e.g. protective_amnesia" },
            { key: "protagonist_wound_type", label: "Protagonist Wound", placeholder: "e.g. abandonment" },
            { key: "antagonist_type", label: "Antagonist Type", placeholder: "e.g. intimate_betrayer" },
            { key: "revelation_mechanism", label: "Revelation Mechanism", placeholder: "e.g. object_recognition" },
            { key: "key_imagery", label: "Key Imagery (comma-sep)", placeholder: "glass, reflections, fractures" },
          ].map(f => (
            <div key={f.key}>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">{f.label}</p>
              <input
                value={(form as Record<string, string>)[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full bg-muted border border-border text-foreground text-xs font-mono px-2 py-1 focus:outline-none focus:border-primary"
              />
            </div>
          ))}

          {error && <p className="text-[9px] font-mono text-destructive">{error}</p>}

          {fitResult && (
            <div className="space-y-1">
              <p className={`text-[10px] font-mono font-semibold ${fitResult.fit_score >= 4 ? "text-success" : fitResult.fit_score >= 3 ? "text-warning" : "text-destructive"}`}>
                Fit Score: {fitResult.fit_score}/5 — {fitResult.recommendation}
              </p>
              {fitResult.warnings.map((w, i) => (
                <p key={`w${i}`} className="text-[9px] font-mono text-warning">⚠ {w.message}</p>
              ))}
              {fitResult.notes.map((n, i) => (
                <p key={`n${i}`} className="text-[9px] font-mono text-muted-foreground">ℹ {n.message}</p>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleFitCheck} disabled={!form.title_id}
              className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider border border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors disabled:opacity-40">
              Run Fit Check
            </button>
            <button onClick={handleAdd} disabled={!form.title_id || !form.title}
              className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider border border-primary text-primary hover:bg-primary/10 transition-colors disabled:opacity-40">
              Add to Catalogue
            </button>
            <button onClick={() => { setShowForm(false); setFitResult(null); setError(""); }}
              className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogueRegistryPanel;
