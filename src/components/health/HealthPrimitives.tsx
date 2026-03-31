/**
 * Shared primitives for the Manuscript Health dashboard panels.
 * GHOSTLY v2.2 · Session 27
 */

import React from "react";

export function HealthPanel({ title, children, updated }: { title: string; children: React.ReactNode; updated?: string }) {
  return (
    <div className="border border-border bg-card p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{title}</h4>
        {updated && <span className="text-[9px] font-mono text-muted-foreground">{updated}</span>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function StatusBadge({ status, color }: { status: string; color: "success" | "warning" | "destructive" | "muted" }) {
  const colorMap = {
    success: "bg-success/20 text-success",
    warning: "bg-warning/20 text-warning",
    destructive: "bg-destructive/20 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  return <span className={`text-[10px] font-mono px-2 py-0.5 ${colorMap[color]}`}>{status}</span>;
}

export function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[9px] uppercase text-muted-foreground font-mono">{label}</p>
      <p className="text-sm font-mono text-foreground">{value}</p>
    </div>
  );
}
