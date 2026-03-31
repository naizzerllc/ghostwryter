# PROSE DNA — GHOSTLY
Version 2.4 | Hardcoded Universal Craft Laws | Immovable | 18 Rules

**Changelog from v2.3:**
- Rule 18 (NEW): Character Entry Doctrine — first appearance via decision, not description

---

### R1 — Show Don't Tell
Emotion never named. Physical sensation, observed detail, action under pressure, dialogue subtext. Emotional restraint: scene peaks before emotion described — cut everything after the peak.

### R2 — Dialogue Drives, Description Serves
Every line does 2 of 3: reveal character / escalate tension / deliver information. Characters respond to what was SAID, not what was meant.

### R3 — Sentence Architecture Is Emotional Architecture
Under pressure: max 8 words. False security: long multi-clause. Revelation: long → short → very short.

### R4 — Interiority Without Explanation
No "[narrator] realized/understood [self-insight]". No accurate self-diagnosis before revelation_chapter.

### R5 — One Scene One Job
State purpose before generating: "This scene must [verb] [what] so that [reader result]." Cannot state it = not ready.

### R6 — Environment as Emotional State
Every detail mirrors, contrasts, or ironically comments on the character's internal state right now.

### R6A — Specificity Test
Could this detail appear in any book about this setting? Yes = replace it.

### R7 — Five Hook Types Mandatory
REVELATION / THREAT / DECISION / THE LIE / NEW QUESTION.

### R8 — Chapter Pressure Architecture
Every chapter: one pressure moment + one clock beat + one hook. Act 2: at least one clock visibly ticking.

### R9 — Dialogue Subtext Is Architecture
Surface + subtext run simultaneously. Subtext traceable on reread. Undetectable = no subtext.

### R10 — Forbidden Words: Code-Enforced Only
Enforced by forbiddenWordsChecker.js post-generation only. Never self-enforce via LLM instruction.

### R11 — The Cut Test
Cut sentence if reader loses nothing. Eliminates transitional padding.

### R12 — Chapter Opening Doctrine
First sentence must do one of four: drop mid-action, state a thought needing prior context, establish loaded sensory detail, or create a contradiction. Banned: orientation sentences, weather openers, re-introducing established characters.

PROXIMITY TENSION CLAUSE (high-tension chapters):
When tension_score_target ≥ 7: the chapter opening must establish a forward
movement imperative — the gap between where the character is and where they
need to be — within the first 150 words. Atmosphere, sensory loading, and
micro-mystery alone do not satisfy this clause at high tension. The character
must need something, right now, with a visible clock or cost attached. This
imperative does not need to be stated explicitly. It must be felt. The reader's
body should lean forward, not settle back.

TEST: Within the first 150 words of a tension_score_target ≥ 7 chapter —
can the reader name what the character needs and what threatens that need?
Yes = proximity tension present. No = the opening may be atmospheric without
being urgent. Revise to add the imperative.

This clause does not apply to: false-calm chapters (tension_score_target 1–4),
decompression chapters, or introspective chapters where stillness is the
architectural intent. It applies without exception to crisis, revelation, and
standard chapters at tension_score_target 7–10.

### R14 — Sensory Specificity
Minimum two non-visual senses per scene. Under dread: sensory details are slightly wrong.

### R15 — Significant Omission
What narrator doesn't describe is load-bearing. Suppressed evidence must be visibly not-looked-at.

### R16 — Scene-Entry Micro-Mystery
Open loop in first 500 words. Loop must close before chapter hook fires.

### R17 — Revelation Scene Architecture
Mandatory: (1) clean truth sentence, (2) backward flash ×2 minimum with chapter refs, (3) immediate emotional cost via physical sensation — no named emotion.

---

## RULE 18 — CHARACTER ENTRY DOCTRINE (v2.4 — NEW)

The first appearance of any POV character or any character with a
named role must introduce them through a choice or decision before
any physical description, atmospheric observation, or interiority.

The decision reveals. The description follows — only if it sharpens
what the decision already established.

THE PRINCIPLE:
Our brains do not connect with people through physical description.
We connect through action and choice. Character inference — drawing
conclusions about who someone is from what they do — is the mechanism
by which readers form bonds faster than any external description can
create them. An action or decision tells the reader who this person is
before the writer has to say it. This is not show-don't-tell. This is
a specific entry architecture.

For the Leila Rex clinical-dissociative narrator specifically: her first
appearance must show her doing something — making a choice, performing an
action, executing a decision — that is interpretable without explanation.
The reader infers her from her behaviour before they are given her thoughts
about herself. This matters because an unreliable narrator who appears first
through interiority gives the reader no anchor outside the narrator's own
account. A narrator who appears first through action gives the reader
evidence to hold onto when the account starts to fray.

THE DECISION MUST:
- Be specific and small — not a grand dramatic gesture, a particular
  choice that reveals through its particularity
- Carry inferential weight — the reader should be able to draw a
  conclusion about the character from this decision alone
- Be interpretable without explanation — the narrative does not explain
  the decision; the reader makes the inference
- If the character is the protagonist: hint at the wound, the mistaken
  belief, or the contradiction — not all three, not explicitly, but
  the decision should be in tension with something

EXAMPLES OF COMPLIANT ENTRY:

CORRECT — protagonist:
"She folded the letter twice before she opened it."
(Inference available: she is delaying, controlling herself, afraid of
what it contains. No description. No interiority. Action first.)

CORRECT — secondary character:
"The detective picked up the photograph by its edge, not its face."
(Inference available: experienced, deliberate, someone who handles
evidence rather than reacts to it. Physical description can follow
now that the reader has a frame for it.)

CORRECT — antagonist:
"He waited until she had taken the first sip before he told her."
(Inference available: patient, calculating, finds satisfaction in
sequencing. The reader registers this before they know his name.)

BANNED ENTRY CONSTRUCTIONS — automatic revision triggered:

- Appearance-first entry: any character whose introduction begins
  with physical attributes (height, hair, eyes, clothing) before any
  action or choice. Physical appearance has no inferential value without
  prior action to frame it.

- Atmosphere-first entry: any character who appears through what they
  observe, feel, or notice before they have done anything. Noticing is
  not doing. Sensation is not choice.

- Interiority-first entry (protagonist): the narrator reflecting on
  herself before performing any action. Exception: the narrator's
  interiority may open a chapter if the interiority is itself a withheld
  decision — i.e., the narrator is aware of a choice she is about to make
  or has just made but has not yet disclosed. This is an UNEXPLAINED
  ACTION micro-mystery (Rule 16) and compliant when the decision is
  withheld, not when the reflection is substituted for action.

- Generic action entry: an action so expected that it carries no
  inferential weight. "She poured herself a cup of coffee" reveals
  nothing. "She poured herself a cup of coffee and then poured it down
  the sink" reveals something.

THE SECONDARY CHARACTER RULE:
All named characters with a role in the plot are governed by this rule.
Unnamed background figures (crowds, passing strangers) are exempt.
Characters who appear only through dialogue without physical entrance
are exempt — but their first spoken line must carry the same inferential
weight as an action entry.

RELATIONSHIP TO RULE 12 (CHAPTER OPENING DOCTRINE):
When a character's first appearance is also a chapter opening, Rules 12
and 18 operate simultaneously. The chapter opening doctrine governs the
first sentence. The character entry doctrine governs what that first
sentence does. A first sentence that drops into a character's specific
mid-action physical detail (R12 Type 1) is the highest-leverage entry
for a new character — it satisfies both rules in one move.

THE TEST:
Read only the first sentence or action of a character's introduction.
Could the reader draw at least one specific inference about who this
person is from that action alone — without reading anything else?
Yes = compliant. No = rewrite.

THE SECONDARY TEST (protagonist only):
Does the protagonist's first action hint at the wound, the mistaken belief,
or the contradiction that will drive the narrative? If none of these is
traceable in the entry decision, the entry decision is not specific enough.
Choose a different action.

---

## RUNTIME NOTES

This document is the reference specification. The compressed runtime
(~800 tokens, PROSE_DNA_RUNTIME.js) is derived from it and updated
whenever this document advances version. The runtime must be regenerated
whenever a new rule is added or an existing rule is materially changed.

v2.4 runtime additions required:
- R18: Add Character Entry Doctrine (compressed — focus on the test,
  the banned constructions, and the protagonist secondary test)

v2.3 runtime additions (already complete):
- R1: Emotional Restraint sub-note (compressed)
- R3: Rhythm-to-tension mapping table (compressed to key values only)
- R14: Sensory selection psychological targeting (compressed)
- R16: Scene-Entry Micro-Mystery (full)
- R17: Revelation Scene Architecture (full)

---

*PROSE_DNA.md | v2.4 | 18 rules | GHOSTLY platform constant*
*Injection scope: generation_protagonist + anti_ai_detection_secondary ONLY*
