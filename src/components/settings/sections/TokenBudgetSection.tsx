import { SectionHeader } from "../SectionHeader";

const TIERS = [
  { label: "Tier 0 — Prose DNA runtime", tokens: 800, color: "hsl(233,45%,20%)" },
  { label: "Tier 1 — Permanent session memory", tokens: 1200, color: "hsl(233,40%,28%)" },
  { label: "Tier 2 — Dynamic chapter context", tokens: 2000, color: "hsl(233,35%,36%)" },
  { label: "Tier 3 — Continuity bridge", tokens: 1500, color: "hsl(233,30%,44%)" },
  { label: "Tier 4 — Generation headroom", tokens: 4500, color: "hsl(233,25%,52%)" },
];

const HARD_CEILING = 10000;
const TARGET = 8000;
const TOTAL = TIERS.reduce((s, t) => s + t.tokens, 0);

export const TokenBudgetSection = () => {
  return (
    <div className="py-6">
      <SectionHeader title="Token Budget Monitor" />

      <div className="space-y-2 mb-4">
        {TIERS.map((tier) => (
          <div key={tier.label} className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">{tier.label}</span>
            <span className="text-foreground">~{tier.tokens.toLocaleString()}T</span>
          </div>
        ))}
        <div className="flex justify-between text-xs font-mono font-medium border-t border-border pt-1">
          <span className="text-foreground">Hard Ceiling</span>
          <span className="text-foreground">{HARD_CEILING.toLocaleString()}T</span>
        </div>
        <div className="flex justify-between text-xs font-mono">
          <span className="text-muted-foreground">Target</span>
          <span className="text-foreground">{TARGET.toLocaleString()}T</span>
        </div>
      </div>

      {/* Stacked bar */}
      <div className="relative h-6 bg-muted border border-border">
        <div className="absolute inset-0 flex">
          {TIERS.map((tier) => (
            <div
              key={tier.label}
              style={{
                width: `${(tier.tokens / HARD_CEILING) * 100}%`,
                backgroundColor: tier.color,
              }}
              className="h-full"
              title={`${tier.label}: ${tier.tokens}T`}
            />
          ))}
        </div>
        {/* Hard ceiling line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-destructive"
          style={{ left: "100%" }}
          title="Hard ceiling: 10,000T"
        />
        {/* Target line */}
        <div
          className="absolute top-0 bottom-0 w-px border-l border-dashed border-warning"
          style={{ left: `${(TARGET / HARD_CEILING) * 100}%` }}
          title="Target: 8,000T"
        />
      </div>
      <div className="flex justify-between text-[9px] font-mono text-muted-foreground mt-1">
        <span>0</span>
        <span>Target 8K</span>
        <span>Ceiling 10K</span>
      </div>
    </div>
  );
};
