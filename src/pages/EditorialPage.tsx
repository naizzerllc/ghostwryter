/**
 * Editorial Pipeline Page — S25/S26
 * GHOSTLY v2.2
 *
 * Sections: Manuscript Status, Continuity Audit, Scene Revision Tool,
 * Compulsion Curve Dashboard, Voice Register Review, Outline Amendment.
 */

import { useState, useCallback } from "react";
import {
  runContinuityAudit,
  loadLastAuditReport,
  resolveViolation,
  type ContinuityAuditReport,
  type ContinuityViolation,
} from "@/modules/editorial/continuityAudit";
import {
  assessRevisionScope,
  executeRevision,
  acceptRevision,
  rejectRevision,
  type RevisionResult,
} from "@/modules/editorial/sceneRevisionTool";
import {
  createAmendment,
  runImpactAudit,
  resolveChapter,
  applyAmendment,
  rejectAmendment,
  allChaptersResolved,
  loadAmendments,
  hasApprovedChapters,
  type OutlineAmendment,
  type AmendmentType,
  type SuggestedAction,
} from "@/modules/editorial/outlineAmendmentProtocol";
import CompulsionCurveDashboard from "@/components/editorial/CompulsionCurveDashboard";
import VoiceRegisterReview from "@/components/VoiceRegisterReview";
import { CheckCircle, AlertTriangle, Loader2, FileText, RotateCcw, Plus } from "lucide-react";

const PROJECT_ID = "default";

export default function EditorialPage() {
  // ── Manuscript Status ─────────────────────────────────────────────
  const [approvedCount] = useState(0);
  const [signedOffCount] = useState(0);
  const [flaggedCount] = useState(0);
  const [overrideCount] = useState(0);

  // ── Continuity Audit ──────────────────────────────────────────────
  const [auditReport, setAuditReport] = useState<ContinuityAuditReport | null>(
    () => loadLastAuditReport()
  );
  const [auditLoading, setAuditLoading] = useState(false);

  const handleRunAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const report = await runContinuityAudit(PROJECT_ID);
      setAuditReport(report);
    } catch (error) {
      console.error("[Editorial] Audit failed:", error);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const handleResolveViolation = useCallback((violationId: string) => {
    resolveViolation(violationId);
    setAuditReport(loadLastAuditReport());
  }, []);

  // ── Scene Revision Tool ───────────────────────────────────────────
  const [revisionChapter, setRevisionChapter] = useState<number>(1);
  const [revisionInstruction, setRevisionInstruction] = useState("");
  const [scenePurposeChanged, setScenePurposeChanged] = useState(false);
  const [structuralChange, setStructuralChange] = useState(false);
  const [revisionResult, setRevisionResult] = useState<RevisionResult | null>(null);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [scopePreview, setScopePreview] = useState<string | null>(null);

  const handleAssessScope = useCallback(() => {
    const scope = assessRevisionScope({
      chapter_number: revisionChapter,
      project_id: PROJECT_ID,
      instruction: revisionInstruction,
      scene_purpose_changed: scenePurposeChanged,
      structural_change: structuralChange,
    });
    setScopePreview(`${scope.scope}: ${scope.reason} (~${scope.estimated_tokens} tokens)`);
  }, [revisionChapter, revisionInstruction, scenePurposeChanged, structuralChange]);

  const handleExecuteRevision = useCallback(async () => {
    setRevisionLoading(true);
    try {
      const result = await executeRevision({
        chapter_number: revisionChapter,
        project_id: PROJECT_ID,
        instruction: revisionInstruction,
        scene_purpose_changed: scenePurposeChanged,
        structural_change: structuralChange,
      });
      setRevisionResult(result);
    } catch (error) {
      console.error("[Editorial] Revision failed:", error);
    } finally {
      setRevisionLoading(false);
    }
  }, [revisionChapter, revisionInstruction, scenePurposeChanged, structuralChange]);

  const handleAcceptRevision = useCallback(() => {
    if (revisionResult) {
      acceptRevision(revisionResult, PROJECT_ID);
      setRevisionResult({ ...revisionResult, status: "ACCEPTED" });
    }
  }, [revisionResult]);

  const handleRejectRevision = useCallback(() => {
    if (revisionResult) {
      rejectRevision(revisionResult);
      setRevisionResult({ ...revisionResult, status: "REJECTED" });
    }
  }, [revisionResult]);

  const handleReviewChapter = useCallback((chapterNumber: number) => {
    setRevisionChapter(chapterNumber);
    document.getElementById("revision-tool")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // ── Outline Amendment ─────────────────────────────────────────────
  const showAmendButton = hasApprovedChapters(PROJECT_ID);
  const [amendments, setAmendments] = useState<OutlineAmendment[]>(() => loadAmendments());
  const [showAmendForm, setShowAmendForm] = useState(false);
  const [amendType, setAmendType] = useState<AmendmentType>("CHAPTER");
  const [amendDescription, setAmendDescription] = useState("");
  const [amendFields, setAmendFields] = useState("");
  const [amendNewValues, setAmendNewValues] = useState("");
  const [amendLoading, setAmendLoading] = useState(false);

  const handleCreateAmendment = useCallback(async () => {
    if (!amendDescription.trim() || !amendFields.trim()) return;
    setAmendLoading(true);
    try {
      const fields = amendFields.split(",").map((f) => f.trim()).filter(Boolean);
      let newVals: Record<string, unknown> = {};
      try { newVals = JSON.parse(amendNewValues || "{}"); } catch { /* use empty */ }

      const amendment = createAmendment(amendType, amendDescription, fields, {}, newVals);
      await runImpactAudit(amendment.id, PROJECT_ID);
      setAmendments(loadAmendments());
      setShowAmendForm(false);
      setAmendDescription("");
      setAmendFields("");
      setAmendNewValues("");
    } catch (error) {
      console.error("[Editorial] Amendment creation failed:", error);
    } finally {
      setAmendLoading(false);
    }
  }, [amendType, amendDescription, amendFields, amendNewValues]);

  const handleResolveAmendChapter = useCallback((amendmentId: string, chapterNumber: number, action: SuggestedAction) => {
    resolveChapter(amendmentId, chapterNumber, action);
    setAmendments(loadAmendments());
  }, []);

  const handleApplyAmendment = useCallback((amendmentId: string) => {
    try {
      applyAmendment(amendmentId, PROJECT_ID);
      setAmendments(loadAmendments());
    } catch (error) {
      console.error("[Editorial] Apply amendment failed:", error);
    }
  }, []);

  const handleRejectAmendment = useCallback((amendmentId: string) => {
    rejectAmendment(amendmentId);
    setAmendments(loadAmendments());
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-wide">Editorial Pipeline</h1>

      {/* ── MANUSCRIPT STATUS ────────────────────────────────────── */}
      <section className="border border-border bg-card p-4">
        <h2 className="text-sm font-semibold tracking-wide text-foreground mb-3">MANUSCRIPT STATUS</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatusCard label="Approved" value={approvedCount} />
          <StatusCard label="Signed Off" value={signedOffCount} />
          <StatusCard label="Flagged" value={flaggedCount} variant="warning" />
          <StatusCard label="Overrides" value={overrideCount} />
        </div>
      </section>

      {/* ── CONTINUITY AUDIT ─────────────────────────────────────── */}
      <section className="border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold tracking-wide text-foreground">CONTINUITY AUDIT</h2>
          <button
            onClick={handleRunAudit}
            disabled={auditLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-accent text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
          >
            {auditLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            RUN AUDIT
          </button>
        </div>

        {auditReport ? (
          <div className="space-y-3">
            <div className="flex gap-4 text-xs font-mono text-muted-foreground">
              <span>Audited: {auditReport.total_chapters_audited}</span>
              <span>Clean: {auditReport.clean_chapters}</span>
              <span>Flagged: {auditReport.flagged_chapters}</span>
              <span>Date: {new Date(auditReport.audit_date).toLocaleDateString()}</span>
            </div>

            {auditReport.violations.length > 0 && (
              <div className="border border-border">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="p-2 text-left">Ch</th>
                      <th className="p-2 text-left">Type</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-left">Fix</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditReport.violations.map((v) => (
                      <ViolationRow
                        key={v.id}
                        violation={v}
                        onResolve={handleResolveViolation}
                        onOpenRevision={handleReviewChapter}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {auditReport.warnings.length > 0 && (
              <div className="space-y-1">
                {auditReport.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-warning font-mono">⚠ {w}</p>
                ))}
              </div>
            )}

            {auditReport.violations.length === 0 && auditReport.warnings.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-success font-mono">
                <CheckCircle className="w-3.5 h-3.5" />
                All chapters clean — no continuity violations detected
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground font-mono">No audit run yet</p>
        )}
      </section>

      {/* ── SCENE REVISION TOOL ──────────────────────────────────── */}
      <section id="revision-tool" className="border border-border bg-card p-4">
        <h2 className="text-sm font-semibold tracking-wide text-foreground mb-3">SCENE REVISION TOOL</h2>

        <div className="space-y-3">
          <div className="flex gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground font-mono block mb-1">Chapter</label>
              <input
                type="number"
                min={1}
                max={60}
                value={revisionChapter}
                onChange={(e) => setRevisionChapter(Number(e.target.value))}
                className="w-20 px-2 py-1.5 bg-background border border-border text-foreground text-xs font-mono"
              />
            </div>
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <input
                  type="checkbox"
                  checked={scenePurposeChanged}
                  onChange={(e) => setScenePurposeChanged(e.target.checked)}
                  className="accent-accent"
                />
                Scene purpose changed
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <input
                  type="checkbox"
                  checked={structuralChange}
                  onChange={(e) => setStructuralChange(e.target.checked)}
                  className="accent-accent"
                />
                Structural change
              </label>
            </div>
          </div>

          <textarea
            value={revisionInstruction}
            onChange={(e) => setRevisionInstruction(e.target.value)}
            placeholder="Describe the desired revision..."
            rows={3}
            className="w-full px-3 py-2 bg-background border border-border text-foreground text-xs font-mono resize-none"
          />

          <div className="flex gap-2">
            <button
              onClick={handleAssessScope}
              disabled={!revisionInstruction.trim()}
              className="px-3 py-1.5 text-xs font-mono border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              ASSESS SCOPE
            </button>
            <button
              onClick={handleExecuteRevision}
              disabled={!revisionInstruction.trim() || revisionLoading}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-accent text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
            >
              {revisionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              EXECUTE REVISION
            </button>
          </div>

          {scopePreview && (
            <div className="px-3 py-2 border border-border bg-muted/50 text-xs font-mono text-muted-foreground">
              <FileText className="w-3.5 h-3.5 inline mr-1.5" />
              {scopePreview}
            </div>
          )}

          {/* Diff View */}
          {revisionResult && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">
                  Scope: {revisionResult.scope.scope} · Status: {revisionResult.status}
                </span>
                {revisionResult.status === "PENDING_REVIEW" && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleAcceptRevision}
                      className="px-3 py-1 text-xs font-mono border border-success text-success hover:bg-success/10 transition-colors"
                    >
                      ACCEPT
                    </button>
                    <button
                      onClick={handleRejectRevision}
                      className="px-3 py-1 text-xs font-mono border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      REJECT
                    </button>
                  </div>
                )}
              </div>

              <div className="border border-border max-h-64 overflow-y-auto">
                {revisionResult.diff.map((line, i) => (
                  <div
                    key={i}
                    className={`px-3 py-0.5 text-xs font-mono ${
                      line.type === "added"
                        ? "bg-success/10 text-success"
                        : line.type === "removed"
                        ? "bg-destructive/10 text-destructive line-through"
                        : "text-muted-foreground"
                    }`}
                  >
                    <span className="inline-block w-5 text-right mr-2 opacity-50">{line.line_number}</span>
                    {line.type === "added" ? "+ " : line.type === "removed" ? "- " : "  "}
                    {line.content}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── COMPULSION CURVE DASHBOARD ───────────────────────────── */}
      <section className="border border-border bg-card p-4">
        <h2 className="text-sm font-semibold tracking-wide text-foreground mb-3">COMPULSION CURVE</h2>
        <CompulsionCurveDashboard onReviewChapter={handleReviewChapter} />
      </section>

      {/* ── VOICE REGISTER REVIEW ────────────────────────────────── */}
      <section className="border border-border bg-card p-4">
        <h2 className="text-sm font-semibold tracking-wide text-foreground mb-3">VOICE REGISTER REVIEW</h2>
        <VoiceRegisterReview projectId={PROJECT_ID} />
      </section>

      {/* ── OUTLINE AMENDMENT ────────────────────────────────────── */}
      <section className="border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold tracking-wide text-foreground">OUTLINE AMENDMENT</h2>
          {showAmendButton && (
            <button
              onClick={() => setShowAmendForm(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-accent text-accent hover:bg-accent/10 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              AMEND OUTLINE
            </button>
          )}
        </div>

        {!showAmendButton && (
          <p className="text-xs text-muted-foreground font-mono">
            Amend Outline available after first chapter is approved.
          </p>
        )}

        {/* Amendment Form */}
        {showAmendForm && (
          <div className="border border-border p-3 mb-4 space-y-3">
            <div className="flex gap-3 items-end">
              <div>
                <label className="text-xs text-muted-foreground font-mono block mb-1">Type</label>
                <select
                  value={amendType}
                  onChange={(e) => setAmendType(e.target.value as AmendmentType)}
                  className="px-2 py-1.5 bg-background border border-border text-foreground text-xs font-mono"
                >
                  <option value="CHAPTER">CHAPTER</option>
                  <option value="CHARACTER">CHARACTER</option>
                  <option value="STRUCTURAL">STRUCTURAL</option>
                  <option value="TWIST">TWIST</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-mono block mb-1">Description</label>
              <textarea
                value={amendDescription}
                onChange={(e) => setAmendDescription(e.target.value)}
                placeholder="Describe the amendment..."
                rows={2}
                className="w-full px-3 py-2 bg-background border border-border text-foreground text-xs font-mono resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-mono block mb-1">Fields changed (comma-separated paths)</label>
              <input
                value={amendFields}
                onChange={(e) => setAmendFields(e.target.value)}
                placeholder="chapters.3.scene_purpose, chapters.3.hook_type"
                className="w-full px-3 py-1.5 bg-background border border-border text-foreground text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-mono block mb-1">New values (JSON)</label>
              <textarea
                value={amendNewValues}
                onChange={(e) => setAmendNewValues(e.target.value)}
                placeholder='{"chapters.3.scene_purpose": "New purpose"}'
                rows={2}
                className="w-full px-3 py-2 bg-background border border-border text-foreground text-xs font-mono resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreateAmendment}
                disabled={!amendDescription.trim() || !amendFields.trim() || amendLoading}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-accent text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
              >
                {amendLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                CREATE & AUDIT
              </button>
              <button
                onClick={() => setShowAmendForm(false)}
                className="px-3 py-1.5 text-xs font-mono border border-border text-muted-foreground hover:bg-muted transition-colors"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        {/* Amendment History */}
        {amendments.length > 0 && (
          <div className="space-y-3">
            {amendments.map((amendment) => (
              <AmendmentCard
                key={amendment.id}
                amendment={amendment}
                onResolveChapter={handleResolveAmendChapter}
                onApply={handleApplyAmendment}
                onReject={handleRejectAmendment}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function StatusCard({ label, value, variant }: { label: string; value: number; variant?: "warning" }) {
  return (
    <div className="border border-border p-3 text-center">
      <p className={`text-2xl font-semibold ${variant === "warning" ? "text-warning" : "text-foreground"}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground font-mono mt-1">{label}</p>
    </div>
  );
}

function ViolationRow({
  violation,
  onResolve,
  onOpenRevision,
}: {
  violation: ContinuityViolation;
  onResolve: (id: string) => void;
  onOpenRevision: (chapter: number) => void;
}) {
  return (
    <tr className={`border-b border-border ${violation.resolved ? "opacity-40" : ""}`}>
      <td className="p-2">{violation.chapter_number}</td>
      <td className="p-2">
        <span className="px-1.5 py-0.5 border border-border text-[10px]">
          {violation.violation_type.replace("_", " ")}
        </span>
      </td>
      <td className="p-2 text-foreground">{violation.description}</td>
      <td className="p-2 text-muted-foreground">{violation.suggested_fix}</td>
      <td className="p-2 text-right whitespace-nowrap">
        {!violation.resolved && (
          <div className="flex gap-1.5 justify-end">
            <button
              onClick={() => onResolve(violation.id)}
              className="px-2 py-0.5 border border-success text-success text-[10px] hover:bg-success/10 transition-colors"
            >
              MARK RESOLVED
            </button>
            <button
              onClick={() => onOpenRevision(violation.chapter_number)}
              className="px-2 py-0.5 border border-accent text-accent text-[10px] hover:bg-accent/10 transition-colors"
            >
              OPEN REVISION
            </button>
          </div>
        )}
        {violation.resolved && (
          <span className="text-success text-[10px] flex items-center gap-1 justify-end">
            <CheckCircle className="w-3 h-3" /> Resolved
          </span>
        )}
      </td>
    </tr>
  );
}

function AmendmentCard({
  amendment,
  onResolveChapter,
  onApply,
  onReject,
}: {
  amendment: OutlineAmendment;
  onResolveChapter: (amendmentId: string, chapter: number, action: SuggestedAction) => void;
  onApply: (amendmentId: string) => void;
  onReject: (amendmentId: string) => void;
}) {
  const statusColors: Record<string, string> = {
    DRAFT: "text-muted-foreground border-border",
    IMPACT_AUDIT: "text-warning border-warning",
    CONFIRMED: "text-accent border-accent",
    APPLIED: "text-success border-success",
    REJECTED: "text-destructive border-destructive",
  };

  const canApply = amendment.status === "IMPACT_AUDIT" && allChaptersResolved(amendment);

  return (
    <div className="border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono px-1.5 py-0.5 border ${statusColors[amendment.status] || ""}`}>
            {amendment.status}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 border border-border">
            {amendment.amendment_type}
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          {new Date(amendment.created_at).toLocaleDateString()}
        </span>
      </div>

      <p className="text-xs font-mono text-foreground">{amendment.description}</p>
      <p className="text-[10px] font-mono text-muted-foreground">
        Fields: {amendment.fields_changed.join(", ")}
      </p>

      {/* Impact Audit Results */}
      {amendment.impact_audit && amendment.impact_audit.at_risk_chapters.length > 0 && (
        <div className="border border-border">
          <div className="px-2 py-1 border-b border-border text-[10px] font-mono text-muted-foreground flex justify-between">
            <span>AT-RISK CHAPTERS</span>
            <span className={`px-1.5 border ${
              amendment.impact_audit.risk_level === "HIGH" ? "border-destructive text-destructive" :
              amendment.impact_audit.risk_level === "MEDIUM" ? "border-warning text-warning" :
              "border-success text-success"
            }`}>
              {amendment.impact_audit.risk_level}
            </span>
          </div>
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="p-1.5 text-left">Ch</th>
                <th className="p-1.5 text-left">Risk</th>
                <th className="p-1.5 text-left">Description</th>
                <th className="p-1.5 text-right">Resolution</th>
              </tr>
            </thead>
            <tbody>
              {amendment.impact_audit.at_risk_chapters.map((ch) => {
                const resolved = amendment.chapter_resolutions[ch.chapter_number];
                return (
                  <tr key={ch.chapter_number} className="border-b border-border last:border-0">
                    <td className="p-1.5">{ch.chapter_number}</td>
                    <td className="p-1.5">{ch.risk_type}</td>
                    <td className="p-1.5 text-foreground">{ch.description}</td>
                    <td className="p-1.5 text-right">
                      {resolved ? (
                        <span className="text-success">{resolved}</span>
                      ) : amendment.status === "IMPACT_AUDIT" ? (
                        <div className="flex gap-1 justify-end">
                          {(["ACCEPT_RISK", "FLAG_FOR_REVISION", "RETROACTIVE_CONTINUITY"] as SuggestedAction[]).map((action) => (
                            <button
                              key={action}
                              onClick={() => onResolveChapter(amendment.id, ch.chapter_number, action)}
                              className="px-1 py-0.5 border border-border hover:bg-muted transition-colors text-[9px]"
                            >
                              {action.replace(/_/g, " ")}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {amendment.impact_audit && amendment.impact_audit.at_risk_chapters.length === 0 && (
        <p className="text-[10px] font-mono text-success">No chapters at risk.</p>
      )}

      {/* Action buttons */}
      {amendment.status === "IMPACT_AUDIT" && (
        <div className="flex gap-2">
          <button
            onClick={() => onApply(amendment.id)}
            disabled={!canApply}
            className="px-2 py-1 text-[10px] font-mono border border-success text-success hover:bg-success/10 transition-colors disabled:opacity-50"
          >
            APPLY AMENDMENT
          </button>
          <button
            onClick={() => onReject(amendment.id)}
            className="px-2 py-1 text-[10px] font-mono border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
          >
            REJECT
          </button>
        </div>
      )}
    </div>
  );
}