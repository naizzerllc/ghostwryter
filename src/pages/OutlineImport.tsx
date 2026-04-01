/**
 * Outline Import Page — 4-stage wizard: Upload → Validating → Diagnostic Report → Complete.
 * GHOSTLY v2.2 · 02C 4-stage import flow
 */

import { useState, useCallback } from "react";
import { importOutline, type OutlineImportResult } from "@/lib/outlineImporter";
import ImportStepper from "@/components/outlineImport/ImportStepper";
import ImportStageUpload from "@/components/outlineImport/ImportStageUpload";
import ImportStageValidating from "@/components/outlineImport/ImportStageValidating";
import ImportStageDiagnostic from "@/components/outlineImport/ImportStageDiagnostic";
import ImportStageComplete from "@/components/outlineImport/ImportStageComplete";

export type ImportStage = "upload" | "validating" | "diagnostic" | "complete";

const OutlineImport = () => {
  const [stage, setStage] = useState<ImportStage>("upload");
  const [jsonInput, setJsonInput] = useState("");
  const [projectId] = useState(() => `proj_${Date.now()}`);
  const [result, setResult] = useState<OutlineImportResult | null>(null);

  const handleImport = useCallback(() => {
    setStage("validating");

    // Simulate brief validation delay for UX, then run synchronous validation
    setTimeout(() => {
      const r = importOutline(jsonInput, projectId);
      setResult(r);
      setStage("diagnostic");
    }, 600);
  }, [jsonInput, projectId]);

  const handleProceed = useCallback(() => {
    setStage("complete");
  }, []);

  const handleRetry = useCallback(() => {
    setResult(null);
    setStage("upload");
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-wide">OUTLINE IMPORT</h1>
        <p className="text-xs text-muted-foreground font-mono mt-1">
          4-stage import · Schema v2.8 · Auto-populates CharacterDB · Creates voice corpus stubs
        </p>
      </div>

      {/* Stepper */}
      <ImportStepper currentStage={stage} />

      {/* Stage content */}
      {stage === "upload" && (
        <ImportStageUpload
          jsonInput={jsonInput}
          onJsonChange={setJsonInput}
          onImport={handleImport}
        />
      )}

      {stage === "validating" && <ImportStageValidating />}

      {stage === "diagnostic" && result && (
        <ImportStageDiagnostic
          result={result}
          onProceed={handleProceed}
          onRetry={handleRetry}
        />
      )}

      {stage === "complete" && result && (
        <ImportStageComplete
          result={result}
          projectId={projectId}
          rawJson={jsonInput}
        />
      )}
    </div>
  );
};

export default OutlineImport;
