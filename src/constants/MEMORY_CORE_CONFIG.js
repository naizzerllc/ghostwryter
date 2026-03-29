/**
 * MEMORY_CORE_CONFIG — Hard token budgets for three context profiles.
 * GHOSTLY v2.2 · Session 5
 *
 * Generation profile has 5 tiers with sub-budgets.
 * Quality and reader simulation are flat ceiling profiles.
 */

export const MEMORY_CORE_CONFIG = {
  version: "1.0",

  profiles: {
    generation: {
      hard_ceiling: 10000,
      target_budget: 8000,
      label: "Generation context — Prose DNA injected",
      tiers: {
        tier_0: { budget: 800,  label: "Prose DNA runtime",                immovable: true },
        tier_1: { budget: 1200, label: "Style + clocks + session memory",  loaded: "once_per_session" },
        tier_2: { budget: 2000, label: "Characters + scene brief",         relevance_scored: true },
        tier_3: { budget: 1500, label: "Continuity bridge",                sub_budgeted: true },
        tier_4: { budget: 4500, label: "Output headroom" },
      },
    },

    quality_pass: {
      hard_ceiling: 2900,
      label: "Module evaluation — no Prose DNA",
    },

    reader_simulation: {
      hard_ceiling: 2300,
      label: "Naive reader — stateless, no editorial meta",
    },
  },
};
