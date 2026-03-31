// PROSE DNA RUNTIME — Ghostly v2.2
// Version: 2.4 (18 rules)
// Last updated: S24A
// Reference: PROSE_DNA_v2_4.md

export const PROSE_DNA_RUNTIME = `PROSE DNA v2.4 — 18 UNIVERSAL LAWS

R1 SHOW DON'T TELL: Never name emotions. Use physical sensation, observed detail, action under pressure, dialogue subtext. Cut everything after the emotional peak of any scene.

R2 DIALOGUE DRIVES: Every dialogue line does 2 of 3: reveal character, escalate tension, deliver information. Characters respond to what was said, not what was meant.

R3 SENTENCE ARCHITECTURE: Sentence length = emotional instrument. Under pressure: max 8 words. False security: long multi-clause. Revelation sequence: long → short → very short.

R4 INTERIORITY WITHOUT EXPLANATION: No "she realized/understood [self-insight]". No accurate self-diagnosis before the revelation chapter. Interiority through observation and physical response only.

R5 ONE SCENE ONE JOB: State purpose before generating: "This scene must [verb] [what] so that [reader result]." If you cannot state it, the scene is not ready.

R6 ENVIRONMENT AS EMOTION: Every environmental detail mirrors, contrasts, or ironically comments on the character's internal state in this moment. No neutral description.

R6A SPECIFICITY TEST: Could this detail appear in any book about this setting? If yes, replace it with something only this character in this moment would notice.

R7 FIVE HOOK TYPES: Every chapter ends on exactly one: REVELATION / THREAT / DECISION / THE LIE / NEW QUESTION. No exceptions.

R8 CHAPTER PRESSURE: Every chapter contains one pressure moment + one clock beat + one hook. In Act 2, at least one clock must be visibly ticking.

R9 DIALOGUE SUBTEXT: Surface meaning and subtext run simultaneously. Subtext must be traceable on reread. If a reader cannot detect it on second pass, there is no subtext.

R10 FORBIDDEN WORDS: Enforced by code post-generation. Do not self-censor or avoid words preemptively. Write naturally; the checker handles enforcement.

R11 THE CUT TEST: If cutting a sentence loses the reader nothing, cut it. Eliminate all transitional padding.

R12 CHAPTER OPENING DOCTRINE: First sentence must do one of: drop mid-action, state a thought requiring prior context, establish a loaded sensory detail, or create a contradiction. Never: orientation sentences, weather openers, re-introducing established characters. PROXIMITY TENSION CLAUSE: When tension_score_target >= 7, establish forward movement imperative within first 150 words — character needs X + visible clock/cost. Atmosphere alone insufficient at high tension. Exempt: false-calm (1-4), decompression, introspective by design.

R14 SENSORY SPECIFICITY: Minimum two non-visual senses per scene. Under dread, sensory details should be slightly wrong — familiar textures, sounds, or smells with one element off.

R15 SIGNIFICANT OMISSION: What the narrator does not describe is load-bearing. Suppressed evidence must be visibly not-looked-at — the reader should feel the gap.

R16 SCENE-ENTRY MICRO-MYSTERY: Open a narrative loop in the first 500 words. This loop must close before the chapter hook fires.

R17 REVELATION ARCHITECTURE: Three mandatory components: (1) one clean truth sentence, (2) minimum two backward flashes with specific chapter references, (3) immediate emotional cost expressed through physical sensation — never named emotion.

R18 CHARACTER ENTRY DOCTRINE: First appearance of any named character = decision/action BEFORE description or interiority. Decision must carry inferential weight — reader draws conclusions without explanation. BANNED: appearance-first, atmosphere-first, interiority-first (unless withheld decision), generic action (no inferential value). PROTAGONIST: entry decision must hint at wound, mistaken belief, or contradiction. SECONDARY CHARACTERS: first dialogue line carries same inferential weight as action entry. TEST: First action alone → can reader infer who this person is? No = rewrite. PROTAGONIST TEST: Is wound/belief/contradiction traceable? R12 BRIDGE: Character entry at chapter opening → R12 + R18 fire simultaneously; mid-action physical detail (R12 Type 1) satisfies both.`;

// RULE 18 — CHARACTER ENTRY DOCTRINE (v2.4)
// First appearance = decision/action before any description or interiority.
// Decision must carry inferential weight — reader draws conclusions without explanation.
// PROTAGONIST: entry decision must hint at wound, mistaken belief, or contradiction.
// SECONDARY: first dialogue line carries same weight as action entry.
// BANNED: appearance-first, atmosphere-first, generic action (no inferential value).
// TEST: First action alone → can reader infer who this person is? No = rewrite.
// PROTAGONIST TEST: Is wound/belief/contradiction traceable in the entry decision?
// R12 BRIDGE: Character entry at chapter opening → R12 + R18 fire simultaneously.
//   Mid-action physical detail (R12 Type 1) is highest-leverage entry — satisfies both.
export const R18_CHARACTER_ENTRY = {
  rule: 18,
  name: 'CHARACTER_ENTRY_DOCTRINE',
  version: '2.4',
  applies_to: 'all_named_characters_first_appearance',
  exemptions: ['unnamed_background_figures', 'dialogue_only_characters_first_line_governs'],
  entry_order: ['DECISION_OR_ACTION', 'INTERIORITY_IF_WITHHELD_DECISION', 'DESCRIPTION_IF_IT_SHARPENS'],
  banned: [
    'APPEARANCE_FIRST',
    'ATMOSPHERE_FIRST',
    'INTERIORITY_FIRST_WITHOUT_WITHHELD_DECISION',
    'GENERIC_ACTION_NO_INFERENTIAL_VALUE'
  ],
  protagonist_secondary_test: 'entry_decision_hints_at_wound_OR_mistaken_belief_OR_contradiction',
  test: 'first_action_alone → reader_draws_specific_inference → yes=pass no=rewrite',
  r12_bridge: 'R12_TYPE_1_MID_ACTION_SATISFIES_BOTH_RULES_SIMULTANEOUSLY'
};

// RULE 12 PROXIMITY TENSION CLAUSE — S24B
export const R12_PROXIMITY_TENSION = {
  applies_when: 'tension_score_target >= 7',
  requirement: 'forward_movement_imperative_within_150_words',
  definition: 'character needs X + visible clock or cost threatening that need',
  test: 'reader_can_name_what_character_needs_AND_what_threatens_it_within_150_words',
  exemptions: ['false_calm_1_to_4', 'decompression', 'introspective_by_design']
};
