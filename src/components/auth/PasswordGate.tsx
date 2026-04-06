import { useState, useCallback, FormEvent } from "react";

const PASS_HASH = "Andreas";
const SESSION_KEY = "ghostly_auth";

const PasswordGate = ({ children }: { children: React.ReactNode }) => {
  const [authed, setAuthed] = useState(() =>
    import.meta.env.DEV ? true : sessionStorage.getItem(SESSION_KEY) === "1"
  );
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (value === PASS_HASH) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setAuthed(true);
    } else {
      setError(true);
      setValue("");
    }
  }, [value]);

  if (authed) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="border border-border bg-card p-8 w-full max-w-sm space-y-4">
        <h1 className="text-sm font-mono uppercase tracking-widest text-foreground font-semibold">
          GHOSTLY — Access Required
        </h1>
        <p className="text-xs font-mono text-muted-foreground">Enter password to continue.</p>
        <input
          type="password"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          autoFocus
          className="w-full px-3 py-2 text-sm font-mono bg-background border border-border text-foreground focus:border-primary focus:outline-none"
          placeholder="Password"
        />
        {error && <p className="text-xs font-mono text-destructive">Invalid password.</p>}
        <button
          type="submit"
          className="w-full px-3 py-2 text-[10px] font-mono uppercase tracking-wider border border-primary text-primary hover:bg-primary/10 transition-colors"
        >
          Enter
        </button>
      </form>
    </div>
  );
};

export default PasswordGate;
