/**
 * Review Page — Human review interface for generated chapters.
 * GHOSTLY v2.2 · Session 18
 */

import { useState } from "react";
import { resolveModelString } from "@/api/llmRouter";
import HumanReview from "@/components/review/HumanReview";
import type { FlagType } from "@/components/review/HumanReview";
import ManuscriptHealthDashboard from "@/components/review/ManuscriptHealthDashboard";
import CalibrationGate from "@/components/review/CalibrationGate";
import type { CalibrationResult } from "@/components/review/CalibrationGate";
import type { ApprovedChapterRecord } from "@/modules/generation/chapterPipeline";
import type { ChapterHealth } from "@/components/review/ManuscriptHealthDashboard";

// ── Demo data for render verification ───────────────────────────────────

const DEMO_PROSE = `The hallway smells of lemon cleaner and something underneath it — something metallic that my brain files under "wrong" before I can examine it closer.

I press my back against the wall. The plaster is cool through my shirt.

"You're early," Dr. Ashford says from inside the office, though I haven't knocked. The door is open exactly three inches. I counted.

"You said four o'clock."

"I said four-fifteen." A pause. The scratch of pen on paper. "But come in."

The chair is positioned differently today. Closer to the window. I notice because I always notice — the distance between the arm and the radiator pipe, the angle relative to the desk corner. Three inches to the left. Maybe four.

She watches me catalogue the room. She always watches me do this.

"Something's different," I say, sitting.

"Is it?"`;

const DEMO_FORBIDDEN_RESULT = {
  violations: [
    { word: "noticed", tier: "hard_ban" as const, context: "narration" as const, location: "line 12", position: 245 },
  ],
  hardBanCount: 1,
  softBanCount: 0,
  dialogueExemptCount: 0,
  dialogueExemptCleared: 0,
  contextFlagCount: 0,
  cleanedText: DEMO_PROSE,
};

const DEMO_CHAPTERS: ChapterHealth[] = [
  { chapter_number: 1, tension_target: 6, tension_actual: 6.5, compulsion_score: 7.2, quality_override: false },
];

export default function Review() {
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [calibrationResult, setCalibrationResult] = useState<CalibrationResult | null>(null);

  const demoRecord: ApprovedChapterRecord = {
    chapter_number: 1,
    approved_draft: DEMO_PROSE,
    composite_score: null,
    human_editorial_override: false,
    override_note: null,
    emotional_state_at_chapter_end: null,
    generation_truncation_suspected: false,
    human_editorial_sign_off: { status: "PENDING", signed_by: null, signed_at: null, notes: null },
    model_used: resolveModelString("anthropic"),
    tokens_used: 1240,
    cache_read_tokens: 800,
    cache_write_tokens: 440,
    approved_at: new Date().toISOString(),
    editorial_annotation: null,
  };

  function handleApproved(record: ApprovedChapterRecord) {
    console.log("[Review] Chapter approved:", record.chapter_number, record.human_editorial_sign_off.status);
  }

  function handleFlagged(flagType: FlagType, notes: string) {
    console.log("[Review] Chapter flagged:", flagType, notes);
  }

  function handleCalibration(result: CalibrationResult) {
    setCalibrationResult(result);
    setCalibrationOpen(false);
    console.log("[Review] Calibration complete:", result);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-wide text-foreground">Human Review</h1>
        <button
          onClick={() => setCalibrationOpen(true)}
          className="text-xs font-mono text-muted-foreground hover:text-foreground underline"
        >
          Open Calibration Gate
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Review Panel */}
        <div className="lg:col-span-2">
          <HumanReview
            chapterNumber={1}
            projectId="demo"
            prose={DEMO_PROSE}
            scenePurpose="Establish protagonist's hypervigilance and relationship with therapist"
            compositeScore={null}
            moduleScores={{}}
            forbiddenWordResult={DEMO_FORBIDDEN_RESULT}
            boundaryViolations={[]}
            truncationSuspected={false}
            approvedRecord={demoRecord}
            qualityGateRejected={false}
            onApproved={handleApproved}
            onFlagged={handleFlagged}
            medicalFactCheckResult={null}
            medicalAdvisoryRequired={false}
            texturePassRecord={null}
            onMedicalClaimDecision={() => {}}
          />
        </div>

        {/* Sidebar: Health Dashboard */}
        <div>
          <ManuscriptHealthDashboard
            chapters={DEMO_CHAPTERS}
            twistIntegrityStatus="INTACT"
            nextStructuralAnchor="All-is-lost: Chapter 22"
            subplotThreads={[
              { id: "sp1", name: "Therapist's secret", status: "ACTIVE" },
              { id: "sp2", name: "Missing sister", status: "SEEDED" },
            ]}
            overrideCount={0}
          />

          {calibrationResult && (
            <div className="mt-4 border border-border bg-card p-3">
              <p className="text-xs font-mono text-muted-foreground">Calibration Note</p>
              <pre className="text-xs font-mono text-foreground mt-1 whitespace-pre-wrap">
                {calibrationResult.calibration_note}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Calibration Gate Modal */}
      {calibrationOpen && (
        <CalibrationGate
          pipelineScore={null}
          onCalibrationComplete={handleCalibration}
          onDismiss={() => setCalibrationOpen(false)}
        />
      )}
    </div>
  );
}
