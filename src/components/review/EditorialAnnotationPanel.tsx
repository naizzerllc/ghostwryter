/**
 * Editorial Annotation Panel — GAP3
 * GHOSTLY v2.2
 *
 * Always visible in the chapter review screen.
 * Below quality scores, above approve/reject buttons.
 */

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  type AnnotationTarget,
  type AnnotationSeverity,
  type EditorialAnnotation,
  createAnnotation,
} from "@/modules/editorial/editorialAnnotation";

// ── Types ───────────────────────────────────────────────────────────────

interface EditorialAnnotationPanelProps {
  chapterNumber: number;
  onAnnotationCreated: (annotation: EditorialAnnotation) => void;
  onReplaceChapter: (annotation: EditorialAnnotation) => void;
}

const ANNOTATION_TARGETS: { value: AnnotationTarget; label: string }[] = [
  { value: "PROSE_TEXTURE", label: "Prose texture" },
  { value: "PACING", label: "Pacing" },
  { value: "VOICE_CONSISTENCY", label: "Voice" },
  { value: "EMOTIONAL_FLATNESS", label: "Emotional flat" },
  { value: "DIALOGUE", label: "Dialogue" },
  { value: "TENSION_DELIVERY", label: "Tension" },
  { value: "HOOK", label: "Hook" },
  { value: "TWIST_ARCHITECTURE", label: "Twist arch" },
  { value: "OTHER", label: "Other" },
];

const SEVERITY_OPTIONS: { value: AnnotationSeverity; label: string; description: string }[] = [
  { value: "MINOR", label: "Minor", description: "noting only" },
  { value: "NOTABLE", label: "Notable", description: "should improve across next 2–3 chapters" },
  { value: "SIGNIFICANT", label: "Significant", description: "affects this chapter — consider replace" },
];

// ── Component ───────────────────────────────────────────────────────────

export default function EditorialAnnotationPanel({
  chapterNumber,
  onAnnotationCreated,
  onReplaceChapter,
}: EditorialAnnotationPanelProps) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState<AnnotationTarget | null>(null);
  const [severity, setSeverity] = useState<AnnotationSeverity | null>(null);
  const [showSignificantPrompt, setShowSignificantPrompt] = useState(false);

  const hasText = text.trim().length > 0;
  const isValid = !hasText || (target !== null && severity !== null);
  const charCount = text.length;

  function handleSeveritySelect(sev: AnnotationSeverity) {
    setSeverity(sev);
    if (sev === "SIGNIFICANT" && hasText) {
      setShowSignificantPrompt(true);
    } else {
      setShowSignificantPrompt(false);
    }
  }

  function handleApproveWithNote() {
    const annotation = createAnnotation(chapterNumber, text || null, target, severity);
    setShowSignificantPrompt(false);
    onAnnotationCreated(annotation);
  }

  function handleReplaceChapter() {
    const annotation = createAnnotation(chapterNumber, text, target, severity);
    setShowSignificantPrompt(false);
    onReplaceChapter(annotation);
  }

  return (
    <div className="border border-border bg-card p-4 space-y-3">
      <div>
        <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
          Editorial Note — Chapter {chapterNumber}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          This note feeds into Chapter {chapterNumber + 1}'s generation brief.
          Write what you notice — not what the scores say.
        </p>
      </div>

      <Textarea
        placeholder="e.g. confrontation scene lands flat — technically correct, no heat. Dialogue symmetric."
        value={text}
        onChange={(e) => {
          if (e.target.value.length <= 500) setText(e.target.value);
        }}
        className="font-mono text-xs min-h-[80px] bg-background"
      />
      <div className="flex justify-between text-xs text-muted-foreground font-mono">
        <span>{charCount}/500</span>
        {!hasText && <span className="italic">Leave blank to approve without annotation</span>}
      </div>

      {hasText && (
        <>
          <Separator />

          {/* Annotation Target */}
          <div className="space-y-2">
            <p className="text-xs font-mono text-muted-foreground">What does this note target?</p>
            <div className="flex flex-wrap gap-1">
              {ANNOTATION_TARGETS.map(t => (
                <Button
                  key={t.value}
                  variant={target === t.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTarget(t.value)}
                  className="font-mono text-xs"
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Annotation Severity */}
          <div className="space-y-2">
            <p className="text-xs font-mono text-muted-foreground">How significant?</p>
            <div className="flex flex-wrap gap-1">
              {SEVERITY_OPTIONS.map(s => (
                <Button
                  key={s.value}
                  variant={severity === s.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSeveritySelect(s.value)}
                  className="font-mono text-xs"
                >
                  {s.label}
                  <span className="ml-1 text-muted-foreground">({s.description})</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Validation hint */}
          {hasText && !isValid && (
            <p className="text-xs text-warning font-mono">
              Select a target and severity to enable approval.
            </p>
          )}
        </>
      )}

      {/* Significant Prompt */}
      {showSignificantPrompt && (
        <div className="border border-warning bg-warning/10 p-3 space-y-2">
          <p className="text-xs font-mono text-foreground">
            This chapter has a significant gap. Replace before approving, or approve and carry the note forward?
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleReplaceChapter}
              size="sm"
              className="font-mono text-xs border-destructive text-destructive hover:bg-destructive/10"
              variant="outline"
            >
              REPLACE CHAPTER
            </Button>
            <Button
              onClick={handleApproveWithNote}
              size="sm"
              className="font-mono text-xs"
              variant="outline"
            >
              APPROVE WITH NOTE
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
