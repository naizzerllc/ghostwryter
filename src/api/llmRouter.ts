/**
 * LLM Router — Single point of all API call routing, model resolution, and fallback logic.
 * GHOSTLY v2.2 · Session 3
 */

import { logCost } from "./sessionCostTracker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type Provider = "anthropic" | "gemini_pro" | "gemini_flash" | "openai";

export type TaskType =
  | "generation_protagonist"
  | "generation_antagonist"
  | "generation_supporting"
  | "anti_ai_detection"
  | "anti_ai_detection_secondary"
  | "quality_analysis"
  | "continuity_check"
  | "living_state_update"
  | "revision_scope"
  | "misdirection_erosion_check"
  | "reader_simulation"
  | "dna_extraction"
  | "dna_gap_options";

export interface TaskRoute {
  provider: Provider;
  inject_prose_dna: boolean;
}

export interface LLMResponse {
  content: string;
  model_used: string;
  provider: Provider;
  tokens_used: number;
  fallback_used: boolean;
  fallback_reason?: string;
}

export interface AnthropicCachedResponse {
  content: string;
  model_used: string;
  provider: "anthropic";
  tokens_used: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  refusal_detected: boolean;
  truncation_suspected: boolean;
}

export interface CallOptions {
  timeout_ms?: number;
  max_tokens?: number;
  temperature?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDER_ALIASES: Record<Provider, string> = {
  anthropic: "claude-sonnet-latest",
  gemini_pro: "gemini-2.0-pro-latest",
  gemini_flash: "gemini-2.0-flash-latest",
  openai: "gpt-4o",
};

export const TASK_ROUTING: Record<TaskType, TaskRoute> = {
  generation_protagonist:      { provider: "anthropic",    inject_prose_dna: true  },
  generation_antagonist:       { provider: "gemini_pro",   inject_prose_dna: false },
  generation_supporting:       { provider: "gemini_pro",   inject_prose_dna: false },
  anti_ai_detection:           { provider: "gemini_flash", inject_prose_dna: false },
  anti_ai_detection_secondary: { provider: "anthropic",    inject_prose_dna: true  },
  quality_analysis:            { provider: "gemini_flash", inject_prose_dna: false },
  continuity_check:            { provider: "gemini_flash", inject_prose_dna: false },
  living_state_update:         { provider: "gemini_flash", inject_prose_dna: false },
  revision_scope:              { provider: "gemini_flash", inject_prose_dna: false },
  misdirection_erosion_check:  { provider: "gemini_flash", inject_prose_dna: false },
  reader_simulation:           { provider: "openai",       inject_prose_dna: false },
  dna_extraction:              { provider: "anthropic",    inject_prose_dna: true  },
  dna_gap_options:             { provider: "anthropic",    inject_prose_dna: false },
};

export const TASK_FALLBACK_OVERRIDES: Partial<Record<TaskType, Provider[]>> = {
  generation_antagonist:  ["openai"],     // NEVER anthropic — voice homogeneity failure
  generation_supporting:  ["openai"],     // NEVER anthropic — voice homogeneity failure
  reader_simulation:      ["gemini_pro"], // Degraded mode — logs generator-evaluator overlap warning
};

// ---------------------------------------------------------------------------
// Local storage keys (same as Settings.tsx)
// ---------------------------------------------------------------------------

const LS_KEYS = {
  anthropic: "ghostly_anthropic_key",
  google: "ghostly_google_key",
  openai: "ghostly_openai_key",
} as const;

// ---------------------------------------------------------------------------
// Platform config cache (loaded from GitHub storage or defaults)
// ---------------------------------------------------------------------------

let platformConfig: {
  pinned_override?: Partial<Record<Provider, string>>;
} = {};

export function setPlatformConfig(config: typeof platformConfig): void {
  platformConfig = config;
}

// ---------------------------------------------------------------------------
// resolveModelString
// ---------------------------------------------------------------------------

export function resolveModelString(provider: Provider): string {
  const pinned = platformConfig.pinned_override?.[provider];
  if (pinned) {
    console.log(`[LLM Router] Model resolved: ${provider} → ${pinned} [Pinned]`);
    return pinned;
  }
  const alias = PROVIDER_ALIASES[provider];
  return alias;
}

// ---------------------------------------------------------------------------
// Provider API key retrieval
// ---------------------------------------------------------------------------

function getApiKey(provider: Provider): string | null {
  switch (provider) {
    case "anthropic":
      return localStorage.getItem(LS_KEYS.anthropic);
    case "gemini_pro":
    case "gemini_flash":
      return localStorage.getItem(LS_KEYS.google);
    case "openai":
      return localStorage.getItem(LS_KEYS.openai);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Provider endpoint mapping
// ---------------------------------------------------------------------------

function getEndpoint(provider: Provider): string {
  switch (provider) {
    case "anthropic":
      return "https://api.anthropic.com/v1/messages";
    case "gemini_pro":
    case "gemini_flash":
      return "https://generativelanguage.googleapis.com/v1beta/models";
    case "openai":
      return "https://api.openai.com/v1/chat/completions";
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ---------------------------------------------------------------------------
// Provider-specific call implementations
// ---------------------------------------------------------------------------

async function callProvider(
  provider: Provider,
  prompt: string,
  options: CallOptions = {}
): Promise<{ content: string; tokens_used: number }> {
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    throw new Error(`No API key configured for ${provider}`);
  }

  const model = resolveModelString(provider);
  const timeout = options.timeout_ms ?? 60_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    let content = "";
    let tokens_used = 0;

    if (provider === "anthropic") {
      const res = await fetch(getEndpoint(provider), {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: options.max_tokens ?? 4096,
          temperature: options.temperature ?? 0.7,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      content = data.content?.[0]?.text ?? "";
      tokens_used = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

    } else if (provider === "gemini_pro" || provider === "gemini_flash") {
      const url = `${getEndpoint(provider)}/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: options.max_tokens ?? 4096,
            temperature: options.temperature ?? 0.7,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      tokens_used = (data.usageMetadata?.promptTokenCount ?? 0) +
                    (data.usageMetadata?.candidatesTokenCount ?? 0);

    } else if (provider === "openai") {
      const res = await fetch(getEndpoint(provider), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: options.max_tokens ?? 4096,
          temperature: options.temperature ?? 0.7,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      content = data.choices?.[0]?.message?.content ?? "";
      tokens_used = data.usage?.total_tokens ?? 0;
    }

    return { content, tokens_used };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// callAnthropic — Two-block prompt caching
// ---------------------------------------------------------------------------

export async function callAnthropic(
  taskType: TaskType,
  staticContent: string,
  dynamicContent: string,
  options: CallOptions = {}
): Promise<AnthropicCachedResponse> {
  const apiKey = getApiKey("anthropic");
  if (!apiKey) {
    throw new Error("No API key configured for anthropic");
  }

  const model = resolveModelString("anthropic");
  const timeout = options.timeout_ms ?? 60_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(getEndpoint("anthropic"), {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "extended-cache-ttl-2025-04-11",
      },
      body: JSON.stringify({
        model,
        max_tokens: options.max_tokens ?? 4096,
        temperature: options.temperature ?? 0.7,
        system: [
          {
            type: "text",
            text: staticContent,
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: dynamicContent,
          },
        ],
        messages: [{ role: "user", content: "Generate based on the system prompt above." }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const content = data.content?.[0]?.text ?? "";
    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const cacheRead = data.usage?.cache_read_input_tokens ?? 0;
    const cacheWrite = data.usage?.cache_creation_input_tokens ?? 0;
    const stopReason = data.stop_reason ?? "";

    const refusal_detected = stopReason === "refusal" || content.length < 200;
    const truncation_suspected = stopReason === "end_turn" && outputTokens < 300;

    const tokens_used = inputTokens + outputTokens;
    const saved_tokens = cacheRead; // tokens read from cache = tokens saved

    // Log to session cost tracker
    logCost({
      call_type: taskType,
      provider: "anthropic",
      tokens_used,
      cache_read_tokens: cacheRead,
      cache_write_tokens: cacheWrite,
      saved_tokens,
    });

    if (refusal_detected) {
      console.warn(`[LLM Router] CONTENT_REFUSAL detected for ${taskType}`);
    }
    if (truncation_suspected) {
      console.warn(`[LLM Router] TRUNCATION_SUSPECTED for ${taskType} — output tokens: ${outputTokens}`);
    }

    return {
      content,
      model_used: model,
      provider: "anthropic",
      tokens_used,
      cache_read_tokens: cacheRead,
      cache_write_tokens: cacheWrite,
      refusal_detected,
      truncation_suspected,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// callWithFallback
// ---------------------------------------------------------------------------

export async function callWithFallback(
  taskType: TaskType,
  prompt: string,
  options: CallOptions = {}
): Promise<LLMResponse> {
  const route = TASK_ROUTING[taskType];
  if (!route) {
    throw new Error(`Unknown task type: ${taskType}`);
  }

  // Try primary provider
  try {
    const result = await callProvider(route.provider, prompt, options);

    // Log to session cost tracker
    logCost({
      call_type: taskType,
      provider: route.provider,
      tokens_used: result.tokens_used,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      saved_tokens: 0,
    });

    return {
      content: result.content,
      model_used: resolveModelString(route.provider),
      provider: route.provider,
      tokens_used: result.tokens_used,
      fallback_used: false,
    };
  } catch (primaryError) {
    console.warn(
      `[LLM Router] Primary provider ${route.provider} failed for ${taskType}:`,
      primaryError instanceof Error ? primaryError.message : primaryError
    );
  }

  // Try fallback chain
  const fallbacks = TASK_FALLBACK_OVERRIDES[taskType];
  if (!fallbacks || fallbacks.length === 0) {
    throw new Error(
      `Primary provider ${route.provider} failed for ${taskType} and no fallback configured`
    );
  }

  for (const fallbackProvider of fallbacks) {
    if (taskType === "generation_antagonist" || taskType === "generation_supporting") {
      console.warn(
        `[LLM Router] Falling back to non-primary provider for ${taskType} — voice differentiation risk`
      );
    }
    if (taskType === "reader_simulation" && fallbackProvider === "gemini_pro") {
      console.warn(
        "[LLM Router] READER_SIM_DEGRADED — generator-evaluator overlap active"
      );
    }

    try {
      const result = await callProvider(fallbackProvider, prompt, options);

      logCost({
        call_type: taskType,
        provider: fallbackProvider,
        tokens_used: result.tokens_used,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        saved_tokens: 0,
      });

      return {
        content: result.content,
        model_used: resolveModelString(fallbackProvider),
        provider: fallbackProvider,
        tokens_used: result.tokens_used,
        fallback_used: true,
        fallback_reason: `Primary provider ${route.provider} failed`,
      };
    } catch (fallbackError) {
      console.warn(
        `[LLM Router] Fallback provider ${fallbackProvider} also failed:`,
        fallbackError instanceof Error ? fallbackError.message : fallbackError
      );
    }
  }

  throw new Error(
    `All providers exhausted for ${taskType}. Primary: ${route.provider}, Fallbacks: ${fallbacks.join(", ")}`
  );
}

// ---------------------------------------------------------------------------
// Expose for console testing
// ---------------------------------------------------------------------------

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_llmRouter = {
    resolveModelString,
    TASK_ROUTING,
    TASK_FALLBACK_OVERRIDES,
    callWithFallback,
    callAnthropic,
    setPlatformConfig,
  };
}
