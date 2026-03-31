import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const LS_KEYS = {
  anthropic: "ghostly_anthropic_key",
  google: "ghostly_google_key",
  openai: "ghostly_openai_key",
  githubToken: "ghostly_github_token",
  githubOwner: "ghostly_github_owner",
} as const;

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border border-border bg-card">
    <div className="px-4 py-2 border-b border-border">
      <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{title}</h2>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const ApiKeyField = ({
  label,
  storageKey,
}: {
  label: string;
  storageKey: string;
}) => {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [hasStored, setHasStored] = useState(!!localStorage.getItem(storageKey));

  const handleSave = () => {
    if (value.trim()) {
      localStorage.setItem(storageKey, value.trim());
      setValue("");
      setHasStored(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleClear = () => {
    localStorage.removeItem(storageKey);
    setValue("");
    setHasStored(false);
    setSaved(false);
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={hasStored ? "••••••••••••••••" : "Not configured"}
          className="flex-1 bg-muted border border-border px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        <button
          onClick={handleSave}
          disabled={!value.trim()}
          className="px-3 py-2 bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider disabled:opacity-30 hover:bg-primary/80 transition-colors"
        >
          Save
        </button>
        <button
          onClick={handleClear}
          disabled={!hasStored}
          className="px-3 py-2 border border-border text-xs font-mono uppercase tracking-wider text-muted-foreground disabled:opacity-30 hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          Clear
        </button>
      </div>
      {saved && <p className="text-[10px] font-mono text-success">Saved to localStorage</p>}
      {hasStored && !saved && <p className="text-[10px] font-mono text-muted-foreground">Key stored</p>}
    </div>
  );
};

const Settings = () => {
  const [githubOwner, setGithubOwner] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "testing" | "connected" | "failed">("idle");
  const [connectionError, setConnectionError] = useState("");

  useEffect(() => {
    const storedOwner = localStorage.getItem(LS_KEYS.githubOwner);
    if (storedOwner) setGithubOwner(storedOwner);
  }, []);

  const handleSaveGithub = () => {
    if (githubToken.trim()) {
      localStorage.setItem(LS_KEYS.githubToken, githubToken.trim());
      setGithubToken("");
    }
    if (githubOwner.trim()) {
      localStorage.setItem(LS_KEYS.githubOwner, githubOwner.trim());
    }
  };

  const handleTestConnection = async () => {
    const token = localStorage.getItem(LS_KEYS.githubToken);
    const owner = localStorage.getItem(LS_KEYS.githubOwner);
    if (!token || !owner) {
      setConnectionStatus("failed");
      setConnectionError("Token and owner must be saved first");
      return;
    }
    setConnectionStatus("testing");
    setConnectionError("");
    try {
      const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/ghostly-data`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      });
      if (res.ok) {
        setConnectionStatus("connected");
      } else {
        setConnectionStatus("failed");
        setConnectionError(`HTTP ${res.status}: ${res.statusText}`);
      }
    } catch (err) {
      setConnectionStatus("failed");
      setConnectionError(err instanceof Error ? err.message : "Network error");
    }
  };

  const statusColor =
    connectionStatus === "connected"
      ? "text-success"
      : connectionStatus === "failed"
        ? "text-destructive"
        : connectionStatus === "testing"
          ? "text-warning"
          : "text-muted-foreground";

  const statusLabel =
    connectionStatus === "connected"
      ? "CONNECTED"
      : connectionStatus === "failed"
        ? "FAILED"
        : connectionStatus === "testing"
          ? "TESTING…"
          : "NOT TESTED";

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold tracking-wide">Settings</h1>

      {/* API KEYS */}
      <Panel title="API Keys">
        <div className="space-y-4">
          <ApiKeyField label="Anthropic API Key" storageKey={LS_KEYS.anthropic} />
          <ApiKeyField label="Google AI API Key" storageKey={LS_KEYS.google} />
          <ApiKeyField label="OpenAI API Key" storageKey={LS_KEYS.openai} />
        </div>
      </Panel>

      {/* GITHUB */}
      <Panel title="GitHub">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">GitHub Token</label>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder={localStorage.getItem(LS_KEYS.githubToken) ? "••••••••••••••••" : "Not configured"}
              className="w-full bg-muted border border-border px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">GitHub Owner / Username</label>
            <input
              type="text"
              value={githubOwner}
              onChange={(e) => setGithubOwner(e.target.value)}
              placeholder="username"
              className="w-full bg-muted border border-border px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Repository</label>
            <p className="text-sm font-mono text-foreground px-3 py-2 bg-muted border border-border opacity-60">ghostly-data</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => { handleSaveGithub(); }}
              className="px-3 py-2 bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider hover:bg-primary/80 transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleTestConnection}
              className="px-3 py-2 border border-border text-xs font-mono uppercase tracking-wider text-foreground hover:border-primary hover:text-primary transition-colors"
            >
              Test Connection
            </button>
            <span className={`text-xs font-mono uppercase ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          {connectionError && (
            <p className="text-[10px] font-mono text-destructive">{connectionError}</p>
          )}
        </div>
      </Panel>

      {/* TOKEN BUDGET */}
      <Panel title="Token Budget">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Generation Ceiling</p>
            <p className="text-lg font-mono">10,000T</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Quality Pass</p>
            <p className="text-lg font-mono">2,900T</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Reader Sim</p>
            <p className="text-lg font-mono">2,300T</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground font-mono mt-3">
          Dry-run gate available after Briefing Generator is built (Session 14)
        </p>
      </Panel>

      {/* PLATFORM INFO */}
      <Panel title="Platform Info">
        <div className="grid grid-cols-5 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Version</p>
            <p className="text-sm font-mono">v2.2.0</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Build</p>
            <p className="text-sm font-mono">28 / 28</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">MIC</p>
            <p className="text-sm font-mono">v2.1</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Schema</p>
            <p className="text-sm font-mono">v2.8</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Prose DNA</p>
            <p className="text-sm font-mono">v2.3 (17)</p>
          </div>
        </div>
      </Panel>

      {/* CALIBRATION */}
      <Panel title="Module Weight Calibration">
        <p className="text-[10px] font-mono text-muted-foreground mb-3">
          After 5 approved chapters, calibrate quality gate module weights against your editorial judgement.
        </p>
        <Link
          to="/calibration"
          className="px-3 py-2 border border-border text-xs font-mono uppercase tracking-wider text-foreground hover:border-primary hover:text-primary transition-colors inline-block"
        >
          Open Calibration
        </Link>
      </Panel>
    </div>
  );
};
  );
};

export default Settings;
