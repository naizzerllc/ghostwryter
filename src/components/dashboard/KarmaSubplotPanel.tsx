/**
 * Karma & Subplots Dashboard Panel — Shows karma status and subplot thread tracker.
 * GHOSTLY v2.2 · Session 13
 */

import { useState, useEffect } from "react";
import {
  getAllKarmaPositions,
  type KarmaPosition,
} from "@/modules/karma/karmaTracker";
import {
  getSubplotStatuses,
  getAllSubplots,
  type SubplotStatusEntry,
} from "@/modules/subplot/subplotRegistry";

const STATUS_COLORS: Record<string, string> = {
  active: "text-success",
  dormant: "text-warning",
  dark: "text-muted-foreground",
  resolved: "text-primary",
};

const KarmaSubplotPanel = () => {
  const [karma, setKarma] = useState<KarmaPosition[]>([]);
  const [subplotStatuses, setSubplotStatuses] = useState<SubplotStatusEntry[]>([]);
  const [subplotCount, setSubplotCount] = useState(0);

  useEffect(() => {
    setKarma(getAllKarmaPositions());
    const subplots = getAllSubplots();
    setSubplotCount(subplots.length);
    if (subplots.length > 0) {
      setSubplotStatuses(getSubplotStatuses(1));
    }
  }, []);

  const pendingKarma = karma.filter(
    (k) => k.consequence_pending && !k.consequence_delivered
  );

  return (
    <div className="space-y-3">
      {/* Karma */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          Karma Tracker
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground">Characters</p>
            <p className="text-sm font-mono">{karma.length}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Pending</p>
            <p
              className={`text-sm font-mono ${
                pendingKarma.length > 0 ? "text-warning" : "text-success"
              }`}
            >
              {pendingKarma.length}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Delivered</p>
            <p className="text-sm font-mono">
              {karma.filter((k) => k.consequence_delivered).length}
            </p>
          </div>
        </div>
      </div>

      {/* Subplot Registry */}
      <div className="border-t border-border pt-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          Subplot Registry
        </p>
        {subplotCount === 0 ? (
          <p className="text-xs text-muted-foreground">
            No subplots imported. Import from outline.
          </p>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-mono">{subplotCount} subplot(s)</p>
            {subplotStatuses.map((sp) => (
              <div
                key={sp.subplot_id}
                className="flex items-center justify-between text-xs"
              >
                <span className="truncate flex-1">
                  {sp.subplot_description.slice(0, 40) || sp.subplot_id}
                </span>
                <span
                  className={`font-mono uppercase text-[9px] ${
                    STATUS_COLORS[sp.status] ?? "text-muted-foreground"
                  }`}
                >
                  {sp.status}
                </span>
                <span
                  className={`font-mono text-[9px] ml-2 ${
                    sp.compliant ? "text-success" : "text-warning"
                  }`}
                >
                  {sp.touches_in_act_2}/{sp.minimum_required}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KarmaSubplotPanel;
