import { useState, useEffect } from "react";
import { SectionHeader } from "../SectionHeader";

const LS_KEY = "ghostly_forbidden_additions";

export const ForbiddenWordsSection = () => {
  const [words, setWords] = useState<string[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setWords(JSON.parse(stored));
    } catch {}
  }, []);

  const save = (next: string[]) => {
    setWords(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  };

  const handleAdd = () => {
    const word = input.trim().toLowerCase();
    if (!word || words.includes(word)) return;
    save([...words, word]);
    setInput("");
  };

  const handleRemove = (word: string) => {
    save(words.filter((w) => w !== word));
  };

  return (
    <div className="py-6">
      <SectionHeader title="Forbidden Words — Project Additions" />
      <p className="text-[10px] font-mono text-muted-foreground mb-4 leading-relaxed">
        The master forbidden words list is hardcoded and always active. Use this
        section to add project-specific words for the current book.
      </p>

      {words.length === 0 ? (
        <p className="text-xs font-mono text-muted-foreground mb-4">
          No project additions. Master list active.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          {words.map((word) => (
            <span
              key={word}
              className="inline-flex items-center gap-1.5 px-2 py-1 bg-muted border border-border text-xs font-mono text-foreground"
            >
              {word}
              <button
                onClick={() => handleRemove(word)}
                className="text-muted-foreground hover:text-destructive text-[10px] uppercase"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add word…"
          className="flex-1 bg-[hsl(233,40%,11%)] border border-[hsl(233,20%,20%)] px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="px-3 py-2 bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider disabled:opacity-30 hover:bg-primary/80 transition-colors"
        >
          Add Word
        </button>
      </div>
    </div>
  );
};
