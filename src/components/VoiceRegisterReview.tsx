/**
 * Voice Register Review Panel — S26
 * GHOSTLY v2.2
 *
 * Side-by-side register comparison for detecting model voice drift.
 * Uses Gemini Flash to compare chapter excerpts against clinical_dissociative baseline.
 */

import { useState, useCallback } from "react";
import { callWithFallback } from "@/api/llmRouter";
import { Loader2, AlertTriangle } from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────

export interface RegisterComparison {
  chapter_a_register_score: number;
  chapter_b_register_score: number;
  drift_detected: boolean;
  drift_description: string;
  specific_differences: string[];
}

interface ChapterExcerpt {
  chapter_number: number;
  excerpt: string;
}

// ── Storage Helpers ─────────────────────────────────────────────────────

function loadChapterExcerpt(projectId: string, chapterNumber: number): ChapterExcerpt | null {
  try {
    const key = `ghostly_approved_${projectId}_ch${chapterNumber}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const record = JSON.parse(raw);
    const content = record.approved_draft || record.content || "";
    return {
      chapter_number: chapterNumber,
      excerpt: content.slice(0, 500),
    };
  } catch {
    return null;
  }
}

function getApprovedChapterNumbers(projectId: string): number[] {
  const chapters: number[] = [];
  for (let i = 1; i <= 60; i++) {
    const key = `ghostly_approved_${projectId}_ch${i}`;
    if (localStorage.getItem(key)) chapters.push(i);
  }
  return chapters;
}

// ── Comparison Logic ────────────────────────────────────────────────────

export async function compareRegister(
  chapterA: number,
  chapterB: number,
  projectId: string,
): Promise<RegisterComparison> {
  const excerptA = loadChapterExcerpt(projectId, chapterA);
  const excerptB = loadChapterExcerpt(projectId, chapterB);

  if (!excerptA || !excerptB) {
    throw new Error(`Missing approved content for chapter ${!excerptA ? chapterA : chapterB}`);
  }

  const prompt = `You are a voice register analyst for the Leila Rex brand (psychological thriller, clinical_dissociative register).

The clinical_dissociative register is: controlled, precise, slightly detached. First person present tense. Interiority through observation and physical response — never direct psychological labelling.

Compare these two chapter excerpts for register consistency:

CHAPTER ${chapterA} (first 500 words):
${excerptA.excerpt}

CHAPTER ${chapterB} (first 500 words):
${excerptB.excerpt}

Score each chapter's adherence to clinical_dissociative register (1-10, where 10 = perfect adherence).
Identify any drift between the two chapters.

Return JSON:
{
  "chapter_a_register_score": <1-10>,
  "chapter_b_register_score": <1-10>,
  "drift_detected": <boolean>,
  "drift_description": "<description of drift or 'No drift detected'>",
  "specific_differences": ["<difference 1>", "<difference 2>"]
}

Return ONLY valid JSON.`;

  const response = await callWithFallback("quality_analysis", prompt);
  const parsed = JSON.parse(response.content);

  return {
    chapter_a_register_score: parsed.chapter_a_register_score || 0,
    chapter_b_register_score: parsed.chapter_b_register_score || 0,
    drift_detected: parsed.drift_detected || false,
    drift_description: parsed.drift_description || "No drift detected",
    specific_differences: parsed.specific_differences || [],
  };
}

// ── Drift Pattern Detection ─────────────────────────────────────────────

export async function detectDriftPattern(
  projectId: string,
  chapterRange: number[],
): Promise<{ pattern_detected: boolean; flagged_chapters: number[] }> {
  if (chapterRange.length < 4) {
    return { pattern_detected: false, flagged_chapters: [] };
  }

  const driftResults: boolean[] = [];
  for (let i = 0; i < chapterRange.length - 1; i++) {
    try {
      const result = await compareRegister(chapterRange[i], chapterRange[i + 1], projectId);
      driftResults.push(result.drift_detected);
    } catch {
      driftResults.push(false);
    }
  }

  // Check for 3+ consecutive drift detections
  let consecutive = 0;
  let maxConsecutiveStart = -1;
  for (let i = 0; i < driftResults.length; i++) {
    if (driftResults[i]) {
      consecutive++;
      if (consecutive >= 3 && maxConsecutiveStart === -1) {
        maxConsecutiveStart = i - consecutive + 1;
      }
    } else {
      consecutive = 0;
    }
  }

  if (consecutive >= 3 || maxConsecutiveStart >= 0) {
    const flagged = chapterRange.filter((_, i) => i > 0 && driftResults[i - 1]);
    return { pattern_detected: true, flagged_chapters: flagged };
  }

  return { pattern_detected: false, flagged_chapters: [] };
}

// ── Component ───────────────────────────────────────────────────────────

interface VoiceRegisterReviewProps {
  projectId?: string;
}

export default function VoiceRegisterReview({ projectId = "default" }: VoiceRegisterReviewProps) {
  const approvedChapters = getApprovedChapterNumbers(projectId);

  const [chapterA, setChapterA] = useState<number>(approvedChapters[0] || 1);
  const [chapterB, setChapterB] = useState<number>(approvedChapters[1] || 2);
  const [comparison, setComparison] = useState<RegisterComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const excerptA = loadChapterExcerpt(projectId, chapterA);
  const excerptB = loadChapterExcerpt(projectId, chapterB);

  const handleCompare = useCallback(async () => {
    setLoading(true);
    setError(null);
    setComparison(null);
    try {
      const result = await compareRegister(chapterA, chapterB, projectId);
      setComparison(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  }, [chapterA, chapterB, projectId]);

  if (approvedChapters.length < 2) {
    return (
      <p className="text-xs text-muted-foreground font-mono">
        At least 2 approved chapters required for register comparison.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chapter Selectors */}
      <div className="flex items-end gap-4">
        <div>
          <label className="text-xs text-muted-foreground font-mono block mb-1">Chapter A</label>
          <select
            value={chapterA}
            onChange={(e) => setChapterA(Number(e.target.value))}
            className="px-2 py-1.5 bg-background border border-border text-foreground text-xs font-mono"
          >
            {approvedChapters.map((ch) => (
              <option key={ch} value={ch}>Ch {ch}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-mono block mb-1">Chapter B</label>
          <select
            value={chapterB}
            onChange={(e) => setChapterB(Number(e.target.value))}
            className="px-2 py-1.5 bg-background border border-border text-foreground text-xs font-mono"
          >
            {approvedChapters.map((ch) => (
              <option key={ch} value={ch}>Ch {ch}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleCompare}
          disabled={loading || chapterA === chapterB}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-accent text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          RUN COMPARISON
        </button>
      </div>

      {/* Side-by-side excerpts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-border p-3">
          <p className="text-xs font-mono text-muted-foreground mb-2">
            Chapter {chapterA} — first 500 words
            {comparison && (
              <span className="ml-2 text-foreground">
                Register: {comparison.chapter_a_register_score}/10
              </span>
            )}
          </p>
          <div className="text-xs font-serif text-foreground/80 max-h-40 overflow-y-auto whitespace-pre-wrap">
            {excerptA?.excerpt || "No content available"}
          </div>
        </div>
        <div className="border border-border p-3">
          <p className="text-xs font-mono text-muted-foreground mb-2">
            Chapter {chapterB} — first 500 words
            {comparison && (
              <span className="ml-2 text-foreground">
                Register: {comparison.chapter_b_register_score}/10
              </span>
            )}
          </p>
          <div className="text-xs font-serif text-foreground/80 max-h-40 overflow-y-auto whitespace-pre-wrap">
            {excerptB?.excerpt || "No content available"}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive font-mono">
          <AlertTriangle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {/* Comparison Result */}
      {comparison && (
        <div className="border border-border p-3 space-y-2">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-mono px-2 py-0.5 border ${
              comparison.drift_detected
                ? "border-warning text-warning"
                : "border-success text-success"
            }`}>
              {comparison.drift_detected ? "DRIFT DETECTED" : "REGISTER CONSISTENT"}
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              Δ {Math.abs(comparison.chapter_a_register_score - comparison.chapter_b_register_score).toFixed(1)}
            </span>
          </div>

          <p className="text-xs font-mono text-foreground">{comparison.drift_description}</p>

          {comparison.specific_differences.length > 0 && (
            <ul className="space-y-1">
              {comparison.specific_differences.map((diff, i) => (
                <li key={i} className="text-xs font-mono text-muted-foreground pl-3 border-l border-border">
                  {diff}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
