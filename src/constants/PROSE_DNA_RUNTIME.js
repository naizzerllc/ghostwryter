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

// ── TELL SUPPRESSION BLOCK — GAP2 ──────────────────────────────────────
// ~400 tokens. Injected into generation_protagonist and anti_ai_detection_secondary
// static (cached) system prompt blocks. Suppresses Tell 1 (over-explained interiority)
// and Tell 2 (manufactured specificity) at generation time.
// Complementary to Anti-AI Detector post-generation detection — does NOT replace it.

export const TELL_SUPPRESSION_BLOCK = `
## GENERATION SUPPRESSION — ACTIVE

Before writing any word of this chapter, read these two suppression instructions.
They describe the two most common failure modes of AI-generated psychological thriller
prose. Both are invisible to the writer while generating. Both are audible to a
human editor on first read.

---

### SUPPRESSION 1 — THE NARRATOR DOES NOT KNOW HER OWN MECHANISMS

The narrator is unreliable. Her unreliability is not a narrative device she manages
consciously — it is the way she genuinely experiences herself. She does not know she
is avoiding something. She does not know she is lying to herself. She does not know
why she picked up the phone and put it down again.

BANNED — the narrator accurately naming her own psychology:
- "I know I'm doing this because..."
- "Part of me knows he's lying."
- "I realize I've been avoiding..."
- "Something in me doesn't want to push this."
- Any sentence where she correctly identifies her own defence mechanism.

The test: Is the narrator observing herself accurately? If yes — she has become
reliable. The self-deception engine is off. Rewrite.

CORRECT: She picked up the phone. Put it down. Picked it up again. The coffee
was getting cold.
(The reader sees the loop. The narrator reports the actions. She does not name the loop.)

INCORRECT: Part of me knows I should call him back. The other part isn't ready.
(The narrator has accurately diagnosed her own ambivalence. The self-deception is gone.)

The narrator notices. She does not interpret. She records physical events and sensory
details. She does not know what they mean about her. The reader does.

---

### SUPPRESSION 2 — DETAILS ARE CHOSEN, NOT PLACED

Every sensory and environmental detail in this chapter must earn its place by being
chosen — not by being the correct detail for this type of scene, but by being the
detail this specific narrator notices at this specific moment of pressure.

THE TEST FOR EVERY DETAIL: Why does she notice this? Not "why would a person notice
this" — why does SHE notice this, given what she is concealing, what she is afraid of,
what she is managing, right now?

BANNED — the contextually inert specific:
- A detail that is vivid and accurate but would be equally plausible in any version
  of this scene.
- Three or more consecutive descriptive sentences that could be reordered without
  changing the emotional function of the scene.
- Environmental detail that serves atmosphere rather than character state.

The test: Remove the detail. Does the reader lose something about this narrator at
this moment? If no — remove it.

CORRECT: The handwriting on the envelope was his. I knew it before I looked at the
name. I'd spent three years learning not to recognise it.
(The detail is what she notices AND tells us what she has been doing for three years.
It is character-filtered at a pressure-specific level. It could only be this detail,
for this narrator, here.)

INCORRECT: The afternoon light came through the kitchen window at a low angle,
catching the dust on the counter. The coffee maker beeped three times.
(Vivid. Accurate. Inert. Interchangeable with any other scene in any other kitchen.
Serves atmosphere. Tells us nothing about this narrator at this moment.)

Before writing any environmental or sensory detail, ask: why does SHE notice this?
If the answer is "because it is here" — find a different detail, or remove it.

---

These two suppressions are not stylistic preferences. They are the difference between
prose that reads as generated and prose that reads as written. Both are invisible
during generation and audible on first read. Apply both. To every sentence.
`;

export const TELL_SUPPRESSION_CONFIG = {
  version: '1.0',
  active: true,
  suppressed_tells: ['tell_1_over_explained_interiority', 'tell_2_manufactured_specificity'],
  injection_scope: ['generation_protagonist', 'anti_ai_detection_secondary'],
  note: 'Suppression block is static — cached in system prompt. Does not replace Anti-AI Detector post-generation detection. Complementary systems.'
};
