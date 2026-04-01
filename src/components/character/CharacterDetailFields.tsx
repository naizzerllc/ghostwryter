/**
 * Character detail fields — 02C-aligned field sections for CharacterDB.
 * Extracted from CharacterDB.tsx for maintainability.
 */

import { type FullCharacterRecord, type PsychologicalSliders } from "@/lib/characterDatabase";
import { useState } from "react";

// ── Field primitive ──────────────────────────────────────────────────────

export function Field({
  label, field, value, editing, onChange, multiline, fullWidth,
}: {
  label: string; field: string; value?: string | null; editing: boolean;
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

export function NumberField({
  label, field, value, editing, onChange,
}: {
  label: string; field: string; value?: number | null; editing: boolean;
  onChange: (field: string, value: unknown) => void;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono block mb-1">
        {label}
      </label>
      {editing ? (
        <input
          type="number"
          value={value ?? ""}
          onChange={e => onChange(field, e.target.value ? Number(e.target.value) : null)}
          className="w-full bg-background border border-border px-2 py-1.5 text-sm font-mono text-foreground"
        />
      ) : (
        <p className="text-sm text-foreground">{value ?? "—"}</p>
      )}
    </div>
  );
}

// ── Section header ───────────────────────────────────────────────────────

export function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-border pb-1 pt-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{title}</p>
    </div>
  );
}

// ── Collapsible section ──────────────────────────────────────────────────

export function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border">
      <button onClick={() => setOpen(!open)} className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-muted/30 transition-colors">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{title}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

// ── Corpus status badges ─────────────────────────────────────────────────

export function CorpusStatusBadges({ record }: { record: Partial<FullCharacterRecord> }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className={`px-2 py-1 text-[10px] font-mono font-semibold ${
        record.corpus_approved ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
      }`}>
        corpus_approved: {record.corpus_approved ? "TRUE" : "FALSE — BLOCKED"}
      </span>
      <span className="px-2 py-1 text-[10px] font-mono bg-muted text-muted-foreground">
        voice: {record.voice_corpus_status}
      </span>
      <span className="px-2 py-1 text-[10px] font-mono bg-muted text-muted-foreground">
        reliability: {record.voice_reliability}
      </span>
      {record.corpus_approval_date && (
        <span className="px-2 py-1 text-[10px] font-mono bg-muted text-muted-foreground">
          approved: {record.corpus_approval_date}
        </span>
      )}
    </div>
  );
}

// ── Metadata row ─────────────────────────────────────────────────────────

export function MetadataRow({ record }: { record: Partial<FullCharacterRecord> }) {
  if (!record.created_at && !record.last_updated && !record.project_id) return null;
  return (
    <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground border-t border-border pt-2 mt-2">
      {record.project_id && <span>project: {record.project_id}</span>}
      {record.created_at && <span>created: {record.created_at}</span>}
      {record.last_updated && <span>updated: {record.last_updated}</span>}
    </div>
  );
}

// ── Antagonist fields section ────────────────────────────────────────────

export function AntagonistFieldsSection({
  record, editing, onChange,
}: {
  record: Partial<FullCharacterRecord>; editing: boolean;
  onChange: (field: string, value: unknown) => void;
}) {
  if (record.role !== "antagonist") return null;
  return (
    <>
      <SectionHeader title="Antagonist Architecture (02C)" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Mirror Relationship" field="mirror_relationship" value={record.mirror_relationship} editing={editing} onChange={onChange} multiline />
        <Field label="Threat Arc" field="threat_arc" value={record.threat_arc} editing={editing} onChange={onChange} multiline />
        <Field label="Antagonist Self-Deception" field="antagonist_self_deception" value={record.antagonist_self_deception} editing={editing} onChange={onChange} multiline />
        <Field label="Antagonist Limit" field="antagonist_limit" value={record.antagonist_limit} editing={editing} onChange={onChange} multiline />
        <NumberField label="Inversion Chapter" field="antagonist_inversion_chapter" value={record.antagonist_inversion_chapter} editing={editing} onChange={onChange} />
        <Field label="Inversion Truth" field="antagonist_inversion_truth" value={record.antagonist_inversion_truth} editing={editing} onChange={onChange} multiline />
      </div>
    </>
  );
}

// ── Psychological sliders ────────────────────────────────────────────────

const SLIDER_KEYS: (keyof PsychologicalSliders)[] = [
  "openness", "conscientiousness", "extraversion", "agreeableness",
  "neuroticism", "machiavellianism", "empathy",
];

export function PsychologicalSlidersSection({
  record, editing, onChange,
}: {
  record: Partial<FullCharacterRecord>; editing: boolean;
  onChange: (field: string, value: unknown) => void;
}) {
  return (
    <>
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
                  type="range" min={-10} max={10}
                  value={record.psychological_sliders?.[key] ?? 0}
                  onChange={e => onChange(`psychological_sliders.${key}`, Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-[10px] font-mono text-foreground w-6 text-right">
                  {record.psychological_sliders?.[key] ?? 0}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted relative">
                  <div
                    className="absolute top-0 h-full bg-primary"
                    style={{
                      left: "50%",
                      width: `${Math.abs(record.psychological_sliders?.[key] ?? 0) * 5}%`,
                      transform: (record.psychological_sliders?.[key] ?? 0) < 0 ? "translateX(-100%)" : "none",
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">
                  {record.psychological_sliders?.[key] ?? 0}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
