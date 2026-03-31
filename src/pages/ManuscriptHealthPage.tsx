/**
 * Full Manuscript Health Dashboard — Consolidated real-time view of all health signals.
 * GHOSTLY v2.2 · Session 27
 *
 * 4 rows × 3–4 panels. All data derived from stored data — no blocking API calls on load.
 */

import { useManuscriptHealthData } from "@/hooks/useManuscriptHealthData";
import GenerationHealthRow from "@/components/health/GenerationHealthRow";
import StructuralHealthRow from "@/components/health/StructuralHealthRow";
import VoiceHealthRow from "@/components/health/VoiceHealthRow";
import ProjectHealthRow from "@/components/health/ProjectHealthRow";

export default function ManuscriptHealthPage() {
  const { analytics, costSummary, mei, subplots, rollercoaster, antiAI, tells, warmth, failures, memoryCore, github } = useManuscriptHealthData();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-wide">Manuscript Health</h1>
      <GenerationHealthRow analytics={analytics} />
      <StructuralHealthRow mei={mei} subplots={subplots} rollercoaster={rollercoaster} />
      <VoiceHealthRow tells={tells} antiAI={antiAI} warmth={warmth} />
      <ProjectHealthRow failures={failures} memoryCore={memoryCore} github={github} costSummary={costSummary} />
    </div>
  );
}
