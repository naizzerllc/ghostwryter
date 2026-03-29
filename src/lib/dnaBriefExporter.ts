/**
 * DNA Brief Exporter — exports structured JSON + formatted markdown.
 * GHOSTLY v2.2 · Session 7
 */

import { githubStorage } from "@/storage/githubStorage";
import { DNA_QUESTIONS } from "@/lib/dnaExtraction";
import type { DnaAnswer, DnaBrief } from "@/types/dna";

export async function exportDnaBrief(
  projectId: string,
  projectTitle: string,
  answers: DnaAnswer[],
  activeConstraints: string[],
): Promise<{ jsonPath: string; mdPath: string }> {
  const now = new Date().toISOString();

  const openQuestions = answers
    .filter((a) => a.status === "GAP")
    .map((a) => {
      const q = DNA_QUESTIONS.find((q) => q.id === a.question_id);
      return q?.label || a.question_id;
    });

  const brief: DnaBrief = {
    project_id: projectId,
    project_title: projectTitle,
    answers,
    active_constraints: activeConstraints,
    open_questions: openQuestions,
    exported_at: now,
  };

  // Save JSON
  const jsonPath = `story-data/${projectId}/dna_brief.json`;
  await githubStorage.saveFile(jsonPath, JSON.stringify(brief, null, 2));

  // Build markdown
  const md = buildMarkdownExport(brief);
  const mdPath = `story-data/${projectId}/dna_brief_export.md`;
  await githubStorage.saveFile(mdPath, md);

  return { jsonPath, mdPath };
}

function buildMarkdownExport(brief: DnaBrief): string {
  const date = new Date(brief.exported_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const lines: string[] = [
    `# LEILA REX — DNA BRIEF — ${brief.project_title.toUpperCase()} — ${date}`,
    "",
    "---",
    "",
  ];

  // Group answers by phase
  const phases = ["character", "world", "structure", "voice"] as const;
  for (const phase of phases) {
    const phaseQuestions = DNA_QUESTIONS.filter((q) => q.phase === phase);
    lines.push(`## ${phase.charAt(0).toUpperCase() + phase.slice(1)}`);
    lines.push("");

    for (const q of phaseQuestions) {
      const answer = brief.answers.find((a) => a.question_id === q.id);
      if (!answer || answer.status === "SKIPPED") continue;

      const badge = answer.status === "FOUND" ? "✅" : "⚠️ GAP";
      lines.push(`### ${q.label} ${badge}`);
      if (answer.answer) {
        lines.push("");
        lines.push(answer.answer);
      } else {
        lines.push("");
        lines.push("*Not yet answered*");
      }
      lines.push("");
    }
  }

  // Active constraints
  lines.push("---");
  lines.push("");
  lines.push("## Active Brand Constraints");
  lines.push("");
  for (const c of brief.active_constraints) {
    lines.push(`- ${c}`);
  }
  lines.push("");

  // Open questions
  if (brief.open_questions.length > 0) {
    lines.push("## Open Questions");
    lines.push("");
    for (const q of brief.open_questions) {
      lines.push(`- ⚠️ ${q}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(
    "*Paste this at the start of your V6 outline session before Section 0.*",
  );

  return lines.join("\n");
}
