/**
 * Clinical Accuracy Tab — Displays medical fact-checker results.
 * GHOSTLY v2.2 · Session 22
 *
 * Advisory only — never blocks approval automatically.
 * Writer resolves each flagged claim before approval is enabled.
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  MedicalFactCheckResult,
  MedicalClaim,
  WriterDecision,
} from "@/modules/quality/medicalFactChecker";

// ── Types ───────────────────────────────────────────────────────────────

interface ClinicalAccuracyTabProps {
  result: MedicalFactCheckResult | null;
  onClaimDecisionChange: (claimId: string, decision: WriterDecision, reasoning?: string) => void;
}

// ── Verdict Badge ───────────────────────────────────────────────────────

function VerdictBadge({ verdict, severity }: { verdict: string; severity: string }) {
  const colorMap: Record<string, string> = {
    WRONG_FACT: "bg-destructive/20 text-destructive border-destructive/40",
    ROLE_ERROR: "bg-destructive/20 text-destructive border-destructive/40",
    REGISTER_ADVISORY: "bg-primary/20 text-primary border-primary/40",
    NONE: "bg-success/20 text-success border-success/40",
  };

  const label = severity === "NONE" ? verdict : severity.replace("_", " ");

  return (
    <Badge variant="outline" className={`font-mono text-[10px] ${colorMap[severity] || colorMap.NONE}`}>
      {label}
    </Badge>
  );
}

// ── Decision Selector ───────────────────────────────────────────────────

const DECISION_OPTIONS: { value: WriterDecision; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "ACCEPT_AS_WRITTEN", label: "Accept as Written" },
  { value: "CORRECT_BEFORE_APPROVAL", label: "Correct Before Approval" },
  { value: "INTENTIONAL_DEVICE", label: "Intentional Device" },
];

function ClaimRow({
  claim,
  onDecisionChange,
}: {
  claim: MedicalClaim;
  onDecisionChange: (decision: WriterDecision, reasoning?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [reasoning, setReasoning] = useState(claim.writer_reasoning ?? "");
  const [decision, setDecision] = useState<WriterDecision>(claim.writer_decision);

  function handleDecision(d: WriterDecision) {
    setDecision(d);
    if (d !== "INTENTIONAL_DEVICE") {
      onDecisionChange(d);
    }
  }

  function handleReasoningSave() {
    onDecisionChange("INTENTIONAL_DEVICE", reasoning);
  }

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between py-2 px-3 text-left hover:bg-muted/30 transition-colors border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
              {claim.claim_id}
            </span>
            <span className="text-xs font-mono text-foreground truncate">
              {claim.text_excerpt.slice(0, 60)}…
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <VerdictBadge verdict={claim.composite_verdict} severity={claim.severity} />
            {decision !== "PENDING" && (
              <Badge variant="outline" className="font-mono text-[10px] bg-success/10 text-success border-success/30">
                ✓
              </Badge>
            )}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 py-3 bg-muted/10 space-y-3 border-b border-border">
          {/* Excerpt */}
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Excerpt</p>
            <p className="text-xs font-serif text-foreground leading-relaxed italic">
              "{claim.text_excerpt}"
            </p>
          </div>

          {/* Type + Verdict */}
          <div className="flex gap-4">
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase">Type</p>
              <p className="text-xs font-mono text-foreground">{claim.claim_type}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase">Verdict</p>
              <p className="text-xs font-mono text-foreground">{claim.composite_verdict}</p>
            </div>
          </div>

          {/* Correction (WRONG_FACT / ROLE_ERROR) */}
          {claim.correction && (
            <div className="border border-destructive/30 bg-destructive/5 p-2">
              <p className="text-[10px] font-mono text-destructive uppercase mb-1">Correction</p>
              <p className="text-xs font-mono text-foreground">{claim.correction}</p>
            </div>
          )}

          {/* Elevation Note (REGISTER_ADVISORY) */}
          {claim.elevation_note && (
            <div className="border border-primary/30 bg-primary/5 p-2">
              <p className="text-[10px] font-mono text-primary uppercase mb-1">Elevation Note</p>
              <p className="text-xs font-mono text-foreground">{claim.elevation_note}</p>
            </div>
          )}

          {/* Writer Decision */}
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Writer Decision</p>
            <div className="flex flex-wrap gap-1">
              {DECISION_OPTIONS.filter(o => o.value !== "PENDING").map(opt => (
                <Button
                  key={opt.value}
                  variant={decision === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleDecision(opt.value)}
                  className="font-mono text-[10px]"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Intentional Device reasoning */}
          {decision === "INTENTIONAL_DEVICE" && (
            <div className="space-y-1">
              <Textarea
                placeholder="Explain why this is an intentional creative choice..."
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                className="font-mono text-xs min-h-[60px]"
              />
              <Button
                onClick={handleReasoningSave}
                size="sm"
                disabled={reasoning.length < 5}
                className="font-mono text-[10px]"
              >
                SAVE REASONING
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function ClinicalAccuracyTab({ result, onClaimDecisionChange }: ClinicalAccuracyTabProps) {
  // No result yet
  if (!result) {
    return (
      <div className="border border-border bg-card p-4">
        <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Clinical Accuracy</h3>
        <p className="text-xs font-mono text-muted-foreground mt-2">
          Medical fact-check has not run yet.
        </p>
      </div>
    );
  }

  // Disabled
  if (!result.medical_fact_check_active) {
    return (
      <div className="border border-border bg-card p-4">
        <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Clinical Accuracy</h3>
        <p className="text-xs font-mono text-muted-foreground mt-2">
          Medical fact-checking is disabled for this project.
        </p>
      </div>
    );
  }

  // No clinical content
  if (result.no_medical_claims_detected) {
    return (
      <div className="border border-border bg-card p-4">
        <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Clinical Accuracy</h3>
        <p className="text-xs font-mono text-muted-foreground mt-2">
          No clinical claims detected in this chapter.
        </p>
      </div>
    );
  }

  // Parse error
  if (result.parse_error) {
    return (
      <div className="border border-warning bg-warning/10 p-4">
        <h3 className="text-sm font-mono text-warning uppercase tracking-wider">Clinical Accuracy</h3>
        <p className="text-xs font-mono text-foreground mt-2">
          Medical fact-check failed to parse. Manual review recommended.
        </p>
      </div>
    );
  }

  const flaggedClaims = result.claims.filter(c => c.severity !== "NONE");
  const pendingFlags = flaggedClaims.filter(c => c.writer_decision === "PENDING");

  return (
    <div className="border border-border bg-card space-y-0">
      {/* Header */}
      <div className="p-4 space-y-2">
        <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Clinical Accuracy</h3>

        {/* Summary */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-foreground">{result.claims_evaluated} claims evaluated</span>
          <span className="text-muted-foreground">—</span>
          <span className="text-success">{result.claims_accurate} accurate</span>
          {result.claims_plausible_but_imprecise > 0 && (
            <span className="text-warning">{result.claims_plausible_but_imprecise} imprecise</span>
          )}
          {result.claims_wrong > 0 && (
            <span className="text-destructive">{result.claims_wrong} wrong</span>
          )}
        </div>

        {/* Pending indicator */}
        {pendingFlags.length > 0 && (
          <p className="text-[10px] font-mono text-warning">
            ⚠ {pendingFlags.length} flagged claim{pendingFlags.length !== 1 ? "s" : ""} awaiting writer decision
          </p>
        )}
      </div>

      <Separator />

      {/* Flagged Claims */}
      {flaggedClaims.length > 0 && (
        <div>
          {flaggedClaims.map(claim => (
            <ClaimRow
              key={claim.claim_id}
              claim={claim}
              onDecisionChange={(decision, reasoning) =>
                onClaimDecisionChange(claim.claim_id, decision, reasoning)
              }
            />
          ))}
        </div>
      )}

      {/* Accurate-only claims (collapsed summary) */}
      {result.claims.filter(c => c.severity === "NONE").length > 0 && (
        <div className="px-4 py-2">
          <p className="text-[10px] font-mono text-muted-foreground">
            {result.claims.filter(c => c.severity === "NONE").length} claim{result.claims.filter(c => c.severity === "NONE").length !== 1 ? "s" : ""} verified accurate — no action required
          </p>
        </div>
      )}

      {/* Register Advisory Summary */}
      {result.institutional_register_flags > 0 && result.register_advisory_summary && (
        <>
          <Separator />
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button className="w-full px-4 py-2 text-left hover:bg-muted/30 transition-colors">
                <p className="text-[10px] font-mono text-primary uppercase tracking-wider">
                  Register Advisory ({result.institutional_register_flags} flag{result.institutional_register_flags !== 1 ? "s" : ""})
                </p>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-3">
                <p className="text-xs font-mono text-foreground leading-relaxed">
                  {result.register_advisory_summary}
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
}
