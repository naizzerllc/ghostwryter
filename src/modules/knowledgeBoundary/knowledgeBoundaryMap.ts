/**
 * Knowledge Boundary Map — tracks what the narrator can know at each chapter.
 * GHOSTLY v2.2 · S11
 *
 * Prevents spoilers: REVELATION_FACTs hidden before revelation_chapter.
 * Future events and unintroduced characters are OUT_OF_SCOPE.
 * Runs as post-generation check alongside forbidden words checker.
 */

import type { CanonicalFact } from "@/modules/canonicalFacts/canonicalFactsDB";
import { getAllFacts } from "@/modules/canonicalFacts/canonicalFactsDB";

// ── Types ───────────────────────────────────────────────────────────────

export type BoundaryStatus = "IN_SCOPE" | "OUT_OF_SCOPE" | "REVELATION_PROTECTED";

export interface BoundaryEntry {
  fact_id: string;
  statement: string;
  status: BoundaryStatus;
  reason: string;
}

export interface ChapterBoundary {
  chapter_number: number;
  known_facts: BoundaryEntry[];
  hidden_facts: BoundaryEntry[];
  introduced_characters: string[];
}

export interface KnowledgeBoundaryMap {
  chapters: ChapterBoundary[];
  total_facts: number;
  revelation_chapter: number | null;
  built_at: string;
}

export type ViolationSeverity = "CRITICAL" | "WARNING";

export interface BoundaryViolation {
  chapter_number: number;
  severity: ViolationSeverity;
  fact_id: string;
  fact_statement: string;
  violation_type: "REVELATION_SPOILER" | "FUTURE_EVENT" | "UNKNOWN_CHARACTER";
  matched_content: string;
  message: string;
}

// ── Outline Types (minimal) ─────────────────────────────────────────────

interface OutlineChapter {
  chapter_number: number;
  characters?: string[];
  [key: string]: unknown;
}

interface CharacterRecord {
  character_id: string;
  name: string;
  introduced_chapter?: number;
  [key: string]: unknown;
}

// ── Build Boundary Map ──────────────────────────────────────────────────

/**
 * Build a knowledge boundary map from the outline and character database.
 * For each chapter, determine which facts are within narrator knowledge.
 */
export function buildBoundaryMap(
  outline: { chapters: OutlineChapter[] },
  characters: CharacterRecord[],
): KnowledgeBoundaryMap {
  const allFacts = getAllFacts();
  const sortedChapters = [...outline.chapters].sort(
    (a, b) => a.chapter_number - b.chapter_number,
  );

  // Build character introduction map
  const charIntroMap = new Map<string, number>();
  for (const char of characters) {
    if (char.introduced_chapter) {
      charIntroMap.set(char.name.toLowerCase(), char.introduced_chapter);
    }
  }

  // Also infer from outline chapter character lists
  for (const ch of sortedChapters) {
    if (ch.characters) {
      for (const name of ch.characters) {
        const key = name.toLowerCase();
        if (!charIntroMap.has(key)) {
          charIntroMap.set(key, ch.chapter_number);
        }
      }
    }
  }

  // Find revelation chapter
  const revelationFacts = allFacts.filter(
    f => f.category === "REVELATION_FACT" && f.revelation_chapter,
  );
  const revelationChapter = revelationFacts.length > 0
    ? Math.min(...revelationFacts.map(f => f.revelation_chapter!))
    : null;

  const chapters: ChapterBoundary[] = sortedChapters.map(ch => {
    const chNum = ch.chapter_number;
    const known: BoundaryEntry[] = [];
    const hidden: BoundaryEntry[] = [];

    // Track which characters are introduced by this chapter
    const introduced: string[] = [];
    for (const [name, introChapter] of charIntroMap) {
      if (introChapter <= chNum) introduced.push(name);
    }

    for (const fact of allFacts) {
      // REVELATION_FACT protection
      if (fact.category === "REVELATION_FACT" && fact.revelation_chapter) {
        if (chNum < fact.revelation_chapter) {
          hidden.push({
            fact_id: fact.fact_id,
            statement: fact.statement,
            status: "REVELATION_PROTECTED",
            reason: `Revelation protected until chapter ${fact.revelation_chapter}`,
          });
          continue;
        }
      }

      // Future-established facts
      if (fact.established_at_chapter > chNum) {
        hidden.push({
          fact_id: fact.fact_id,
          statement: fact.statement,
          status: "OUT_OF_SCOPE",
          reason: `Not established until chapter ${fact.established_at_chapter}`,
        });
        continue;
      }

      // Characters not yet introduced
      const unreferencedChar = fact.characters_involved.find(c => {
        const intro = charIntroMap.get(c.toLowerCase());
        return intro !== undefined && intro > chNum;
      });
      if (unreferencedChar) {
        hidden.push({
          fact_id: fact.fact_id,
          statement: fact.statement,
          status: "OUT_OF_SCOPE",
          reason: `Character "${unreferencedChar}" not introduced until later`,
        });
        continue;
      }

      known.push({
        fact_id: fact.fact_id,
        statement: fact.statement,
        status: "IN_SCOPE",
        reason: "Within narrator knowledge",
      });
    }

    return {
      chapter_number: chNum,
      known_facts: known,
      hidden_facts: hidden,
      introduced_characters: introduced,
    };
  });

  return {
    chapters,
    total_facts: allFacts.length,
    revelation_chapter: revelationChapter,
    built_at: new Date().toISOString(),
  };
}

// ── Boundary Violation Check ────────────────────────────────────────────

/**
 * Check generated content against the knowledge boundary map for a given chapter.
 * Returns violations: CRITICAL for revelation spoilers, WARNING for future events.
 */
export function checkBoundary(
  content: string,
  chapterNumber: number,
  map: KnowledgeBoundaryMap,
): BoundaryViolation[] {
  const chapterBoundary = map.chapters.find(
    c => c.chapter_number === chapterNumber,
  );
  if (!chapterBoundary) return [];

  const violations: BoundaryViolation[] = [];
  const contentLower = content.toLowerCase();

  for (const hidden of chapterBoundary.hidden_facts) {
    // Extract key terms from the hidden fact statement
    const factTerms = extractKeyTerms(hidden.statement);

    // Check if content references this hidden fact
    const matchedTerms = factTerms.filter(term => contentLower.includes(term));

    // Require at least 2 matching terms to flag (reduces false positives)
    if (matchedTerms.length >= 2) {
      const severity: ViolationSeverity =
        hidden.status === "REVELATION_PROTECTED" ? "CRITICAL" : "WARNING";

      const violationType =
        hidden.status === "REVELATION_PROTECTED"
          ? "REVELATION_SPOILER"
          : "FUTURE_EVENT";

      violations.push({
        chapter_number: chapterNumber,
        severity,
        fact_id: hidden.fact_id,
        fact_statement: hidden.statement,
        violation_type: violationType as BoundaryViolation["violation_type"],
        matched_content: matchedTerms.join(", "),
        message:
          severity === "CRITICAL"
            ? `SPOILER: Content references revelation fact "${hidden.statement}" before chapter ${chapterNumber}. This BLOCKS chapter approval.`
            : `Content may reference future event: "${hidden.statement}". Review recommended.`,
      });
    }
  }

  // Check for unintroduced character references
  const allCharNames = new Map<string, number>();
  for (const ch of map.chapters) {
    for (const name of ch.introduced_characters) {
      if (!allCharNames.has(name)) {
        allCharNames.set(name, ch.chapter_number);
      }
    }
  }

  for (const [charName, introChapter] of allCharNames) {
    if (introChapter > chapterNumber && contentLower.includes(charName)) {
      violations.push({
        chapter_number: chapterNumber,
        severity: "WARNING",
        fact_id: `char_${charName}`,
        fact_statement: `Character "${charName}" introduced at chapter ${introChapter}`,
        violation_type: "UNKNOWN_CHARACTER",
        matched_content: charName,
        message: `Character "${charName}" referenced before introduction (chapter ${introChapter}).`,
      });
    }
  }

  return violations;
}

/**
 * Extract key terms from a fact statement for matching.
 * Filters out common stop words, returns lowercase terms.
 */
function extractKeyTerms(statement: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "and", "but", "or",
    "not", "no", "nor", "so", "yet", "both", "either", "neither", "that",
    "this", "these", "those", "it", "its", "he", "she", "they", "them",
    "his", "her", "their", "who", "whom", "which", "what", "when", "where",
  ]);

  return statement
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 8); // Cap at 8 key terms
}

// ── Dependency Gate ─────────────────────────────────────────────────────

let _installed = true; // This module is installed if this file loads

export function isInstalled(): boolean {
  return _installed;
}

/**
 * Returns dependency gate warning if Knowledge Boundary is not ready.
 * Not a hard block — informational only.
 */
export function getDependencyWarning(): string | null {
  const factCount = getAllFacts().length;
  if (factCount === 0) {
    return "Knowledge Boundary Map not installed. Canonical fact checking unavailable. Spoiler protection inactive.";
  }
  return null;
}

// ── Window Registration ─────────────────────────────────────────────────
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_knowledgeBoundary = {
    buildBoundaryMap,
    checkBoundary,
    isInstalled,
    getDependencyWarning,
  };
}
