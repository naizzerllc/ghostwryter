/**
 * Dramatic Architecture Panel — Dashboard summary for clocks, tension, rollercoaster.
 * GHOSTLY v2.2 · Session 12
 */

import { useState, useEffect } from "react";
import { getAllClocks, type ClockRecord } from "@/modules/dramaticArchitecture/clockRegistry";
import {
  getCompulsionCurve,
  checkRollercoaster,
  validateWarmthSpacing,
  type RollercoasterResult,
  type WarmthSpacingResult,
} from "@/modules/dramaticArchitecture/tensionCurve";

const DramaticArchitecturePanel = () => {
  const [clocks, setClocks] = useState<ClockRecord[]>([]);
  const [rollercoaster, setRollercoaster] = useState<RollercoasterResult | null>(null);
  const [warmth, setWarmth] = useState<WarmthSpacingResult | null>(null);
  const [curveLength, setCurveLength] = useState(0);

  useEffect(() => {
    setClocks(getAllClocks());
    const curve = getCompulsionCurve();
    setCurveLength(curve.length);
    if (curve.length > 0) {
      setRollercoaster(checkRollercoaster(curve));
      setWarmth(validateWarmthSpacing(curve));
    }
  }, []);

  const fastClocks = clocks.filter((c) => c.type === "FAST").length;
  const mediumClocks = clocks.filter((c) => c.type === "MEDIUM").length;
  const slowClocks = clocks.filter((c) => c.type === "SLOW").length;

  return (
    <div className="space-y-3">
      {/* Clock Registry */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Clock Registry</p>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground">Total</p>
            <p className="text-sm font-mono">{clocks.length}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Fast</p>
            <p className="text-sm font-mono">{fastClocks}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Medium</p>
            <p className="text-sm font-mono">{mediumClocks}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Slow</p>
            <p className="text-sm font-mono">{slowClocks}</p>
          </div>
        </div>
      </div>

      {/* Tension Curve */}
      <div className="border-t border-border pt-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Tension Curve</p>
        <p className="text-sm font-mono">
          {curveLength > 0
            ? `${curveLength} chapters tracked`
            : "No approved chapters yet"}
        </p>
      </div>

      {/* Rollercoaster Enforcer */}
      <div className="border-t border-border pt-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Rollercoaster Enforcer</p>
        {rollercoaster ? (
          <div>
            <p className={`text-sm font-mono ${rollercoaster.compliant ? "text-success" : "text-warning"}`}>
              {rollercoaster.compliant ? "✓ COMPLIANT" : `⚠ ${rollercoaster.violations.length} violation(s)`}
            </p>
            {rollercoaster.violations.map((v, i) => (
              <p key={i} className="text-xs text-muted-foreground mt-1">
                {v.rule}: {v.description}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Runs after 10 approved chapters</p>
        )}
      </div>

      {/* Warmth Spacing */}
      <div className="border-t border-border pt-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Warmth Spacing</p>
        {warmth ? (
          <div>
            <p className={`text-sm font-mono ${warmth.compliant ? "text-success" : "text-warning"}`}>
              {warmth.compliant ? "✓ COMPLIANT" : `⚠ ${warmth.violations.length} gap(s)`}
            </p>
            {warmth.next_warmth_due_by_chapter > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Next warmth due by Chapter {warmth.next_warmth_due_by_chapter}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No Act 2 data yet</p>
        )}
      </div>
    </div>
  );
};

export default DramaticArchitecturePanel;
