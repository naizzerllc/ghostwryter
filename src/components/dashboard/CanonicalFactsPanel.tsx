/**
 * Canonical Facts Panel — Dashboard display of fact counts by category.
 * GHOSTLY v2.2 · S11
 */

import { useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  type CanonicalFactsSnapshot,
} from "@/modules/canonicalFacts/canonicalFactsDB";
import { getDependencyWarning } from "@/modules/knowledgeBoundary/knowledgeBoundaryMap";

const CATEGORY_LABELS: Record<string, string> = {
  CHARACTER_FACT: "Character",
  TIMELINE_FACT: "Timeline",
  LOCATION_FACT: "Location",
  REVELATION_FACT: "Revelation",
  BACKSTORY_FACT: "Backstory",
};

const CanonicalFactsPanel = () => {
  const snap: CanonicalFactsSnapshot = useSyncExternalStore(subscribe, getSnapshot);
  const warning = getDependencyWarning();

  return (
    <div className="space-y-3">
      {warning && (
        <p className="text-[9px] font-mono text-warning bg-warning/10 px-2 py-1">
          ⚠ {warning}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Facts</p>
          <p className="text-sm font-mono">{snap.count}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Revelation</p>
          <p className="text-sm font-mono text-primary">{snap.byCategory.REVELATION_FACT}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Character</p>
          <p className="text-sm font-mono">{snap.byCategory.CHARACTER_FACT}</p>
        </div>
      </div>

      {snap.count > 0 && (
        <div className="border-t border-border pt-2 space-y-1">
          {Object.entries(snap.byCategory)
            .filter(([, count]) => count > 0)
            .map(([cat, count]) => (
              <div key={cat} className="flex justify-between items-center py-0.5">
                <span className="text-xs font-mono">{CATEGORY_LABELS[cat] || cat}</span>
                <span className="text-[9px] font-mono text-muted-foreground">{count}</span>
              </div>
            ))}
        </div>
      )}

      {snap.count === 0 && !warning && (
        <p className="text-[9px] font-mono text-muted-foreground">
          No canonical facts extracted yet. Run extraction from an approved outline.
        </p>
      )}
    </div>
  );
};

export default CanonicalFactsPanel;
