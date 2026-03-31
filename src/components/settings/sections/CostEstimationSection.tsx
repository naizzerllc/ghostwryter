import { SectionHeader } from "../SectionHeader";

// Rates per million tokens (USD) — build-time defaults
const RATES = {
  anthropic: { input: 3.0, output: 15.0 },
  geminiPro: { input: 1.25, output: 5.0 },
  geminiFlash: { input: 0.075, output: 0.3 },
  openai: { input: 2.5, output: 10.0 },
};

// Chapter assumptions
const GEN_INPUT = 8000;
const GEN_OUTPUT = 3100;
const QUALITY_MODULES = 6;
const QUALITY_INPUT = 4000;
const QUALITY_OUTPUT = 800;
const READER_INPUT = 5000;
const READER_OUTPUT = 600;
const CHAPTERS = 60;

const cost = (input: number, output: number, rate: typeof RATES.anthropic) =>
  (input / 1_000_000) * rate.input + (output / 1_000_000) * rate.output;

const genCost =
  cost(GEN_INPUT, GEN_OUTPUT, RATES.anthropic) * 0.6 +
  cost(GEN_INPUT, GEN_OUTPUT, RATES.geminiPro) * 0.4;
const qualityCost =
  cost(QUALITY_INPUT, QUALITY_OUTPUT, RATES.geminiFlash) * QUALITY_MODULES;
const readerCost = cost(READER_INPUT, READER_OUTPUT, RATES.openai);
const totalPerChapter = genCost + qualityCost + readerCost;

const fmt = (n: number) => `$${n.toFixed(4)}`;

export const CostEstimationSection = () => {
  const handleUpdateRates = () => {
    window.open("https://www.anthropic.com/pricing", "_blank");
    window.open("https://ai.google.dev/pricing", "_blank");
    window.open("https://openai.com/pricing", "_blank");
  };

  return (
    <div className="py-6">
      <SectionHeader title="Cost Estimation" />

      <table className="w-full text-xs font-mono mb-4">
        <thead>
          <tr className="text-muted-foreground text-left">
            <th className="py-1 uppercase tracking-wider text-[10px]">Component</th>
            <th className="py-1 text-right uppercase tracking-wider text-[10px]">Per Chapter</th>
          </tr>
        </thead>
        <tbody className="text-foreground">
          <tr className="border-t border-border">
            <td className="py-1.5">Generation (Anthropic + Gemini Pro blend)</td>
            <td className="py-1.5 text-right">{fmt(genCost)}</td>
          </tr>
          <tr className="border-t border-border">
            <td className="py-1.5">Quality pipeline (Gemini Flash × 6)</td>
            <td className="py-1.5 text-right">{fmt(qualityCost)}</td>
          </tr>
          <tr className="border-t border-border">
            <td className="py-1.5">Reader simulation (GPT-4o)</td>
            <td className="py-1.5 text-right">{fmt(readerCost)}</td>
          </tr>
          <tr className="border-t-2 border-foreground/20 font-medium">
            <td className="py-1.5">Total per chapter</td>
            <td className="py-1.5 text-right">{fmt(totalPerChapter)}</td>
          </tr>
          <tr className="border-t border-border text-muted-foreground">
            <td className="py-1.5">Projected manuscript (60 chapters)</td>
            <td className="py-1.5 text-right">{fmt(totalPerChapter * CHAPTERS)}</td>
          </tr>
        </tbody>
      </table>

      <p className="text-[10px] font-mono text-muted-foreground leading-relaxed mb-3">
        Estimate only. Actual costs depend on chapter length, revision loops,
        model pricing changes, and fallback routing. Verify rates at your
        provider dashboard. Rates were last hardcoded at build time.
      </p>

      <button
        onClick={handleUpdateRates}
        className="px-3 py-2 border border-border text-xs font-mono uppercase tracking-wider text-foreground hover:border-primary hover:text-primary transition-colors"
      >
        Update Rates
      </button>
    </div>
  );
};
