/**
 * Recovery UIs — All 7 platform failure mode recovery interfaces.
 * GHOSTLY v2.2 · Session 18
 *
 * Components: RevisionEscalation, ContextOverflow, ProviderOutage,
 * ModelVoiceDrift, ContentRefusal, MemoryDesync, GitHubDisconnection.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// ── Shared Types ────────────────────────────────────────────────────────

interface RecoveryProps {
  onResolve: (resolution: string) => void;
  onDismiss?: () => void;
}

// ── 1. Revision Loop Escalation ─────────────────────────────────────────

interface RevisionEscalationProps extends RecoveryProps {
  attemptCount: number;
  chapterNumber: number;
}

export function RevisionEscalation({ attemptCount, chapterNumber, onResolve }: RevisionEscalationProps) {
  return (
    <div className="border border-destructive bg-destructive/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="font-mono text-xs">ESCALATION</Badge>
        <h3 className="text-sm font-mono text-foreground font-bold">
          Revision Loop Exhausted — Chapter {chapterNumber}
        </h3>
      </div>
      <p className="text-xs text-muted-foreground font-mono">
        {attemptCount} failed revision attempts. Automatic revision is no longer viable.
      </p>
      <Separator />
      <div className="grid grid-cols-2 gap-2">
        {[
          ["ACCEPT_CURRENT_BEST", "Accept Current Best"],
          ["MANUAL_REWRITE", "Manual Rewrite"],
          ["REBUILD_BRIEF", "Rebuild Brief"],
          ["ESCALATE_HUMAN", "Escalate to Human Review"],
        ].map(([val, label]) => (
          <Button
            key={val}
            variant="outline"
            size="sm"
            onClick={() => onResolve(val)}
            className="font-mono text-xs"
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ── 2. Context Overflow ─────────────────────────────────────────────────

interface ContextOverflowProps extends RecoveryProps {
  overflowTokens: number;
  budgetTokens: number;
}

export function ContextOverflow({ overflowTokens, budgetTokens, onResolve }: ContextOverflowProps) {
  return (
    <div className="border border-warning bg-warning/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Badge className="bg-warning text-warning-foreground font-mono text-xs">OVERFLOW</Badge>
        <h3 className="text-sm font-mono text-foreground font-bold">Context Ceiling Exceeded</h3>
      </div>
      <p className="text-xs text-muted-foreground font-mono">
        Context ceiling exceeded by {overflowTokens.toLocaleString()} tokens
        (budget: {budgetTokens.toLocaleString()}T).
      </p>
      <Separator />
      <div className="flex gap-2">
        {[
          ["REDUCE_TIER2", "Reduce Tier 2 Scope"],
          ["INCREASE_BUDGET", "Increase Budget"],
          ["SPLIT_CHAPTER", "Split Chapter"],
        ].map(([val, label]) => (
          <Button
            key={val}
            variant="outline"
            size="sm"
            onClick={() => onResolve(val)}
            className="font-mono text-xs"
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ── 3. Provider Outage ──────────────────────────────────────────────────

interface ProviderOutageProps extends RecoveryProps {
  primaryProvider: string;
  fallbackProvider: string;
  chapterNumber: number;
}

export function ProviderOutage({ primaryProvider, fallbackProvider, chapterNumber, onResolve, onDismiss }: ProviderOutageProps) {
  return (
    <div className="border border-warning bg-warning/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Badge className="bg-warning text-warning-foreground font-mono text-xs">OUTAGE</Badge>
        <h3 className="text-sm font-mono text-foreground font-bold">Provider Unavailable</h3>
      </div>
      <p className="text-xs text-muted-foreground font-mono">
        {primaryProvider} is unavailable for Chapter {chapterNumber}.
        Using fallback provider <span className="text-foreground">{fallbackProvider}</span>.
        Quality may vary. Chapter will receive <span className="text-warning">pending_quality_review</span> status.
      </p>
      <Separator />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onResolve("PROCEED_FALLBACK")} className="font-mono text-xs">
          Proceed with Fallback
        </Button>
        <Button variant="outline" size="sm" onClick={() => onResolve("WAIT_RETRY")} className="font-mono text-xs">
          Wait and Retry
        </Button>
        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss} className="font-mono text-xs">
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
}

// ── 4. Model Voice Drift ────────────────────────────────────────────────

interface ModelVoiceDriftProps extends RecoveryProps {
  severity: "AMBER" | "RED";
  previousModel: string;
  currentModel: string;
}

export function ModelVoiceDrift({ severity, previousModel, currentModel, onResolve, onDismiss }: ModelVoiceDriftProps) {
  const isRed = severity === "RED";
  return (
    <div className={`border p-4 space-y-3 ${isRed ? "border-destructive bg-destructive/5" : "border-warning bg-warning/5"}`}>
      <div className="flex items-center gap-2">
        <Badge className={`font-mono text-xs ${isRed ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}`}>
          {severity}
        </Badge>
        <h3 className="text-sm font-mono text-foreground font-bold">Model Version Change Detected</h3>
      </div>
      <p className="text-xs text-muted-foreground font-mono">
        Model changed: <span className="text-foreground">{previousModel}</span> → <span className="text-foreground">{currentModel}</span>
      </p>
      {isRed ? (
        <>
          <p className="text-xs text-destructive font-mono font-bold">
            Major version change. Benchmark re-check mandatory before generation resumes.
          </p>
          <Button size="sm" onClick={() => onResolve("RUN_BENCHMARK")} className="font-mono text-xs">
            RUN BENCHMARK RE-CHECK
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-warning font-mono">
            Minor version update. Monitor next 3 chapters for register drift.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onResolve("ACKNOWLEDGED")} className="font-mono text-xs">
              Acknowledge
            </Button>
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss} className="font-mono text-xs">
                Dismiss
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── 5. Content Refusal ──────────────────────────────────────────────────

interface ContentRefusalProps extends RecoveryProps {
  chapterNumber: number;
}

export function ContentRefusal({ chapterNumber, onResolve }: ContentRefusalProps) {
  return (
    <div className="border border-destructive bg-destructive/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="font-mono text-xs">REFUSAL</Badge>
        <h3 className="text-sm font-mono text-foreground font-bold">
          Content Refusal — Chapter {chapterNumber}
        </h3>
      </div>
      <p className="text-xs text-muted-foreground font-mono">
        The LLM refused to generate content. This is NOT a quality gate failure.
      </p>
      <Separator />
      <div className="grid grid-cols-2 gap-2">
        {[
          ["REVISE_BRIEF", "Revise Brief"],
          ["REFRAME_SCENE", "Reframe Scene Purpose"],
          ["MANUAL_WRITE", "Manual Write"],
          ["ESCALATE", "Escalate"],
        ].map(([val, label]) => (
          <Button
            key={val}
            variant="outline"
            size="sm"
            onClick={() => onResolve(val)}
            className="font-mono text-xs"
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ── 6. Memory Desync ────────────────────────────────────────────────────

interface MemoryDesyncProps extends RecoveryProps {
  approvedCount: number;
  memoryUpdateCount: number;
}

export function MemoryDesync({ approvedCount, memoryUpdateCount, onResolve }: MemoryDesyncProps) {
  return (
    <div className="border border-warning bg-warning/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Badge className="bg-warning text-warning-foreground font-mono text-xs">DESYNC</Badge>
        <h3 className="text-sm font-mono text-foreground font-bold">Memory Core Desync Detected</h3>
      </div>
      <p className="text-xs text-muted-foreground font-mono">
        Approved chapters: {approvedCount} · Memory updates: {memoryUpdateCount}.
        Memory state may be inconsistent.
      </p>
      <Separator />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onResolve("RECONSTRUCT")} className="font-mono text-xs">
          Reconstruct
        </Button>
        <Button variant="outline" size="sm" onClick={() => onResolve("MANUAL_REVIEW")} className="font-mono text-xs">
          Manual Review
        </Button>
      </div>
    </div>
  );
}

// ── 7. GitHub Disconnection (re-export for completeness) ────────────────

interface GitHubDisconnectionProps extends RecoveryProps {
  lastConnectedAt: string | null;
}

export function GitHubDisconnection({ lastConnectedAt, onResolve }: GitHubDisconnectionProps) {
  return (
    <div className="border border-destructive bg-destructive/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="font-mono text-xs">DISCONNECTED</Badge>
        <h3 className="text-sm font-mono text-foreground font-bold">GitHub Disconnected</h3>
      </div>
      <p className="text-xs text-muted-foreground font-mono">
        Generation paused. Last connected: {lastConnectedAt ?? "unknown"}.
      </p>
      <Separator />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onResolve("RECONNECT")} className="font-mono text-xs">
          Reconnect
        </Button>
        <Button variant="outline" size="sm" onClick={() => onResolve("EXPORT_BACKUP")} className="font-mono text-xs">
          Export Backup
        </Button>
      </div>
    </div>
  );
}
