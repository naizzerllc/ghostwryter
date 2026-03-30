/**
 * Living State Dashboard Panel — Shows current story state summary.
 * GHOSTLY v2.2 · Session 13
 */

import { useState, useEffect } from "react";
import {
  getLivingState,
  checkMemoryDesync,
  type LivingState,
  type MemoryDesyncResult,
} from "@/modules/livingState/livingState";

const LivingStatePanel = () => {
  const [state, setState] = useState<LivingState | null>(null);
  const [desync, setDesync] = useState<MemoryDesyncResult | null>(null);

  useEffect(() => {
    const ls = getLivingState("default");
    setState(ls);
    if (ls.chapter_update_log.length > 0) {
      const approved = ls.chapter_update_log.map((e) => e.chapter_number);
      setDesync(checkMemoryDesync(approved, "default"));
    }
  }, []);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground">Last Chapter</p>
          <p className="text-sm font-mono">
            {state?.last_updated_chapter || "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Clocks</p>
          <p className="text-sm font-mono">
            {state?.clock_states.length ?? 0}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Characters</p>
          <p className="text-sm font-mono">
            {state?.character_sliders.length ?? 0}
          </p>
        </div>
      </div>

      {state?.emotional_state_at_chapter_end && (
        <div className="border-t border-border pt-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            Emotional State
          </p>
          <p className="text-xs text-foreground">
            {state.emotional_state_at_chapter_end}
          </p>
        </div>
      )}

      {/* Memory Desync */}
      <div className="border-t border-border pt-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          Memory Sync
        </p>
        {desync ? (
          <p
            className={`text-sm font-mono ${
              desync.in_sync ? "text-success" : "text-warning"
            }`}
          >
            {desync.in_sync
              ? "✓ IN SYNC"
              : `⚠ DESYNC — ${desync.missing_chapters.length} unconfirmed`}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No updates yet</p>
        )}
      </div>

      {/* Breadcrumbs */}
      <div className="border-t border-border pt-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          Breadcrumbs
        </p>
        <p className="text-sm font-mono">
          {state?.active_breadcrumbs.length ?? 0} tracked
        </p>
      </div>
    </div>
  );
};

export default LivingStatePanel;
