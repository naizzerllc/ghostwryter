import STYLE_PROFILES from "@/constants/STYLE_PROFILES.json";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Panel from "@/components/dashboard/Panel";
import StartupValidatorPanel from "@/components/dashboard/StartupValidatorPanel";
import SecurityLogPanel from "@/components/dashboard/SecurityLogPanel";
import MemoryCorePanel from "@/components/dashboard/MemoryCorePanel";
import TokenEconomyPanel from "@/components/dashboard/TokenEconomyPanel";
import MICPanel from "@/components/dashboard/MICPanel";
import CharacterDBPanel from "@/components/dashboard/CharacterDBPanel";
import VoiceCorpusGatePanel from "@/components/dashboard/VoiceCorpusGatePanel";
import StoryBibleImportPanel from "@/components/dashboard/StoryBibleImportPanel";
import AntagonistPromptPanel from "@/components/dashboard/AntagonistPromptPanel";
import OutlineDiagnosticPanel from "@/components/dashboard/OutlineDiagnosticPanel";

const MODULE_REGISTRY = Array.from({ length: 28 }, (_, i) => ({
  id: i + 1,
  label: `Session ${String(i + 1).padStart(2, "0")}`,
  status: i === 0 ? "ACTIVE" : "PENDING",
}));

const Dashboard = () => {
  const activeProfile = STYLE_PROFILES.profiles[STYLE_PROFILES.active_profile as keyof typeof STYLE_PROFILES.profiles];

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-xl font-semibold tracking-wide">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4">
        {/* ENGINE STATUS */}
        <Panel title="Engine Status">
          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-2xl font-bold tracking-wide">GHOSTLY</span>
              <span className="text-xs font-mono text-muted-foreground">AI Fiction Production Platform</span>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Version</p>
                <p className="text-sm font-mono">2.2.0</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Build</p>
                <p className="text-sm font-mono">5 / 28</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</p>
                <p className="text-sm font-mono text-warning">Foundation</p>
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Startup Validation</h3>
              <StartupValidatorPanel />
            </div>
          </div>
        </Panel>

        {/* BUILD NOTES */}
        <Panel title="Build Notes">
          <div className="space-y-2">
            <p className="text-sm text-foreground">Session 4 complete. Prose DNA + Style + Forbidden Words.</p>
            <p className="text-xs text-muted-foreground">
              PROSE_DNA.md · PROSE_DNA_RUNTIME · STYLE_PROFILES · FORBIDDEN_WORDS · forbiddenWordsChecker
            </p>
          </div>
        </Panel>
      </div>

      {/* MODULE REGISTRY */}
      <Panel title="Module Registry">
        <div className="grid grid-cols-7 gap-2">
          {MODULE_REGISTRY.map((mod) => (
            <div
              key={mod.id}
              className={`border p-2 text-center ${
                mod.status === "ACTIVE"
                  ? "border-primary bg-primary/10"
                  : "border-border"
              }`}
            >
              <p className="text-xs font-mono font-semibold">
                S{String(mod.id).padStart(2, "0")}
              </p>
              <p
                className={`text-[9px] font-mono mt-1 ${
                  mod.status === "ACTIVE" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {mod.status}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      {/* STYLE LAYER + PROSE DNA */}
      <div className="grid grid-cols-2 gap-4">
        <Panel title="Style Layer">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Profile</p>
                <p className="text-sm font-mono">{STYLE_PROFILES.active_profile}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Tone</p>
                <p className="text-sm font-mono">{activeProfile.tone_register}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">POV / Tense</p>
                <p className="text-sm font-mono">{activeProfile.pov} · {activeProfile.tense}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Brand Lock</p>
                <p className="text-sm font-mono text-primary">{activeProfile.brand_lock ? "LOCKED" : "UNLOCKED"}</p>
              </div>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <button className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider border border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors">
                  View Profile
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-mono text-sm uppercase tracking-widest">Style Profile — {STYLE_PROFILES.active_profile}</DialogTitle>
                </DialogHeader>
                <pre className="text-xs font-mono text-foreground bg-muted/30 p-4 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(activeProfile, null, 2)}
                </pre>
              </DialogContent>
            </Dialog>
          </div>
        </Panel>

        <Panel title="Prose DNA">
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-mono">v2.3 — 17 rules</span>
              <span className="text-[10px] font-mono text-primary uppercase tracking-widest">Hardcoded Active</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Injection scope: generation_protagonist · anti_ai_detection_secondary
            </p>
            <p className="text-xs text-muted-foreground">
              Never injected into quality analysis calls
            </p>
          </div>
        </Panel>
      </div>

      {/* MEMORY CORE + TOKEN ECONOMY */}
      <div className="grid grid-cols-2 gap-4">
        <Panel title="Memory Core">
          <MemoryCorePanel />
        </Panel>

        <Panel title="Token Economy">
          <TokenEconomyPanel />
        </Panel>
      </div>

      {/* CHARACTER DB + MODULE INTERFACE CONTRACT */}
      <div className="grid grid-cols-2 gap-4">
        <Panel title="Character DB">
          <CharacterDBPanel />
        </Panel>

        <Panel title="Module Interface Contract">
          <MICPanel />
        </Panel>
      </div>

      {/* STORY BIBLE IMPORT + ANTAGONIST PROMPT BUILDER */}
      <div className="grid grid-cols-2 gap-4">
        <Panel title="Story Bible Import">
          <StoryBibleImportPanel />
        </Panel>

        <Panel title="Antagonist Prompt Builder">
          <AntagonistPromptPanel />
        </Panel>
      </div>

      {/* OUTLINE DIAGNOSTIC */}
      <Panel title="Outline Import Diagnostic">
        <OutlineDiagnosticPanel />
      </Panel>

      {/* VOICE CORPUS GATE + SECURITY LOG */}
      <div className="grid grid-cols-2 gap-4">
        <Panel title="Voice Corpus Gate">
          <VoiceCorpusGatePanel />
        </Panel>

        <Panel title="Security Log">
          <SecurityLogPanel />
        </Panel>
      </div>
    </div>
  );
};

export default Dashboard;
