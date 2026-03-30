/**
 * Outline Page — Chapter list with act sections, detail panel, structural anchors.
 * GHOSTLY v2.2 · Session 13
 */

import { useState } from "react";
import {
  getAllChapters,
  getActChapters,
  getStructuralAnchors,
  getGenreMode,
  getRevelationChapter,
  type ChapterOutlineRecord,
  type StructuralAnchor,
} from "@/modules/outline/outlineSystem";

const HOOK_BADGE_COLORS: Record<string, string> = {
  REVELATION: "bg-primary/20 text-primary",
  THREAT: "bg-destructive/20 text-destructive",
  DECISION: "bg-warning/20 text-warning",
  THE_LIE: "bg-accent/20 text-accent-foreground",
  NEW_QUESTION: "bg-muted text-muted-foreground",
};

const AnchorBadge = ({ anchor }: { anchor: StructuralAnchor }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 border border-primary/30 bg-primary/5">
    <span className="text-[10px] font-mono uppercase tracking-widest text-primary">
      {anchor.label}
    </span>
    <span className="text-xs font-mono text-muted-foreground">
      Ch {anchor.chapter_number}
    </span>
  </div>
);

const ChapterRow = ({
  chapter,
  isAnchor,
  isPsychThrillerPreRev,
  onClick,
  isSelected,
}: {
  chapter: ChapterOutlineRecord;
  isAnchor: boolean;
  isPsychThrillerPreRev: boolean;
  onClick: () => void;
  isSelected: boolean;
}) => (
  <button
    onClick={onClick}
    className={`w-full text-left flex items-center gap-3 px-3 py-2 border-b border-border transition-colors ${
      isSelected
        ? "bg-primary/10 border-l-2 border-l-primary"
        : "hover:bg-muted/30"
    } ${isAnchor ? "bg-primary/5" : ""}`}
  >
    <span className="text-xs font-mono w-8 text-muted-foreground">
      {chapter.chapter_number}
    </span>
    <span className="text-sm flex-1 truncate">
      {chapter.scene_purpose?.slice(0, 60) ?? "—"}
    </span>
    <span
      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 ${
        HOOK_BADGE_COLORS[chapter.hook_type] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {chapter.hook_type}
    </span>
    <span className="text-xs font-mono w-6 text-right text-muted-foreground">
      {chapter.tension_score_target}
    </span>
    {isPsychThrillerPreRev && !chapter.narrator_deception_gesture && (
      <span className="text-[9px] text-warning">⚠ NDG</span>
    )}
    <span
      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 ${
        chapter.approved
          ? "bg-success/20 text-success"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {chapter.approved ? "DONE" : "PENDING"}
    </span>
  </button>
);

const ChapterDetail = ({ chapter }: { chapter: ChapterOutlineRecord }) => {
  const genreMode = getGenreMode();
  const revChapter = getRevelationChapter();
  const isPsychPreRev =
    genreMode === "psychological_thriller" &&
    chapter.chapter_number < revChapter;

  return (
    <div className="space-y-4 p-4 border border-border bg-card">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-mono uppercase tracking-widest">
          Chapter {chapter.chapter_number}
        </h3>
        <span
          className={`text-[9px] font-mono uppercase px-2 py-0.5 ${
            chapter.approved
              ? "bg-success/20 text-success"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {chapter.approved ? "APPROVED" : "PENDING"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Scene Purpose" value={chapter.scene_purpose} />
        <Field label="Hook Type" value={chapter.hook_type} />
        <Field label="Hook Seed" value={chapter.hook_seed} />
        <Field label="Opening Type" value={chapter.opening_type} />
        <Field label="Opening Seed" value={chapter.opening_seed} />
        <Field
          label="Tension Target"
          value={String(chapter.tension_score_target)}
        />
        <Field
          label="Decision Type"
          value={chapter.protagonist_decision_type}
        />
        <Field label="Timeline" value={chapter.timeline_id} />
      </div>

      <div className="border-t border-border pt-3 space-y-3">
        <Field
          label="Collision Specification"
          value={chapter.collision_specification}
          full
        />
        <Field
          label="Permanent Change"
          value={chapter.permanent_change}
          full
        />
      </div>

      {isPsychPreRev && (
        <div className="border-t border-border pt-3">
          <Field
            label="Narrator Deception Gesture"
            value={chapter.narrator_deception_gesture ?? "⚠ MISSING"}
            full
            highlight={!chapter.narrator_deception_gesture}
          />
        </div>
      )}

      {chapter.compulsion_floor_note && (
        <div className="border-t border-border pt-3">
          <Field
            label="Compulsion Floor Note"
            value={chapter.compulsion_floor_note}
            full
          />
        </div>
      )}
    </div>
  );
};

const Field = ({
  label,
  value,
  full,
  highlight,
}: {
  label: string;
  value?: string;
  full?: boolean;
  highlight?: boolean;
}) => (
  <div className={full ? "col-span-2" : ""}>
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">
      {label}
    </p>
    <p
      className={`text-sm ${
        highlight ? "text-warning font-semibold" : "text-foreground"
      }`}
    >
      {value || "—"}
    </p>
  </div>
);

const ActSection = ({
  act,
  chapters,
  anchors,
  genreMode,
  revelationChapter,
  selectedChapter,
  onSelectChapter,
}: {
  act: 1 | 2 | 3;
  chapters: ChapterOutlineRecord[];
  anchors: StructuralAnchor[];
  genreMode: string;
  revelationChapter: number;
  selectedChapter: number | null;
  onSelectChapter: (ch: number) => void;
}) => {
  const actAnchors = anchors.filter((a) => {
    const ch = chapters.find((c) => c.chapter_number === a.chapter_number);
    return !!ch;
  });

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 px-3 py-2 bg-muted/20 border-b border-border">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Act {act}
        </h2>
        <span className="text-[10px] font-mono text-muted-foreground">
          {chapters.length} chapters
        </span>
        {actAnchors.length > 0 && (
          <div className="flex gap-2 ml-auto">
            {actAnchors.map((a) => (
              <AnchorBadge key={a.type} anchor={a} />
            ))}
          </div>
        )}
      </div>
      {chapters.map((ch) => {
        const isAnchor = anchors.some(
          (a) => a.chapter_number === ch.chapter_number
        );
        const isPsychPreRev =
          genreMode === "psychological_thriller" &&
          ch.chapter_number < revelationChapter;
        return (
          <ChapterRow
            key={ch.chapter_number}
            chapter={ch}
            isAnchor={isAnchor}
            isPsychThrillerPreRev={isPsychPreRev}
            onClick={() => onSelectChapter(ch.chapter_number)}
            isSelected={selectedChapter === ch.chapter_number}
          />
        );
      })}
    </div>
  );
};

const OutlinePage = () => {
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const allChapters = getAllChapters();
  const anchors = getStructuralAnchors();
  const genreMode = getGenreMode();
  const revelationChapter = getRevelationChapter();

  const act1 = getActChapters(1);
  const act2 = getActChapters(2);
  const act3 = getActChapters(3);

  const selected = allChapters.find(
    (c) => c.chapter_number === selectedChapter
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-wide">
          Chapter Outline
        </h1>
        <span className="text-xs font-mono text-muted-foreground">
          {allChapters.length} chapters · {anchors.length} structural anchors
        </span>
      </div>

      {allChapters.length === 0 ? (
        <div className="border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No outline loaded. Import an outline from the Outline Import page.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-4">
          {/* Chapter list */}
          <div className="col-span-3 border border-border">
            {act1.length > 0 && (
              <ActSection
                act={1}
                chapters={act1}
                anchors={anchors}
                genreMode={genreMode}
                revelationChapter={revelationChapter}
                selectedChapter={selectedChapter}
                onSelectChapter={setSelectedChapter}
              />
            )}
            {act2.length > 0 && (
              <ActSection
                act={2}
                chapters={act2}
                anchors={anchors}
                genreMode={genreMode}
                revelationChapter={revelationChapter}
                selectedChapter={selectedChapter}
                onSelectChapter={setSelectedChapter}
              />
            )}
            {act3.length > 0 && (
              <ActSection
                act={3}
                chapters={act3}
                anchors={anchors}
                genreMode={genreMode}
                revelationChapter={revelationChapter}
                selectedChapter={selectedChapter}
                onSelectChapter={setSelectedChapter}
              />
            )}
          </div>

          {/* Detail panel */}
          <div className="col-span-2">
            {selected ? (
              <ChapterDetail chapter={selected} />
            ) : (
              <div className="border border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Select a chapter to view details
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OutlinePage;
