import { useState, useEffect, useCallback } from "react";
import { Lock } from "lucide-react";
import { githubStorage } from "@/storage/githubStorage";
import { ApiCredentialsSection } from "./sections/ApiCredentialsSection";
import { ModelConfigSection } from "./sections/ModelConfigSection";
import { StyleProfileSection } from "./sections/StyleProfileSection";
import { QualityGateSection } from "./sections/QualityGateSection";
import { TokenBudgetSection } from "./sections/TokenBudgetSection";
import { CostEstimationSection } from "./sections/CostEstimationSection";
import { ForbiddenWordsSection } from "./sections/ForbiddenWordsSection";

const LS_KEYS = {
  styleOverrides: "ghostly_style_overrides",
  qualityOverrides: "ghostly_quality_overrides",
  modelOverrides: "ghostly_model_overrides",
  forbiddenAdditions: "ghostly_forbidden_additions",
};

export const SettingsPanel = () => {
  const [saveFlash, setSaveFlash] = useState(false);

  const handleSaveAll = useCallback(() => {
    // Each section already persists on change; this is a global confirm
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  }, []);

  return (
    <div className="space-y-0 max-w-4xl relative pb-16">
      <h1 className="text-xl font-semibold tracking-wide mb-6">Settings</h1>

      <ApiCredentialsSection />
      <div className="border-t border-[hsl(233,20%,15%)]" />
      <ModelConfigSection />
      <div className="border-t border-[hsl(233,20%,15%)]" />
      <StyleProfileSection />
      <div className="border-t border-[hsl(233,20%,15%)]" />
      <QualityGateSection />
      <div className="border-t border-[hsl(233,20%,15%)]" />
      <TokenBudgetSection />
      <div className="border-t border-[hsl(233,20%,15%)]" />
      <CostEstimationSection />
      <div className="border-t border-[hsl(233,20%,15%)]" />
      <ForbiddenWordsSection />

      {/* Sticky save button */}
      <div className="fixed bottom-8 right-8 flex items-center gap-3 z-50">
        {saveFlash && (
          <span className="text-xs font-mono uppercase text-success animate-pulse">
            SAVED
          </span>
        )}
        <button
          onClick={handleSaveAll}
          className="px-5 py-2.5 bg-primary text-primary-foreground text-xs font-mono uppercase tracking-widest hover:bg-primary/80 transition-colors"
        >
          Save All
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
