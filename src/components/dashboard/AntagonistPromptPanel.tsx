/**
 * Antagonist Prompt Builder Panel — Dashboard UI.
 * GHOSTLY v2.2 · Prompt 02 · MSG-4
 */

import { useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  auditRouting,
} from "@/modules/antagonistPromptBuilder/antagonistPromptBuilder";

const AntagonistPromptPanel = () => {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  const audit = auditRouting();

  return (
    <div className="space-y-3">
      {/* Routing audit */}
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Anti-Anthropic Guard
        </span>
        <span
          className={`text-xs font-mono ${
            audit.safe ? "text-success" : "text-destructive"
          }`}
        >
          {audit.safe ? "✓ SAFE" : "✗ VIOLATION"}
        </span>
      </div>

      {!audit.safe && (
        <div className="border border-destructive/50 p-2">
          {audit.issues.map((issue, i) => (
            <p key={i} className="text-[10px] font-mono text-destructive">
              {issue}
            </p>
          ))}
        </div>
      )}

      {/* Routing info */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Antagonist
          </p>
          <p className="text-xs font-mono">gemini_pro → [openai]</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Supporting
          </p>
          <p className="text-xs font-mono">gemini_pro → [openai]</p>
        </div>
      </div>

      {/* Built prompts */}
      <div className="border-t border-border pt-2">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Built Prompts
          </span>
          <span className="text-xs font-mono">{snap.totalBuilt}</span>
        </div>

        {snap.prompts.length === 0 ? (
          <p className="text-[10px] text-muted-foreground font-mono">
            No prompts built yet. Use console: __ghostly_antagonistPrompt.buildPrompt({"{"} ... {"}"})
          </p>
        ) : (
          <div className="space-y-2">
            {snap.prompts.map((p) => (
              <div
                key={p.character_name + p.built_at}
                className="border border-border p-2 space-y-1"
              >
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-mono font-semibold">
                    {p.character_name}
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground">
                    {p.character_role}
                  </span>
                </div>
                <div className="flex gap-3 text-[10px] font-mono text-muted-foreground">
                  <span>→ {p.provider}</span>
                  <span>fb: [{p.fallback_chain.join(", ")}]</span>
                  <span className="text-primary">anthropic: BLOCKED</span>
                </div>
                <div className="flex gap-3 text-[10px] font-mono">
                  <span className={p.voice_dna_injected ? "text-success" : "text-destructive"}>
                    voice_dna: {p.voice_dna_injected ? "✓" : "✗"}
                  </span>
                  <span className={p.generation_allowed ? "text-success" : "text-warning"}>
                    gen: {p.generation_allowed ? "ALLOWED" : "BLOCKED"}
                  </span>
                </div>
                {p.warnings.length > 0 && (
                  <div className="mt-1">
                    {p.warnings.map((w, i) => (
                      <p key={i} className="text-[9px] font-mono text-warning">
                        ⚠ {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AntagonistPromptPanel;
