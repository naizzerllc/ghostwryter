/**
 * Character DB Panel — Dashboard display of character registry and Voice DNA status.
 * GHOSTLY v2.2 · Prompt 02
 */

import { useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  type CharacterDBSnapshot,
} from "@/modules/characterDB/characterDB";

const CharacterDBPanel = () => {
  const snap: CharacterDBSnapshot = useSyncExternalStore(subscribe, getSnapshot);

  if (snap.count === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-mono">No characters loaded</p>
        <p className="text-[10px] text-muted-foreground">
          Import a Story Bible or add characters via console to populate the Character DB.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total</p>
          <p className="text-sm font-mono">{snap.count}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Voice DNA</p>
          <p className="text-sm font-mono">
            <span className="text-success">{snap.voiceDnaComplete}</span>
            {snap.voiceDnaMissing > 0 && (
              <span className="text-warning"> / {snap.voiceDnaMissing} missing</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Roles</p>
          <p className="text-[10px] font-mono text-muted-foreground">
            P:{snap.byRole.protagonist} A:{snap.byRole.antagonist} S:{snap.byRole.supporting}
          </p>
        </div>
      </div>

      {/* Character list */}
      <div className="border-t border-border pt-2 space-y-1">
        {snap.characters.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between py-1 border-b border-border/50 last:border-0"
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 ${
                  c.role === "protagonist"
                    ? "bg-primary"
                    : c.role === "antagonist"
                    ? "bg-destructive"
                    : "bg-muted-foreground"
                }`}
              />
              <span className="text-xs font-mono">{c.name}</span>
              <span className="text-[9px] text-muted-foreground uppercase">{c.role}</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[9px] font-mono uppercase ${
                  c.voice_corpus_status === "APPROVED"
                    ? "text-success"
                    : c.voice_corpus_status === "REJECTED"
                    ? "text-destructive"
                    : "text-warning"
                }`}
              >
                {c.voice_corpus_status}
              </span>
              <span
                className={`text-[9px] font-mono ${
                  c.voice_reliability === "HIGH" ? "text-success" : "text-warning"
                }`}
              >
                {c.voice_reliability === "HIGH" ? "DNA ✓" : "DNA —"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CharacterDBPanel;
