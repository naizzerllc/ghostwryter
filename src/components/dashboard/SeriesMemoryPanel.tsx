/**
 * Series Memory Panel — Dashboard display of cross-title memory state.
 * GHOSTLY v2.2 · S11
 */

import { useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  type SeriesMemorySnapshot,
} from "@/modules/seriesMemory/seriesMemory";

const SeriesMemoryPanel = () => {
  const snap: SeriesMemorySnapshot = useSyncExternalStore(subscribe, getSnapshot);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Series</p>
          <p className="text-sm font-mono">{snap.seriesActive ? "ACTIVE" : "OFF"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Titles</p>
          <p className="text-sm font-mono">{snap.count}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</p>
          <p className={`text-sm font-mono ${snap.seriesActive ? "text-success" : "text-muted-foreground"}`}>
            {snap.seriesActive ? "Book 2+" : "Book 1"}
          </p>
        </div>
      </div>

      {snap.memories.length > 0 && (
        <div className="border-t border-border pt-2 space-y-1 max-h-24 overflow-y-auto">
          {snap.memories.map(m => (
            <div key={m.title_id} className="flex justify-between items-center py-0.5">
              <span className="text-xs font-mono">{m.title_name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-muted-foreground">
                  ~{m.token_estimate}T
                </span>
                <span className="text-[9px] font-mono text-muted-foreground">
                  Book {m.sequence_number}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!snap.seriesActive && (
        <p className="text-[9px] font-mono text-muted-foreground">
          Series memory activates for Book 2+ in a trilogy/series.
        </p>
      )}
    </div>
  );
};

export default SeriesMemoryPanel;
