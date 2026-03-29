/**
 * Idea Bank Storage — stores fragments captured during DNA extraction.
 * GHOSTLY v2.2 · Session 7
 */

import { githubStorage } from "@/storage/githubStorage";
import type { IdeaBank, IdeaBankEntry, SavedFragment } from "@/types/dna";

const IDEA_BANK_PATH = "catalogue/IDEA_BANK.json";

export async function loadIdeaBank(): Promise<IdeaBank> {
  const raw = await githubStorage.loadFile(IDEA_BANK_PATH);
  if (raw) {
    try {
      return JSON.parse(raw) as IdeaBank;
    } catch {
      // corrupt
    }
  }
  return {
    version: "1.0",
    entries: [],
    updated_at: new Date().toISOString(),
  };
}

export async function appendFragments(
  fragments: SavedFragment[],
): Promise<IdeaBank> {
  const bank = await loadIdeaBank();

  for (const f of fragments) {
    const entry: IdeaBankEntry = {
      id: `idea_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: f.text,
      possible_use: f.possible_use,
      status: f.status,
      source_project_id: f.source_project_id,
      captured_at: f.captured_at,
    };
    bank.entries.push(entry);
  }

  bank.updated_at = new Date().toISOString();
  await githubStorage.saveFile(IDEA_BANK_PATH, JSON.stringify(bank, null, 2));
  return bank;
}

export async function updateEntryStatus(
  entryId: string,
  status: "AVAILABLE" | "USED" | "DISCARDED",
): Promise<void> {
  const bank = await loadIdeaBank();
  const entry = bank.entries.find((e) => e.id === entryId);
  if (entry) {
    entry.status = status;
    bank.updated_at = new Date().toISOString();
    await githubStorage.saveFile(IDEA_BANK_PATH, JSON.stringify(bank, null, 2));
  }
}
