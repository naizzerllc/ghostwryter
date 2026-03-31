import { useState } from "react";
import { SectionHeader } from "../SectionHeader";
import { githubStorage } from "@/storage/githubStorage";

const LS_KEYS = {
  anthropic: "ghostly_anthropic_key",
  openai: "ghostly_openai_key",
  gemini: "ghostly_gemini_key",
  githubToken: "ghostly_github_token",
  githubOwner: "ghostly_github_owner",
};

const ApiKeyField = ({
  label,
  storageKey,
  type = "password",
}: {
  label: string;
  storageKey: string;
  type?: string;
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
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type={type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          placeholder={hasStored ? "••••••••••••••••" : "Not configured"}
          className="flex-1 bg-[hsl(233,40%,11%)] border border-[hsl(233,20%,20%)] px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary"
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
      {saved && <p className="text-[10px] font-mono text-success">Saved</p>}
      {hasStored && !saved && (
        <p className="text-[10px] font-mono text-muted-foreground">Key stored</p>
      )}
    </div>
  );
};

export const ApiCredentialsSection = () => {
  const [githubOwner, setGithubOwner] = useState(
    localStorage.getItem(LS_KEYS.githubOwner) || ""
  );
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "testing" | "connected" | "failed"
  >("idle");
  const [connectionError, setConnectionError] = useState("");

  const handleTestConnection = async () => {
    setConnectionStatus("testing");
    setConnectionError("");
    try {
      const result = await githubStorage.testConnection();
      if (result.connected) {
        setConnectionStatus("connected");
      } else {
        setConnectionStatus("failed");
        setConnectionError(result.error || "Connection failed");
      }
    } catch (err) {
      setConnectionStatus("failed");
      setConnectionError(
        err instanceof Error ? err.message : "Network error"
      );
    }
  };

  const handleSaveOwner = () => {
    if (githubOwner.trim()) {
      localStorage.setItem(LS_KEYS.githubOwner, githubOwner.trim());
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
    <div className="py-6">
      <SectionHeader title="API Credentials" />
      <div className="space-y-4">
        <ApiKeyField label="Anthropic API Key" storageKey={LS_KEYS.anthropic} />
        <ApiKeyField label="OpenAI API Key" storageKey={LS_KEYS.openai} />
        <ApiKeyField label="Gemini API Key" storageKey={LS_KEYS.gemini} />

        <div className="border-t border-border pt-4 mt-4">
          <ApiKeyField label="GitHub Token" storageKey={LS_KEYS.githubToken} />
          <div className="mt-3 space-y-1">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              GitHub Username
            </label>
            <input
              type="text"
              value={githubOwner}
              onChange={(e) => setGithubOwner(e.target.value)}
              onBlur={handleSaveOwner}
              placeholder="username"
              className="w-full bg-[hsl(233,40%,11%)] border border-[hsl(233,20%,20%)] px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={handleTestConnection}
              className="px-3 py-2 border border-border text-xs font-mono uppercase tracking-wider text-foreground hover:border-primary hover:text-primary transition-colors"
            >
              Test GitHub Connection
            </button>
            <span className={`text-xs font-mono uppercase ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          {connectionError && (
            <p className="text-[10px] font-mono text-destructive mt-1">
              {connectionError}
            </p>
          )}
        </div>

        <p className="text-[10px] font-mono text-muted-foreground mt-4 leading-relaxed">
          API keys are stored in your browser's localStorage. This is a
          single-user local tool. Do not run on a shared or public machine.
        </p>
      </div>
    </div>
  );
};
