# AGENTS.md — GHOSTLY v2.2
## Technical Specifications · Complex Logic · Build State · Session Protocol
## Lovable Agent Context | Updated after each completed build prompt

---

## BUILD STATE (update this section after every prompt completes)

```
Platform:          Ghostly v2.2
Active prompt:     5 (in progress — MSG-5 complete)
Last completed:    Prompt 01 ✅ (all deliverables verified)
Prompts pending:   5–15
MIC version:       2.1
Schema version:    2.8 (outline format)
Prose DNA version: v2.3 (17 rules)
```

### Completed files (update as each prompt builds them)

| Prompt | Status | Key files produced |
|--------|--------|--------------------|
| 01 | ✅ Complete | UI shell · Settings · Sidebar · StatusBar · AppLayout · Dashboard · Prose DNA (PROSE_DNA.md + PROSE_DNA_RUNTIME.js) · STYLE_PROFILES.json · FORBIDDEN_WORDS.json · forbiddenWordsChecker.ts · sanitizer.ts · llmRouter.ts (callAnthropic + prompt caching) · sessionCostTracker.ts · githubStorage.ts · memoryCore.ts · MEMORY_CORE_CONFIG.js · MODULE_INTERFACE_CONTRACT.json · startupValidator.ts · StartupValidatorPanel.tsx · Dashboard panels (Panel/Security/MemoryCore/TokenEconomy/MIC) |
| 02 | ✅ Complete | githubStorage.ts · sanitizer.ts · DisconnectionBanner |
| 03 | ✅ Complete | llmRouter.ts · sessionCostTracker.ts · callAnthropic · TOKEN ECONOMY panel |
| 04 | ✅ Complete | PROSE_DNA.md · PROSE_DNA_RUNTIME.js · STYLE_PROFILES.json · FORBIDDEN_WORDS.json · forbiddenWordsChecker.ts |
| 05 | 🔧 In Progress (MSG-5) | memoryCore.ts · MEMORY_CORE_CONFIG.js · MODULE_INTERFACE_CONTRACT.json · MIC validator · startupValidator.ts · StartupValidatorPanel.tsx · Dashboard refactored → Panel.tsx · SecurityLogPanel.tsx · MemoryCorePanel.tsx · TokenEconomyPanel.tsx · MICPanel.tsx |
| 06–15 | ⏳ Pending | — |

---

## SESSION PROTOCOL — READ THIS FIRST

Every Lovable session must follow this sequence:

**Starting a new prompt:**
1. New chat — never continue from a prior prompt's chat
2. This AGENTS.md is loaded automatically as project knowledge
3. Paste the COLD_START_PACKAGE.md content as your first message
4. Paste any existing files the new prompt will extend (from GitHub)
5. Paste the build prompt for this prompt number
6. Build and iterate
7. When the completion checklist passes: export all files to GitHub
8. Update the Build State table above
9. Close chat

**The Cold Start Package** (paste at the start of every session after Prompt 1):
See `COLD_START_PACKAGE.md` in the project folder.
It is ~700 tokens. Always include it. It carries the architectural invariants.

**Completion gate:** Do not move to Prompt N+1 until the Prompt N completion checklist
passes in full. The checklist is at the end of each build prompt document.

---

## TASK ROUTING — COMPLETE SPECIFICATION

```javascript
const TASK_ROUTING = {
  // Generation — Prose DNA injected
  generation_protagonist:       { provider: 'anthropic',    inject_prose_dna: true  },
  generation_antagonist:        { provider: 'gemini_pro',   inject_prose_dna: false },
  generation_supporting:        { provider: 'gemini_pro',   inject_prose_dna: false },

  // Anti-AI detection — split routing
  anti_ai_detection:            { provider: 'gemini_flash', inject_prose_dna: false }, // PRIMARY
  anti_ai_detection_secondary:  { provider: 'anthropic',    inject_prose_dna: true  }, // SECONDARY

  // Quality analysis — NO Prose DNA
  quality_analysis:             { provider: 'gemini_flash', inject_prose_dna: false },
  continuity_check:             { provider: 'gemini_flash', inject_prose_dna: false },
  living_state_update:          { provider: 'gemini_flash', inject_prose_dna: false },
  revision_scope:               { provider: 'gemini_flash', inject_prose_dna: false },
  misdirection_erosion_check:   { provider: 'gemini_flash', inject_prose_dna: false },

  // Reader simulation — NO Prose DNA, stateless call
  reader_simulation:            { provider: 'openai',       inject_prose_dna: false },
};

const TASK_FALLBACK_OVERRIDES = {
  generation_antagonist: ['openai'],     // NEVER anthropic — voice homogeneity failure
  generation_supporting: ['openai'],     // NEVER anthropic — voice homogeneity failure
  reader_simulation:     ['gemini_pro'], // Degraded mode — logs generator-evaluator overlap warning
};
```

### Provider aliases (auto-latest — never pin in code)

```javascript
providers: {
  anthropic:    { alias: 'claude-sonnet-latest' },
  gemini_pro:   { alias: 'gemini-2.0-pro-latest' },
  gemini_flash: { alias: 'gemini-2.0-flash-latest' },
  openai:       { alias: 'gpt-4o' }
}
```

`resolveModelString(provider)` is the single point of resolution — checks
`pinned_override` first, falls back to `alias`. No hardcoded version strings anywhere
in `/src` code.

### Prompt caching — Anthropic calls

All `callAnthropic()` calls use a structured two-block system prompt:
```javascript
// Static block — cached (Prose DNA + Style Layer + Forbidden Words header)
{ text: staticContent, cache_control: { type: 'ephemeral', ttl: '1h' } }
// Dynamic block — not cached (per-call chapter brief)
{ text: dynamicContent }
```

Header: `'anthropic-beta': 'extended-cache-ttl-2025-04-11'`

Returns: `{ content, model_used, provider, tokens_used, cache_read_tokens, cache_write_tokens }`

---

## MODULE INTERFACE CONTRACT v2.1 — SCHEMA SUMMARY

Full schemas in `/src/constants/MODULE_INTERFACE_CONTRACT.json`. Fields version: **v1.9**.
This summary is the quick reference for what schemas exist and where they are built.

| Schema | Built in | Critical fields |
|--------|----------|-----------------||
| `project_config_record` | Prompt 2 | genre_mode, twist_architecture, narrator_reliability, revelation_chapter, override_log, breadcrumb_landing_summary, cost_log, reader_simulation_persona, last_anthropic_model, voice_benchmark_baseline |
| `chapter_outline_record` | Prompt 5 | chapter_number, timeline_id, scene_purpose, hook_type, hook_seed (mandatory — specific image/detail), narrator_deception_gesture (mandatory for psych thriller pre-revelation), tension_score_target, opening_type, opening_seed, collision_specification, permanent_change, protagonist_decision_type |
| `scene_brief_output` | Prompt 6 | generation_brief, active_clocks, character_context, subtext_targets, tension_target, hook_required, opening_required, hook_continuity_bridge, token_budget_used |
| `approved_chapter_record` | Prompt 8/9 | chapter_number, approved_draft, composite_score, human_editorial_override, emotional_state_at_chapter_end, generation_truncation_suspected, human_editorial_sign_off |
| `quality_gate_result` | Prompt 9/10 | module_scores, weighted_score, compulsion_rating, twist_integrity_verdict, result, veto_scene_purpose |
| `compulsion_curve_record` | Prompt 10 | chapter_number, tension_score_target, tension_score_actual, compulsion_score, hook_compulsion_score, entry_compulsion_score, act, approved_at |
| `character_record` | Prompt 2 | wound, flaw, want, need, self_deception, compressed_voice_dna, external_goal, internal_desire, goal_desire_gap, corpus_approved, voice_reliability (HIGH/MISSING) |
| `voice_corpus_gate_result` | Prompt 2 | character_id, scores (4 dimensions), composite_score, gate_result, generation_blocked |
| `prose_freshness_record` | Prompt 5 | physical_action_log, imagery_cluster_log, freshness_risk_flag, consecutive_high_chapters, escalation_status |
| `misdirection_erosion_index` | Prompt 9 | possibility_space, suppressed_evidence_exposure, self_deception_coherence, composite_status, action_required |
| `platform_failure_record` | Prompt 1 | failure_type (7 types), detected_at, chapter_number, description, recovery_action, data_loss_risk |
| `catalogue_registry_record` | Prompt 2 | title_id, self_deception_category, protagonist_wound_type, antagonist_type, revelation_mechanism, key_imagery_set |

**Key v1.9 additions (GHOSTLY_AMENDMENTS_v2_4):** `external_goal` + `internal_desire` + `goal_desire_gap` in `character_record`. `twist_dimension` in `misdirection_map`. `goal_desire_arc_check` in developmental_editor output.

**Key Audit 22 additions:** `hook_seed` mandatory specificity. `narrator_deception_gesture` mandatory for psych thriller pre-revelation. `false_trail_sequence` (3 beats) replaces `false_trail_intensifier`. `recontextualisation_list` minimum 8. Outline schema v2.8.

**`human_editorial_sign_off` status values:** PENDING | SIGNED_OFF | FLAGGED_FOR_REVISION | SKIPPED — defaults to PENDING on every automated approval, no exceptions.

---

## FAILURE MODE DETECTION — LLM ROUTER RETURN OBJECT

`callAnthropic()` returns these fields for failure mode detection:

```javascript
{
  content: string,
  model_used: string,
  provider: 'anthropic',
  tokens_used: number,
  cache_read_tokens: number,
  cache_write_tokens: number,
  refusal_detected: boolean,      // stop_reason === 'refusal' OR content < 200 chars
  truncation_suspected: boolean   // stop_reason === 'end_turn' AND output_tokens < 300
}
```

**On `refusal_detected: true`:** Log to `platform_failure_record` with
`failure_type: CONTENT_REFUSAL`. Do NOT mark as quality gate failure.
Surface recovery UI (4 options: revise brief / reframe / manual write / escalate).

**On `truncation_suspected: true`:** Set `generation_truncation_suspected: true` on
`approved_chapter_record`. Mandatory human sign-off required — SKIPPED not permitted.

**Model version drift detection:** On session start, compare `resolveModelString('anthropic')`
against `platform_config_record.last_anthropic_model`. If prefix differs → surface
model change notification. Minor version: amber (dismissible). Major version: red
(benchmark re-check mandatory — DISMISS not available).

---

## SEVEN FAILURE MODES — QUICK REFERENCE

Full spec in `PLATFORM_FAILURE_RECOVERY_SPEC.md`.

| # | Type | Detection | Key recovery |
|---|------|-----------|--------------|
| 1 | GitHub disconnection | GitHub API non-200 | Persistent banner · generation pause · export backup |
| 2 | LLM provider outage | 503 / timeout | Fallback with cost warning · `pending_quality_review` status |
| 3 | Revision loop escalation | 7 total failed attempts | Escalation UI · 4 resolution options |
| 4 | Memory Core desync | chapter_approved_count vs memory updates | RECONSTRUCT or MANUAL REVIEW |
| 5 | Context overflow | assembled brief > 8,000T | Options: reduce scope / increase budget / split chapter |
| 6 | Content refusal / truncation | `refusal_detected` or `truncation_suspected` | Revise brief / reframe / manual write / escalate |
| 7 | Model voice drift | `last_anthropic_model` prefix change | Benchmark re-check · DRIFT_WARNING / DRIFT_CRITICAL gates |

`platform_failure_record.failure_type` enum:
`GITHUB_DISCONNECTION | PROVIDER_OUTAGE | REVISION_ESCALATION | MEMORY_DESYNC | CONTEXT_OVERFLOW | CONTENT_REFUSAL | MODEL_VOICE_DRIFT`

---

## FORBIDDEN WORDS — ENFORCEMENT IMPLEMENTATION

```javascript
// Tier processing order — enforced in code
// 1. hard_ban      → auto-remove + log (all contexts including dialogue)
// 2. dialogue_exempt → flag in narration, permit in dialogue (context-aware)
// 3. soft_ban      → flag if count > threshold (default 2) per chapter
// 4. context_flag  → flag in ALL contexts for human review — do NOT auto-remove

// CRITICAL: A word cleared by dialogue_exempt in dialogue context is NOT
// re-evaluated by context_flag. No word appears in more than one tier.
// Use word-boundary regex (\b) — not substring includes().
// dialogue_exempt requires context detection: narration vs quoted speech.
```

**Key hard_ban words:** suddenly, realized, noticed, felt, seemed, just, very, really,
actually, nodded, shrugged, sighed, smiled, frowned, gasped, stomach dropped,
heart raced, in that moment, little did she know, time seemed to slow

**dialogue_exempt words (narration-flagged, dialogue-permitted):**
authentic, genuine, nuanced, balance, resonate, compelling, remarkable,
seamless, pivotal, transformative, meaningful, profound, dynamic, robust

**soft_ban words:** amid, amidst, and yet (threshold: 2 per chapter)

**context_flag words:** ambiguity, somehow, something, certain, strange, odd, weird,
suddenly, realize, realise

---

## BUILD SEQUENCE — ALL 15 PROMPTS

| Prompt | Scope | Status |
|--------|-------|--------|
| 01 | Foundation · Prose DNA v2.3 · Style Layer · Forbidden Words v2.3 · Security · LLM Router · Memory Core · Module Interface Contract v2.1 · GitHub Storage · UI Shell · Prompt Caching | ✅ Complete |
| 02 | Story Bible Import · Character DB · Voice DNA · Voice Corpus Quality Gate · Antagonist System Prompt · Outline Import Diagnostic · Breadcrumb Integrity · Catalogue Fit Check | ⏳ Pending |
| 03 | Canonical Facts DB · Knowledge Boundary Map · Spoiler Protection · Series Memory | ⏳ Pending |
| 04 | Dramatic Architecture Engine · Clock Registry · Tension Curve · Rollercoaster Enforcer · Warmth Spacing Validator | ⏳ Pending |
| 05 | Outline System · Living State · Character Arc Dashboard · Karma Tracker · Emotional Continuity Field · Memory Desync Detection | ⏳ Pending |
| 06 | Briefing Generator · Relevance Scoring · Dialogue Subtext Mapper · Pre-Generation Brief Validation Gate · Quirk Injection · Suppressed Evidence Brief · Emotional Continuity Check · Voice Register Anchor Injection | ⏳ Pending |
| 07 | Pacing Contrast System · Genre Calibration · Cold Start System | ⏳ Pending |
| 08 | Generation Core · Chapter Pipeline · Human Review Interface · Manuscript Health Dashboard (minimal) · First Chapter Human Calibration Gate · Human Override Pattern Report · All recovery UIs | ⏳ Pending |
| 09 | Quality Pipeline · Developmental Editor · Line Editor · Dialogue Editor · Continuity Editor · Misdirection Erosion Index · Structured outputs for all quality modules | ⏳ Pending |
| 10 | Reader Simulation · Anti-AI Detector (full) · Genre-Specific AI Tell Detection · Tension Meter · Hook Validator · Quality Gate (full with 4 vetoes) | ⏳ Pending |
| 11 | Chapter Archive · Version Control · Manuscript Assembler · Export Pipeline | ⏳ Pending |
| 12 | Session Manager · Project Manager · Trilogy Manager · World Pack Switcher · Rollercoaster Integrity Check · Project Cost Estimator | ⏳ Pending |
| 13 | Editorial Pipeline · Continuity Audit · Scene Revision Tool · Target Compulsion Curve Dashboard · Voice Register Review Panel | ⏳ Pending |
| 14 | Analytics · Velocity Tracker · Completion Projector · Full Manuscript Health Dashboard | ⏳ Pending |
| 15 | Final Wiring · 25-item Startup Validator · Production Checklist · Launch · FIRST_USE_GUIDE.md · voice_benchmark_baseline population | ⏳ Pending |

---

## ARCHITECTURAL CONSTRAINT INVARIANTS

These are verified at the end of every build prompt session.

**[1] BRAND_LOCK:** `leila_rex_default.brand_lock: true` in STYLE_PROFILES.json.
No style profile switching UI exists anywhere.

**[2] FORBIDDEN_WORDS:** Enforcement is code-only (`forbiddenWordsChecker.js`).
Never injected into any LLM call. Four tiers. No word duplicated across tiers.

**[3] ANTAGONIST_ROUTING:** `generation_antagonist` routes to `gemini_pro`.
Fallback chain is `['openai']` — never anthropic. Immovable.

**[4] PROSE_DNA_SCOPE:** Prose DNA injected ONLY for `generation_protagonist` and
`anti_ai_detection_secondary`. No other task type receives Prose DNA.

**[5] CONTRACT_VERSION:** MODULE_INTERFACE_CONTRACT.json `"version": "2.1"`.
All inter-module data exchange uses documented schemas only.

**[A16-1] SIGN_OFF_DEFAULT:** `human_editorial_sign_off.status` defaults to PENDING
on every automated chapter approval. No chapter is born SIGNED_OFF.

**[A16-2] LOCK_GATE:** Manuscript lock cannot proceed with any chapter at PENDING or
FLAGGED_FOR_REVISION. No bypass.

**[A16-3] PERSONA_INJECTION:** `reader_simulation_persona.active_persona` is injected
into Reader Simulation system prompt at call time. Initial values must be present in
PLATFORM_CONFIG.json from Prompt 1.

**[A16-4] HARDENING_DECREMENT:** `subtext_hardening_chapters_remaining` decrements
by 1 after each chapter brief assembly where `subtext_hardening_active: true`.

**[A17-1] CACHE_STRUCTURE:** All `callAnthropic()` callers pass system prompt as
`[{ text: staticContent }, { text: dynamicContent }]`. Plain strings receive no
cache benefit.

**[A17-2] STRUCTURED_OUTPUTS_GATE:** At Prompt 9, verify structured output API
availability for Gemini Flash. Fallback: strict JSON prompting with hard retry.

**[A17-3] REFUSAL_NOT_QUALITY:** Content refusals log as `CONTENT_REFUSAL` in
`platform_failure_record`. Not as quality gate failures.

**[A17-4] DRIFT_GATE_MANDATORY:** Model voice drift check before Book 2 is a hard gate.
Cannot be dismissed or deferred.

---

*AGENTS.md | Ghostly v2.2 | Updated after each completed build prompt*
*This file is read by Lovable's agent system as technical context for every session.*
