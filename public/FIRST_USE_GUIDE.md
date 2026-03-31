# GHOSTLY — First Use Guide

GHOSTLY is a professional AI fiction production platform that generates publication-ready novels under the Leila Rex brand identity. It orchestrates multiple LLM providers, enforces craft rules, and maintains voice consistency at catalogue scale.

---

## First-Use Sequence

Follow these steps in order for your first book:

### Step 1: Configure API Keys
Go to **Settings → API Keys**. Enter your API keys for:
- Anthropic (Claude) — protagonist generation
- Google AI (Gemini) — antagonist/supporting generation, quality analysis
- OpenAI (GPT-4o) — reader simulation

All three providers are required for full pipeline operation.

### Step 2: Connect GitHub
Go to **Settings → GitHub**. Enter your GitHub token and username, then click **Test Connection**. GHOSTLY stores all project data (outlines, chapters, memory) in a GitHub repository called `ghostly-data`.

### Step 3: Generate Your Outline
Open a separate Claude session and run the V6 outline prompt to generate your book outline. This produces a structured JSON outline that GHOSTLY will import. The outline prompt is not built into the platform — it runs externally.

### Step 4: Complete the Book DNA Intake
Go to **DNA Intake** (or start a new project). Answer the guided questions about your book's premise, protagonist, antagonist, twist architecture, and thematic core. This produces the generation brief that shapes every chapter.

### Step 5: Import Your V6 Outline
Go to **Outline Import** and paste your V6 outline JSON. The diagnostic tool will validate schema version, check for missing fields, and flag any issues before import.

### Step 6: Author Voice Corpus Exchanges
Go to **Characters → [Character] → Add Voice Exchange**. Write 3–5 sample dialogue exchanges for each major character. These exchanges train the voice distinctiveness gate and ensure each character sounds different from the protagonist.

### Step 7: Run the Voice Corpus Quality Gate
For each major character, run the Voice Corpus Quality Gate. Characters must score ≥16/20 (PASSED) or ≥12/20 (CONDITIONAL) to be cleared for generation. Characters below 12 are blocked from generation until their corpus is improved.

### Step 8: Generate Chapter 1
Go to **Generate** and generate your first chapter. The pipeline will: assemble the briefing → generate via Claude → check forbidden words → run the quality pipeline (6 modules) → present for human review.

### Step 9: Complete the First Chapter Calibration Gate
After approving Chapter 1, complete the Calibration Gate before generating Chapter 2. This confirms the voice baseline and sets the quality anchor for the rest of the book.

---

## Troubleshooting

- **Generation fails or times out:** Check the **Manuscript Health** dashboard for failure log entries. Most failures are API key issues or provider outages — the platform will suggest recovery actions.
- **Quality scores seem wrong:** After 5 chapters, run **Module Weight Calibration** from Settings. Rate the chapters yourself and the system will detect any module bias and suggest weight adjustments.
- **GitHub connection lost:** The platform will show a persistent disconnection banner. Generation pauses automatically. Reconnect via Settings → GitHub → Test Connection, then resume.

---

## Where to Find Help

Report issues and request features at the project's GitHub Issues page. Include the platform version (shown in Settings → Platform Info) and any error messages from the Health dashboard.

---

*GHOSTLY v2.2.0 · Leila Rex brand platform*
