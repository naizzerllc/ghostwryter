/**
 * Analytics Engine — Project analytics, velocity tracking, completion projection.
 * GHOSTLY v2.2 · Session 27
 *
 * All data derived from stored data only — no blocking API calls on load.
 */

import { getSessionSummary, type CostEntry } from "@/api/sessionCostTracker";

// ── Types ───────────────────────────────────────────────────────────────

export interface QualityDistribution {
  below_7: number;
  band_7_to_8: number;
  band_8_to_9: number;
  above_9: number;
}

export interface ProviderBreakdown {
  provider: string;
  tokens: number;
  cost_usd: number;
}

export interface ModulePerformance {
  module_name: string;
  average_score: number;
  chapters_evaluated: number;
}

export interface ProjectAnalytics {
  chapters_approved: number;
  chapters_pending: number;
  chapters_flagged: number;
  chapters_overridden: number;
  average_quality_score: number;
  quality_distribution: QualityDistribution;
  average_revisions_per_chapter: number;
  override_rate: number;
  total_tokens_used: number;
  total_cost_usd: number;
  provider_breakdown: ProviderBreakdown[];
  forbidden_word_violation_rate: number;
  most_flagged_module: string;
  module_performance: ModulePerformance[];
}

export type VelocityTrend = "ACCELERATING" | "STABLE" | "DECELERATING";

export interface VelocityData {
  chapters_per_day: number;
  days_since_start: number;
  chapters_approved_to_date: number;
  estimated_completion_date: string | null;
  velocity_trend: VelocityTrend;
  daily_approvals: { date: string; count: number }[];
}

export type ProjectionConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface ScenarioProjection {
  label: string;
  velocity: number;
  projected_days_remaining: number;
  projected_completion_date: string;
}

export interface CompletionProjection {
  total_chapters: number;
  approved_to_date: number;
  remaining_chapters: number;
  current_velocity: number;
  projected_days_remaining: number | null;
  projected_completion_date: string | null;
  confidence: ProjectionConfidence;
  blockers: string[];
  scenarios: ScenarioProjection[];
}

// ── Internal Data Loaders ───────────────────────────────────────────────

interface StoredChapterRecord {
  chapter_number: number;
  composite_score: number | null;
  human_editorial_override: boolean;
  human_editorial_sign_off: {
    status: string;
  };
  tokens_used: number;
  approved_at: string;
  revision_count?: number;
  forbidden_word_violations?: number;
  module_scores?: Record<string, number>;
  model_used?: string;
}

function loadStoredChapters(): StoredChapterRecord[] {
  const chapters: StoredChapterRecord[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("ghostly_approved_")) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.chapter_number === "number") {
            chapters.push(parsed);
          }
        }
      }
    }
  } catch {
    // graceful fallback
  }
  return chapters.sort((a, b) => a.chapter_number - b.chapter_number);
}

function loadOutlineChapterCount(): number {
  try {
    const raw = localStorage.getItem("ghostly_outline_data");
    if (!raw) return 0;
    const data = JSON.parse(raw);
    if (data.chapters && typeof data.chapters === "object") {
      return Object.keys(data.chapters).length;
    }
    if (Array.isArray(data)) return data.length;
    return 0;
  } catch {
    return 0;
  }
}

function loadBlockers(): string[] {
  const blockers: string[] = [];
  try {
    // MEI critical
    const mei = localStorage.getItem("ghostly_mei_latest");
    if (mei) {
      const parsed = JSON.parse(mei);
      if (parsed.composite_status === "CRITICAL") blockers.push("MEI_CRITICAL");
    }
    // Memory desync
    const memStatus = localStorage.getItem("ghostly_memory_core_status");
    if (memStatus === "PENDING_CONFIRMATION") blockers.push("MEMORY_DESYNC");
    // Escalation
    const escalation = localStorage.getItem("ghostly_escalation_active");
    if (escalation === "true") blockers.push("ESCALATION_ACTIVE");
    // Twist reseed
    const reseed = localStorage.getItem("ghostly_twist_reseed_required");
    if (reseed === "true") blockers.push("TWIST_RESEED_REQUIRED");
  } catch {
    // ignore
  }
  return blockers;
}

// ── Project Analytics ───────────────────────────────────────────────────

export function getProjectAnalytics(): ProjectAnalytics {
  const chapters = loadStoredChapters();
  const costSummary = getSessionSummary();

  const approved = chapters.filter(c => c.human_editorial_sign_off?.status === "SIGNED_OFF" || c.composite_score !== null);
  const pending = chapters.filter(c => c.human_editorial_sign_off?.status === "PENDING");
  const flagged = chapters.filter(c => c.human_editorial_sign_off?.status === "FLAGGED_FOR_REVISION");
  const overridden = chapters.filter(c => c.human_editorial_override);

  // Quality scores
  const scoredChapters = chapters.filter(c => c.composite_score !== null && c.composite_score !== undefined);
  const avgScore = scoredChapters.length > 0
    ? scoredChapters.reduce((sum, c) => sum + (c.composite_score ?? 0), 0) / scoredChapters.length
    : 0;

  const quality_distribution: QualityDistribution = { below_7: 0, band_7_to_8: 0, band_8_to_9: 0, above_9: 0 };
  for (const c of scoredChapters) {
    const s = c.composite_score!;
    if (s < 7) quality_distribution.below_7++;
    else if (s < 8) quality_distribution.band_7_to_8++;
    else if (s < 9) quality_distribution.band_8_to_9++;
    else quality_distribution.above_9++;
  }

  // Revisions
  const totalRevisions = chapters.reduce((sum, c) => sum + (c.revision_count ?? 0), 0);
  const avgRevisions = chapters.length > 0 ? totalRevisions / chapters.length : 0;

  // Override rate
  const overrideRate = chapters.length > 0 ? overridden.length / chapters.length : 0;

  // Provider breakdown from cost entries
  const providerMap = new Map<string, { tokens: number; cost: number }>();
  for (const entry of costSummary.entries) {
    const existing = providerMap.get(entry.provider) ?? { tokens: 0, cost: 0 };
    existing.tokens += entry.tokens_used;
    // Estimate cost per entry
    const rates: Record<string, { input: number; output: number }> = {
      anthropic: { input: 3.0, output: 15.0 },
      gemini_pro: { input: 1.25, output: 5.0 },
      gemini_flash: { input: 0.075, output: 0.3 },
      openai: { input: 2.5, output: 10.0 },
    };
    const r = rates[entry.provider] ?? rates.openai;
    existing.cost += (entry.tokens_used * 0.6 / 1_000_000) * r.input + (entry.tokens_used * 0.4 / 1_000_000) * r.output;
    providerMap.set(entry.provider, existing);
  }

  const provider_breakdown: ProviderBreakdown[] = Array.from(providerMap.entries()).map(([provider, data]) => ({
    provider,
    tokens: data.tokens,
    cost_usd: Math.round(data.cost * 10000) / 10000,
  }));

  // Forbidden word violations
  const totalViolations = chapters.reduce((sum, c) => sum + (c.forbidden_word_violations ?? 0), 0);
  const violationRate = chapters.length > 0 ? totalViolations / chapters.length : 0;

  // Module performance
  const moduleAccum = new Map<string, { total: number; count: number }>();
  for (const c of chapters) {
    if (c.module_scores) {
      for (const [mod, score] of Object.entries(c.module_scores)) {
        const existing = moduleAccum.get(mod) ?? { total: 0, count: 0 };
        existing.total += score;
        existing.count += 1;
        moduleAccum.set(mod, existing);
      }
    }
  }

  const module_performance: ModulePerformance[] = Array.from(moduleAccum.entries())
    .map(([module_name, data]) => ({
      module_name,
      average_score: Math.round((data.total / data.count) * 100) / 100,
      chapters_evaluated: data.count,
    }))
    .sort((a, b) => a.average_score - b.average_score);

  // Most flagged module — module with lowest average score
  const most_flagged_module = module_performance.length > 0 ? module_performance[0].module_name : "none";

  return {
    chapters_approved: approved.length,
    chapters_pending: pending.length,
    chapters_flagged: flagged.length,
    chapters_overridden: overridden.length,
    average_quality_score: Math.round(avgScore * 100) / 100,
    quality_distribution,
    average_revisions_per_chapter: Math.round(avgRevisions * 100) / 100,
    override_rate: Math.round(overrideRate * 10000) / 10000,
    total_tokens_used: costSummary.total_tokens,
    total_cost_usd: Math.round(costSummary.estimated_cost_usd * 10000) / 10000,
    provider_breakdown,
    forbidden_word_violation_rate: Math.round(violationRate * 100) / 100,
    most_flagged_module,
    module_performance,
  };
}

// ── Velocity Tracker ────────────────────────────────────────────────────

export function getVelocityData(): VelocityData {
  const chapters = loadStoredChapters();

  if (chapters.length === 0) {
    return {
      chapters_per_day: 0,
      days_since_start: 0,
      chapters_approved_to_date: 0,
      estimated_completion_date: null,
      velocity_trend: "STABLE",
      daily_approvals: [],
    };
  }

  // Build daily approval map
  const dailyMap = new Map<string, number>();
  let earliest = new Date();
  for (const c of chapters) {
    if (c.approved_at) {
      const date = new Date(c.approved_at);
      if (date < earliest) earliest = date;
      const dayKey = date.toISOString().slice(0, 10);
      dailyMap.set(dayKey, (dailyMap.get(dayKey) ?? 0) + 1);
    }
  }

  const now = new Date();
  const daysSinceStart = Math.max(1, Math.ceil((now.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)));

  // Fill in zero-days for a complete timeline
  const daily_approvals: { date: string; count: number }[] = [];
  const current = new Date(earliest);
  while (current <= now) {
    const dayKey = current.toISOString().slice(0, 10);
    daily_approvals.push({ date: dayKey, count: dailyMap.get(dayKey) ?? 0 });
    current.setDate(current.getDate() + 1);
  }

  // 7-day rolling average
  const last7 = daily_approvals.slice(-7);
  const chaptersLast7 = last7.reduce((s, d) => s + d.count, 0);
  const velocity7 = chaptersLast7 / Math.min(7, last7.length);

  // 14-day comparison for trend
  const last14 = daily_approvals.slice(-14);
  const first7of14 = last14.slice(0, 7);
  const second7of14 = last14.slice(7);
  const firstHalfVel = first7of14.reduce((s, d) => s + d.count, 0) / Math.max(1, first7of14.length);
  const secondHalfVel = second7of14.reduce((s, d) => s + d.count, 0) / Math.max(1, second7of14.length);

  let velocity_trend: VelocityTrend = "STABLE";
  if (secondHalfVel > firstHalfVel * 1.2) velocity_trend = "ACCELERATING";
  else if (secondHalfVel < firstHalfVel * 0.8) velocity_trend = "DECELERATING";

  // Estimated completion
  const totalChapters = loadOutlineChapterCount();
  const remaining = Math.max(0, totalChapters - chapters.length);
  let estimated_completion_date: string | null = null;
  if (velocity7 > 0 && remaining > 0) {
    const daysRemaining = Math.ceil(remaining / velocity7);
    const completionDate = new Date(now);
    completionDate.setDate(completionDate.getDate() + daysRemaining);
    estimated_completion_date = completionDate.toISOString().slice(0, 10);
  }

  return {
    chapters_per_day: Math.round(velocity7 * 100) / 100,
    days_since_start: daysSinceStart,
    chapters_approved_to_date: chapters.length,
    estimated_completion_date,
    velocity_trend,
    daily_approvals,
  };
}

// ── Completion Projector ────────────────────────────────────────────────

export function getCompletionProjection(): CompletionProjection {
  const totalChapters = loadOutlineChapterCount();
  const velocity = getVelocityData();
  const remaining = Math.max(0, totalChapters - velocity.chapters_approved_to_date);
  const blockers = loadBlockers();

  const currentVelocity = velocity.chapters_per_day;
  let projectedDays: number | null = null;
  let projectedDate: string | null = null;

  if (currentVelocity > 0 && remaining > 0) {
    projectedDays = Math.ceil(remaining / currentVelocity);
    const d = new Date();
    d.setDate(d.getDate() + projectedDays);
    projectedDate = d.toISOString().slice(0, 10);
  }

  // Confidence
  let confidence: ProjectionConfidence = "LOW";
  if (velocity.days_since_start >= 14 && velocity.velocity_trend === "STABLE") {
    confidence = "HIGH";
  } else if (velocity.days_since_start >= 7) {
    confidence = "MEDIUM";
  }

  // Scenarios
  const scenarios: ScenarioProjection[] = [];
  const now = new Date();

  if (remaining > 0) {
    // Current pace
    if (currentVelocity > 0) {
      const days = Math.ceil(remaining / currentVelocity);
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      scenarios.push({ label: "Current pace", velocity: currentVelocity, projected_days_remaining: days, projected_completion_date: d.toISOString().slice(0, 10) });
    }
    // Accelerated (2×)
    if (currentVelocity > 0) {
      const accelVel = currentVelocity * 2;
      const days = Math.ceil(remaining / accelVel);
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      scenarios.push({ label: "Accelerated (2×)", velocity: accelVel, projected_days_remaining: days, projected_completion_date: d.toISOString().slice(0, 10) });
    }
    // Minimum viable (1/day)
    {
      const days = remaining;
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      scenarios.push({ label: "Minimum viable (1/day)", velocity: 1, projected_days_remaining: days, projected_completion_date: d.toISOString().slice(0, 10) });
    }
  }

  return {
    total_chapters: totalChapters,
    approved_to_date: velocity.chapters_approved_to_date,
    remaining_chapters: remaining,
    current_velocity: currentVelocity,
    projected_days_remaining: projectedDays,
    projected_completion_date: projectedDate,
    confidence,
    blockers,
    scenarios,
  };
}

// ── Console Exposure ────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__ghostly_analyticsEngine = {
    getProjectAnalytics,
    getVelocityData,
    getCompletionProjection,
  };
}
