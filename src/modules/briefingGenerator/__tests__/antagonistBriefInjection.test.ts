import { describe, it, expect, beforeEach } from "vitest";
import { addCharacter, removeCharacter, getAllCharacters } from "@/modules/characterDB/characterDB";
import { assembleBrief } from "@/modules/briefingGenerator/briefingGenerator";

describe("Antagonist architecture in brief", () => {
  const antId = "test_ant_001";
  const protId = "test_prot_001";

  beforeEach(() => {
    // Clean up any previous test characters
    for (const c of getAllCharacters()) {
      removeCharacter(c.id);
    }
  });

  it("injects antagonist 02C fields into Tier 1", () => {
    // Add protagonist
    addCharacter({
      id: protId, name: "Elena", role: "protagonist",
      wound: "trust betrayal", want: "escape", need: "self-forgiveness",
      self_deception: "I can handle this alone", fear: "intimacy",
      external_goal: "find the truth", internal_desire: "peace", goal_desire_gap: "truth will destroy peace",
      compressed_voice_dna: "clinical_detached_precise_measured_controlled_voice_pattern",
      voice_corpus_status: "PENDING", voice_reliability: "MISSING", corpus_approved: false,
      flaw: null,
      contradiction_matrix: {
        behavioural: { stated_belief: "I trust no one", actual_behaviour: "Keeps returning to Marcus", blind_spot: true },
        moral: { stated_principle: "Truth above all", collapse_condition: "When truth threatens her child", guilt_residue: null },
        historical: { past_action: "Left someone to die", self_narrative: "There was nothing I could do", gap: "She chose to leave" },
        competence: { exceptional_at: "Reading micro-expressions", humiliated_by: "Written communication", origin: null },
      },
    });

    // Add antagonist WITH 02C fields
    addCharacter({
      id: antId, name: "Dr. Marcus Vane", role: "antagonist",
      wound: "abandonment", want: "control", need: "love",
      self_deception: "I help people", fear: "powerlessness",
      external_goal: "expand practice", internal_desire: "validation", goal_desire_gap: "control ≠ validation",
      compressed_voice_dna: "authoritative_measured_warm_surface_cold_beneath_pattern",
      voice_corpus_status: "PENDING", voice_reliability: "MISSING", corpus_approved: false,
      flaw: null,
      mirror_relationship: "Both Elena and Marcus fear vulnerability — he weaponises it, she flees from it",
      threat_arc: "Escalates from charm to isolation to direct threat across acts",
      antagonist_self_deception: "Everything I do is for their own good",
      antagonist_limit: "Cannot tolerate being ignored — silence breaks him",
      antagonist_inversion_chapter: 28,
      antagonist_inversion_truth: "He was the abandoned child all along",
      contradiction_matrix: {
        behavioural: { stated_belief: "I care about my patients", actual_behaviour: "Isolates them", blind_spot: true },
        moral: { stated_principle: "Do no harm", collapse_condition: "When a patient leaves", guilt_residue: null },
        historical: { past_action: "Falsified records", self_narrative: "The system failed them", gap: null },
      },
    });

    const brief = assembleBrief(1, "test_project");
    const tier1 = brief.tiers.find(t => t.tier === 1);
    expect(tier1).toBeDefined();
    
    const content = tier1!.content;
    console.log("=== TIER 1 CONTENT ===");
    console.log(content);
    console.log("=== END ===");

    // Verify antagonist architecture block exists
    expect(content).toContain("ANTAGONIST ARCHITECTURE (02C)");
    expect(content).toContain("MIRROR:");
    expect(content).toContain("Both Elena and Marcus fear vulnerability");
    expect(content).toContain("THREAT ARC:");
    expect(content).toContain("Escalates from charm");
    expect(content).toContain("ANTAGONIST SELF-DECEPTION:");
    expect(content).toContain("LIMIT:");
    expect(content).toContain("INVERSION AT CH28");
    expect(content).toContain("He was the abandoned child all along");
  });

  it("omits antagonist architecture when fields are empty", () => {
    addCharacter({
      id: antId, name: "Generic Bad Guy", role: "antagonist",
      wound: "greed", want: "money", need: "meaning",
      self_deception: "I earned this", fear: "poverty",
      external_goal: "wealth", internal_desire: "respect", goal_desire_gap: "money ≠ respect",
      compressed_voice_dna: "flat_aggressive_blunt_direct_no_subtext_voice",
      voice_corpus_status: "PENDING", voice_reliability: "MISSING", corpus_approved: false,
      flaw: null,
      contradiction_matrix: {
        behavioural: { stated_belief: "I'm self-made", actual_behaviour: "Exploits others", blind_spot: false },
        moral: { stated_principle: "Survival of fittest", collapse_condition: "When his child is threatened", guilt_residue: null },
        historical: { past_action: "Betrayed partner", self_narrative: "He would have done the same", gap: null },
      },
    });

    const brief = assembleBrief(1, "test_project");
    const tier1 = brief.tiers.find(t => t.tier === 1);
    expect(tier1!.content).not.toContain("ANTAGONIST ARCHITECTURE (02C)");
  });
});
