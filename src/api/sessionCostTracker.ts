/**
 * Session Cost Tracker — Tracks token usage and cache savings for the current session.
 * GHOSTLY v2.2 · Session 3
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CostEntry {
  call_type: string;
  provider: string;
  tokens_used: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  saved_tokens: number;
  timestamp: number;
}

export interface SessionCostSummary {
  total_tokens: number;
  total_cache_read: number;
  total_cache_write: number;
  total_saved: number;
  estimated_cost_usd: number;
  call_count: number;
  entries: CostEntry[];
}

// ---------------------------------------------------------------------------
// Approximate cost per 1M tokens (USD) — for estimation only
// ---------------------------------------------------------------------------

const COST_PER_1M: Record<string, { input: number; output: number }> = {
  anthropic:    { input: 3.00,  output: 15.00 },
  gemini_pro:   { input: 1.25,  output: 5.00  },
  gemini_flash: { input: 0.075, output: 0.30  },
  openai:       { input: 2.50,  output: 10.00 },
};

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

const entries: CostEntry[] = [];
const listeners: Set<() => void> = new Set();

let cachedSummary: SessionCostSummary | null = null;

function notify() {
  cachedSummary = null; // invalidate cache
  listeners.forEach((fn) => fn());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function logCost(entry: Omit<CostEntry, "timestamp">): void {
  entries.push({ ...entry, timestamp: Date.now() });
  console.log(
    `[Token Economy] ${entry.call_type} via ${entry.provider}: ${entry.tokens_used}T used, ${entry.saved_tokens}T saved (cache read: ${entry.cache_read_tokens}, write: ${entry.cache_write_tokens})`
  );
  notify();
}

export function getSessionSummary(): SessionCostSummary {
  let total_tokens = 0;
  let total_cache_read = 0;
  let total_cache_write = 0;
  let total_saved = 0;
  let estimated_cost_usd = 0;

  for (const e of entries) {
    total_tokens += e.tokens_used;
    total_cache_read += e.cache_read_tokens;
    total_cache_write += e.cache_write_tokens;
    total_saved += e.saved_tokens;

    const rates = COST_PER_1M[e.provider] ?? COST_PER_1M.openai;
    // Rough estimate: assume 60% input 40% output
    const inputTokens = e.tokens_used * 0.6;
    const outputTokens = e.tokens_used * 0.4;
    estimated_cost_usd +=
      (inputTokens / 1_000_000) * rates.input +
      (outputTokens / 1_000_000) * rates.output;
  }

  return {
    total_tokens,
    total_cache_read,
    total_cache_write,
    total_saved,
    estimated_cost_usd,
    call_count: entries.length,
    entries: [...entries],
  };
}

export function resetSession(): void {
  entries.length = 0;
  notify();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
