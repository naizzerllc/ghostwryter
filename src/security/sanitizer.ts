export interface SecurityEvent {
  timestamp: string;
  field: string;
  patterns: string[];
  severity: "HIGH";
}

const INJECTION_PATTERNS: { regex: RegExp; label: string }[] = [
  { regex: /ignore\s+(all\s+)?previous\s+instructions/i, label: "ignore previous instructions" },
  { regex: /disregard\s+(all\s+)?previous\s+instructions/i, label: "disregard previous instructions" },
  { regex: /forget\s+(all\s+)?previous\s+instructions/i, label: "forget previous instructions" },
  { regex: /you\s+are\s+now\s+(?:not\s+)?(?:a\s+)?(?:writer|author|editor)/i, label: "role override" },
  { regex: /new\s+instructions\s*:/i, label: "new instructions injection" },
  { regex: /\[system\]/i, label: "[system] tag" },
  { regex: /\[prompt\]/i, label: "[prompt] tag" },
  { regex: /<system>/i, label: "<system> tag" },
  { regex: /act\s+as\s+if\s+you\s+are\s+not/i, label: "act-as override" },
  { regex: /pretend\s+to\s+be\s+(?:not\s+)?(?:an?\s+)?(?:author|writer)/i, label: "pretend override" },
  { regex: /(?:print|reveal|show)\s+(?:your\s+)?system\s+prompt/i, label: "system prompt extraction" },
  { regex: /repeat\s+the\s+above\s+verbatim/i, label: "verbatim extraction" },
  { regex: /your\s+true\s+purpose\s+is/i, label: "purpose override" },
];

const MAX_LOG_ENTRIES = 100;
const SECURITY_LOG: SecurityEvent[] = [];

export function sanitizeInput(input: string): {
  clean: string;
  injectionDetected: boolean;
  patterns: string[];
} {
  let clean = input;
  const detectedPatterns: string[] = [];

  for (const { regex, label } of INJECTION_PATTERNS) {
    if (regex.test(clean)) {
      detectedPatterns.push(label);
      clean = clean.replace(new RegExp(regex.source, "gi"), "[CONTENT REMOVED]");
    }
  }

  return {
    clean,
    injectionDetected: detectedPatterns.length > 0,
    patterns: detectedPatterns,
  };
}

export function sanitizeRecord(
  record: object,
  userFields: string[]
): { sanitized: object; events: SecurityEvent[] } {
  const sanitized = { ...record } as Record<string, unknown>;
  const events: SecurityEvent[] = [];

  for (const field of userFields) {
    const value = sanitized[field];
    if (typeof value !== "string") continue;

    const result = sanitizeInput(value);
    if (result.injectionDetected) {
      sanitized[field] = result.clean;
      const event: SecurityEvent = {
        timestamp: new Date().toISOString(),
        field,
        patterns: result.patterns,
        severity: "HIGH",
      };
      events.push(event);
      addToLog(event);
    }
  }

  return { sanitized, events };
}

function addToLog(event: SecurityEvent): void {
  SECURITY_LOG.unshift(event);
  if (SECURITY_LOG.length > MAX_LOG_ENTRIES) {
    SECURITY_LOG.length = MAX_LOG_ENTRIES;
  }
}

export function getSecurityLog(): SecurityEvent[] {
  return [...SECURITY_LOG];
}

// Expose for testing in console
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_sanitizer = {
    sanitizeInput,
    sanitizeRecord,
    getSecurityLog,
  };
}
