/**
 * DNA Config Storage — saves/loads per-project DNA config via GitHub storage.
 * GHOSTLY v2.2 · Session 6
 */

import { githubStorage } from "@/storage/githubStorage";
import type { ProjectDnaConfig, BrandDnaConfig } from "@/types/dna";
import BRAND_DNA_CONFIG from "@/constants/BRAND_DNA_CONFIG.json";

function configPath(projectId: string): string {
  return `story-data/${projectId}/project_dna_config.json`;
}

export function getBrandDnaConfig(): BrandDnaConfig {
  return BRAND_DNA_CONFIG as BrandDnaConfig;
}

export function createDefaultProjectDnaConfig(projectId: string): ProjectDnaConfig {
  const brand = getBrandDnaConfig();
  return {
    project_id: projectId,
    active_permanent_tropes: brand.permanent_tropes
      .filter(t => t.enabled_default)
      .map(t => t.id),
    active_rotating_tropes: brand.rotating_tropes
      .filter(t => t.enabled_default && t.status !== "RESERVED")
      .map(t => t.id),
    constraint_overrides: [],
    brand_deviation: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function loadProjectDnaConfig(
  projectId: string,
): Promise<ProjectDnaConfig> {
  const raw = await githubStorage.loadFile(configPath(projectId));
  if (raw) {
    try {
      return JSON.parse(raw) as ProjectDnaConfig;
    } catch {
      // corrupt — return default
    }
  }
  return createDefaultProjectDnaConfig(projectId);
}

export async function saveProjectDnaConfig(
  config: ProjectDnaConfig,
): Promise<void> {
  config.updated_at = new Date().toISOString();
  await githubStorage.saveFile(
    configPath(config.project_id),
    JSON.stringify(config, null, 2),
  );
}
