/**
 * Project Manager — S24
 * Create, load, switch, list, and archive projects.
 */

import { githubStorage } from "@/storage/githubStorage";
import { startSession, endSession } from "@/modules/sessionManager/sessionManager";

// ── Types ───────────────────────────────────────────────────────────────

export type ProjectStatus = "ACTIVE" | "COMPLETE" | "ARCHIVED";
export type GenreMode = "psychological_thriller" | "standard_thriller";

export interface Project {
  id: string;
  name: string;
  genre_mode: GenreMode;
  status: ProjectStatus;
  created_at: string;
  last_active: string;
  chapter_count: number;
  approved_chapter_count: number;
  current_chapter: number;
  series_id: string | null;
  estimated_cost_usd: number | null;
  actual_cost_usd: number | null;
}

export interface ProjectIndex {
  version: string;
  projects: Project[];
  updated_at: string;
}

// ── Paths ───────────────────────────────────────────────────────────────

const INDEX_PATH = "projects/index.json";

function projectConfigPath(projectId: string): string {
  return `story-data/${projectId}/project_config.json`;
}

// ── Index Operations ────────────────────────────────────────────────────

async function loadIndex(): Promise<ProjectIndex> {
  const raw = await githubStorage.loadFile(INDEX_PATH);
  if (!raw) {
    return { version: "1.0", projects: [], updated_at: new Date().toISOString() };
  }
  try {
    return JSON.parse(raw) as ProjectIndex;
  } catch {
    return { version: "1.0", projects: [], updated_at: new Date().toISOString() };
  }
}

async function saveIndex(index: ProjectIndex): Promise<void> {
  index.updated_at = new Date().toISOString();
  await githubStorage.saveFile(INDEX_PATH, JSON.stringify(index, null, 2));
}

// ── Helpers ─────────────────────────────────────────────────────────────

function generateProjectId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  const suffix = Date.now().toString(36).slice(-4);
  return `${slug}-${suffix}`;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Create a new project.
 */
export async function createProject(name: string, genreMode: GenreMode): Promise<Project> {
  const id = generateProjectId(name);
  const now = new Date().toISOString();

  const project: Project = {
    id,
    name,
    genre_mode: genreMode,
    status: "ACTIVE",
    created_at: now,
    last_active: now,
    chapter_count: 0,
    approved_chapter_count: 0,
    current_chapter: 0,
    series_id: null,
    estimated_cost_usd: null,
    actual_cost_usd: null,
  };

  // Save project config
  await githubStorage.saveFile(projectConfigPath(id), JSON.stringify(project, null, 2));

  // Initialize directory structure placeholders
  await githubStorage.saveFile(`story-data/${id}/.ghostly`, JSON.stringify({ initialized: true, created_at: now }));

  // Add to index
  const index = await loadIndex();
  index.projects.push(project);
  await saveIndex(index);

  return project;
}

/**
 * Load a project by ID.
 */
export async function loadProject(projectId: string): Promise<Project | null> {
  const raw = await githubStorage.loadFile(projectConfigPath(projectId));
  if (!raw) return null;
  try {
    const project = JSON.parse(raw) as Project;
    await startSession(projectId);
    return project;
  } catch {
    return null;
  }
}

/**
 * Switch from one project to another.
 */
export async function switchProject(fromId: string, toId: string): Promise<Project | null> {
  // Save current session
  await endSession(fromId);

  // Update last_active on the project we're leaving
  const index = await loadIndex();
  const fromProject = index.projects.find((p) => p.id === fromId);
  if (fromProject) {
    fromProject.last_active = new Date().toISOString();
    await saveIndex(index);
  }

  // Load new project
  return loadProject(toId);
}

/**
 * List all projects.
 */
export async function listProjects(): Promise<Project[]> {
  const index = await loadIndex();
  return index.projects.sort((a, b) => new Date(b.last_active).getTime() - new Date(a.last_active).getTime());
}

/**
 * Archive a project.
 */
export async function archiveProject(projectId: string): Promise<boolean> {
  const index = await loadIndex();
  const project = index.projects.find((p) => p.id === projectId);
  if (!project) return false;

  project.status = "ARCHIVED";
  project.last_active = new Date().toISOString();
  await saveIndex(index);

  // Update project config
  const raw = await githubStorage.loadFile(projectConfigPath(projectId));
  if (raw) {
    try {
      const config = JSON.parse(raw);
      config.status = "ARCHIVED";
      await githubStorage.saveFile(projectConfigPath(projectId), JSON.stringify(config, null, 2));
    } catch { /* ignore */ }
  }

  return true;
}

/**
 * Update project stats (chapter counts, cost, etc.)
 */
export async function updateProjectStats(
  projectId: string,
  updates: Partial<Pick<Project, "chapter_count" | "approved_chapter_count" | "current_chapter" | "actual_cost_usd">>,
): Promise<void> {
  const index = await loadIndex();
  const project = index.projects.find((p) => p.id === projectId);
  if (!project) return;

  Object.assign(project, updates);
  project.last_active = new Date().toISOString();
  await saveIndex(index);
}
