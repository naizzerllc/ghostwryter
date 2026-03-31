/**
 * Human Review Interface — Displays generated chapter for human review.
 * GHOSTLY v2.2 · Session 18
 *
 * Shows: prose, quality scores, violations, truncation warnings.
 * Actions: APPROVE, APPROVE+SIGN OFF, FLAG, OVERRIDE+APPROVE, INLINE EDIT.
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type ApprovedChapterRecord,
  type SignOffStatus,
  updateSignOff,
  applyHumanOverride,
} from "@/modules/generation/chapterPipeline";
import type { GenerationSuccess } from "@/modules/generation/generationCore";
import type { ForbiddenWordsResult } from "@/utils/forbiddenWordsChecker";
import type { BoundaryViolation } from "@/modules/knowledgeBoundary/knowledgeBoundaryMap";
import type { MedicalFactCheckResult, WriterDecision } from "@/modules/quality/medicalFactChecker";
import type { TexturePassRecord } from "@/modules/texturePass/texturePass";
import ClinicalAccuracyTab from "./ClinicalAccuracyTab";
import EditorialAnnotationPanel from "./EditorialAnnotationPanel";
import type { EditorialAnnotation } from "@/modules/editorial/editorialAnnotation";

// ── Types ───────────────────────────────────────────────────────────────

export type FlagType =
  | "VOICE_DRIFT"
  | "PACING"
  | "CONTINUITY_SOFT"
  | "BRAND_REGISTER"
  | "PROSE_FRESHNESS"
  | "OTHER";

interface HumanReviewProps {
  chapterNumber: number;
  projectId: string;
  prose: string;
  scenePurpose: string;
  compositeScore: number | null;
  moduleScores: Record<string, number>;
  forbiddenWordResult: ForbiddenWordsResult;
  boundaryViolations: BoundaryViolation[];
  truncationSuspected: boolean;
  approvedRecord: ApprovedChapterRecord | null;
  qualityGateRejected: boolean;
  medicalFactCheckResult: MedicalFactCheckResult | null;
  medicalAdvisoryRequired: boolean;
  texturePassRecord: TexturePassRecord | null;
  onApproved: (record: ApprovedChapterRecord) => void;
  onFlagged: (flagType: FlagType, notes: string) => void;
  onMedicalClaimDecision: (claimId: string, decision: WriterDecision, reasoning?: string) => void;
  onReplaceChapter?: (annotation: EditorialAnnotation) => void;
}

// ── Sign-off Badge ──────────────────────────────────────────────────────

function SignOffBadge({ status }: { status: SignOffStatus }) {
  const colorMap: Record<SignOffStatus, string> = {
    PENDING: "bg-warning/20 text-warning border-warning/40",
    SIGNED_OFF: "bg-success/20 text-success border-success/40",
    FLAGGED_FOR_REVISION: "bg-destructive/20 text-destructive border-destructive/40",
    SKIPPED: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={`font-mono text-xs ${colorMap[status]}`}>
      {status}
    </Badge>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function HumanReview({
  chapterNumber,
  projectId,
  prose,
  scenePurpose,
  compositeScore,
  moduleScores,
  forbiddenWordResult,
  boundaryViolations,
  truncationSuspected,
  approvedRecord,
  qualityGateRejected,
  medicalFactCheckResult,
  medicalAdvisoryRequired,
  texturePassRecord,
  onApproved,
  onFlagged,
  onMedicalClaimDecision,
  onReplaceChapter,
}: HumanReviewProps) {
  const [editMode, setEditMode] = useState(false);
  const [editedProse, setEditedProse] = useState(prose);
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideNote, setOverrideNote] = useState("");
  const [flagMode, setFlagMode] = useState(false);
  const [flagType, setFlagType] = useState<FlagType>("VOICE_DRIFT");
  const [flagNotes, setFlagNotes] = useState("");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [showRevisionField, setShowRevisionField] = useState(false);

  const signOffStatus = approvedRecord?.human_editorial_sign_off.status ?? "PENDING";

  // ── Actions ─────────────────────────────────────────────────────────

  function handleApprove() {
    // INVARIANT [A16-1]: status defaults to PENDING. Not SIGNED_OFF.
    if (approvedRecord) {
      updateSignOff(chapterNumber, projectId, "PENDING", "operator");
      onApproved(approvedRecord);
    }
  }

  function handleApproveAndSignOff() {
    if (approvedRecord) {
      updateSignOff(chapterNumber, projectId, "SIGNED_OFF", "operator");
      onApproved({ ...approvedRecord, human_editorial_sign_off: { ...approvedRecord.human_editorial_sign_off, status: "SIGNED_OFF" } });
    }
  }

  function handleFlagForRevision() {
    if (!showRevisionField) {
      setShowRevisionField(true);
      return;
    }
    if (approvedRecord) {
      updateSignOff(chapterNumber, projectId, "FLAGGED_FOR_REVISION", "operator", revisionNotes);
      onFlagged("OTHER", revisionNotes);
    }
  }

  async function handleOverrideApprove() {
    if (!overrideMode) {
      setOverrideMode(true);
      return;
    }
    if (overrideNote.length < 20) return;
    if (approvedRecord) {
      await applyHumanOverride(chapterNumber, projectId, prose, overrideNote);
      onApproved({
        ...approvedRecord,
        human_editorial_override: true,
        override_note: overrideNote,
      });
    }
    setOverrideMode(false);
  }

  async function handleInlineEditSave() {
    if (approvedRecord) {
      await applyHumanOverride(chapterNumber, projectId, editedProse, "Inline edit by operator");
      onApproved({ ...approvedRecord, approved_draft: editedProse });
    }
    setEditMode(false);
  }

  function handleSignOff() {
    if (approvedRecord) {
      updateSignOff(chapterNumber, projectId, "SIGNED_OFF", "operator");
    }
  }

  function handleAddFlag() {
    if (!flagMode) {
      setFlagMode(true);
      return;
    }
    onFlagged(flagType, flagNotes);
    if (approvedRecord) {
      updateSignOff(chapterNumber, projectId, "FLAGGED_FOR_REVISION", "operator", `[${flagType}] ${flagNotes}`);
    }
    setFlagMode(false);
  }

  // ── Render ──────────────────────────────────────────────────────────

  const criticalBoundary = boundaryViolations.filter(v => v.severity === "CRITICAL");
  const warningBoundary = boundaryViolations.filter(v => v.severity !== "CRITICAL");

  // Medical advisory: block approval if flagged claims still PENDING
  const medicalPendingFlags = medicalAdvisoryRequired && medicalFactCheckResult
    ? medicalFactCheckResult.claims.filter(c => c.severity !== "NONE" && c.writer_decision === "PENDING").length
    : 0;
  const approvalBlockedByMedical = medicalPendingFlags > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground font-mono">
            Chapter {chapterNumber} — Human Review
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{scenePurpose}</p>
        </div>
        <SignOffBadge status={signOffStatus} />
      </div>

      <Separator />

      {/* Truncation Warning */}
      {truncationSuspected && (
        <div className="border border-destructive bg-destructive/10 p-3">
          <p className="text-sm text-destructive font-mono font-bold">
            ⚠ TRUNCATION SUSPECTED — Mandatory human review. SKIPPED not permitted.
          </p>
        </div>
      )}

      {/* Quality Scores */}
      <div className="border border-border bg-card p-4 space-y-2">
        <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Quality Scores</h3>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Composite:</span>
          <span className="font-mono text-foreground">
            {compositeScore !== null ? compositeScore.toFixed(1) : "—"}
          </span>
        </div>
        {Object.keys(moduleScores).length > 0 ? (
          <div className="grid grid-cols-3 gap-2 mt-2">
            {Object.entries(moduleScores).map(([mod, score]) => (
              <div key={mod} className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">{mod}</span>
                <span className="text-foreground">{score.toFixed(1)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Module scores pending (Sessions 19–22)</p>
        )}
      </div>

      {/* Texture Pass Status (S25) */}
      {texturePassRecord && (
        <div className={`flex items-center gap-2 px-4 py-2 border text-xs font-mono ${
          texturePassRecord.pass_status === "COMPLETED"
            ? "border-success/40 bg-success/10 text-success"
            : "border-warning/40 bg-warning/10 text-warning"
        }`}>
          <span>{texturePassRecord.pass_status === "COMPLETED" ? "✓" : "⚠"}</span>
          <span>
            Texture Pass: {texturePassRecord.pass_status === "COMPLETED" ? "Complete" : "Failed — evaluated from raw generation"}
          </span>
          {texturePassRecord.calibration_anchors_injected && (
            <span className="ml-2 text-muted-foreground">⚓ Calibrated</span>
          )}
          {texturePassRecord.token_cost > 0 && (
            <span className="ml-auto text-muted-foreground">{texturePassRecord.token_cost}T</span>
          )}
        </div>
      )}


      {(forbiddenWordResult.hardBanCount > 0 || forbiddenWordResult.violations.length > 0) && (
        <div className="border border-warning bg-warning/10 p-4 space-y-2">
          <h3 className="text-sm font-mono text-warning uppercase tracking-wider">
            Forbidden Word Violations ({forbiddenWordResult.violations.length})
          </h3>
          <div className="space-y-1">
            {forbiddenWordResult.violations.slice(0, 20).map((v, i) => (
              <p key={i} className="text-xs font-mono text-foreground">
                <span className={v.tier === "hard_ban" ? "text-destructive" : "text-warning"}>
                  [{v.tier}]
                </span>{" "}
                "{v.word}" — {v.context}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge Boundary Violations */}
      {boundaryViolations.length > 0 && (
        <div className={`border p-4 space-y-2 ${criticalBoundary.length > 0 ? "border-destructive bg-destructive/10" : "border-warning bg-warning/10"}`}>
          <h3 className="text-sm font-mono uppercase tracking-wider text-foreground">
            Knowledge Boundary Violations ({boundaryViolations.length})
          </h3>
          {criticalBoundary.map((v, i) => (
            <p key={`c-${i}`} className="text-xs font-mono text-destructive font-bold">
              [CRITICAL] {v.message}
            </p>
          ))}
          {warningBoundary.map((v, i) => (
            <p key={`w-${i}`} className="text-xs font-mono text-warning">
              [WARNING] {v.message}
            </p>
          ))}
        </div>
      )}

      {/* Clinical Accuracy */}
      <ClinicalAccuracyTab
        result={medicalFactCheckResult}
        onClaimDecisionChange={onMedicalClaimDecision}
      />

      <Separator />

      {/* Generated Prose */}
      <div className="border border-border bg-card">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
            Generated Prose
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditMode(!editMode);
              if (!editMode) setEditedProse(prose);
            }}
            className="font-mono text-xs"
          >
            {editMode ? "CANCEL EDIT" : "INLINE EDIT"}
          </Button>
        </div>
        {editMode ? (
          <div className="p-3 space-y-2">
            <Textarea
              value={editedProse}
              onChange={(e) => setEditedProse(e.target.value)}
              className="min-h-[400px] font-serif text-sm leading-relaxed bg-background"
            />
            <Button onClick={handleInlineEditSave} size="sm" className="font-mono text-xs">
              SAVE EDIT
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[400px] p-4">
            <div className="font-serif text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {prose}
            </div>
          </ScrollArea>
        )}
      </div>

      <Separator />

      {/* Editorial Annotation Panel — GAP3 */}
      <EditorialAnnotationPanel
        chapterNumber={chapterNumber}
        onAnnotationCreated={(annotation) => {
          if (approvedRecord) {
            onApproved({ ...approvedRecord, editorial_annotation: annotation });
          }
        }}
        onReplaceChapter={(annotation) => {
          onReplaceChapter?.(annotation);
        }}
      />

      <Separator />

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleApprove}
          disabled={approvalBlockedByMedical}
          title={approvalBlockedByMedical ? "Resolve all clinical flags to approve this chapter." : undefined}
          className="font-mono text-xs bg-success hover:bg-success/80 text-success-foreground"
        >
          APPROVE
        </Button>
        <Button
          onClick={handleApproveAndSignOff}
          disabled={approvalBlockedByMedical}
          title={approvalBlockedByMedical ? "Resolve all clinical flags to approve this chapter." : undefined}
          className="font-mono text-xs bg-success hover:bg-success/80 text-success-foreground"
        >
          APPROVE + SIGN OFF
        </Button>
        <Button
          variant="outline"
          onClick={handleFlagForRevision}
          className="font-mono text-xs border-warning text-warning hover:bg-warning/10"
        >
          FLAG FOR REVISION
        </Button>
        {qualityGateRejected && (
          <Button
            variant="outline"
            onClick={handleOverrideApprove}
            className="font-mono text-xs border-destructive text-destructive hover:bg-destructive/10"
          >
            OVERRIDE + APPROVE
          </Button>
        )}
      </div>

      {/* Revision Notes Field */}
      {showRevisionField && (
        <div className="border border-warning bg-warning/5 p-3 space-y-2">
          <Textarea
            placeholder="Revision notes..."
            value={revisionNotes}
            onChange={(e) => setRevisionNotes(e.target.value)}
            className="font-mono text-xs min-h-[80px]"
          />
          <Button
            onClick={handleFlagForRevision}
            size="sm"
            className="font-mono text-xs border-warning text-warning"
            variant="outline"
          >
            SUBMIT FLAG
          </Button>
        </div>
      )}

      {/* Override Notes Field */}
      {overrideMode && (
        <div className="border border-destructive bg-destructive/5 p-3 space-y-2">
          <p className="text-xs text-muted-foreground font-mono">
            Override note required (min 20 characters):
          </p>
          <Input
            placeholder="Reason for overriding quality gate rejection..."
            value={overrideNote}
            onChange={(e) => setOverrideNote(e.target.value)}
            className="font-mono text-xs"
          />
          <div className="flex items-center gap-2">
            <Button
              onClick={handleOverrideApprove}
              size="sm"
              disabled={overrideNote.length < 20}
              className="font-mono text-xs"
            >
              CONFIRM OVERRIDE ({overrideNote.length}/20)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOverrideMode(false)}
              className="font-mono text-xs"
            >
              CANCEL
            </Button>
          </div>
        </div>
      )}

      <Separator />

      {/* Sign-off Panel */}
      <div className="border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
            Editorial Sign-off
          </h3>
          <SignOffBadge status={signOffStatus} />
        </div>
        <div className="flex gap-2">
          {signOffStatus === "PENDING" && (
            <Button onClick={handleSignOff} size="sm" className="font-mono text-xs bg-success hover:bg-success/80">
              SIGN OFF
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddFlag}
            className="font-mono text-xs border-warning text-warning"
          >
            ADD FLAG
          </Button>
        </div>

        {flagMode && (
          <div className="space-y-2 mt-2">
            <div className="flex flex-wrap gap-1">
              {(["VOICE_DRIFT", "PACING", "CONTINUITY_SOFT", "BRAND_REGISTER", "PROSE_FRESHNESS", "OTHER"] as FlagType[]).map(ft => (
                <Button
                  key={ft}
                  variant={flagType === ft ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFlagType(ft)}
                  className="font-mono text-xs"
                >
                  {ft}
                </Button>
              ))}
            </div>
            <Input
              placeholder="Flag notes..."
              value={flagNotes}
              onChange={(e) => setFlagNotes(e.target.value)}
              className="font-mono text-xs"
            />
            <Button onClick={handleAddFlag} size="sm" className="font-mono text-xs">
              SUBMIT FLAG
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
