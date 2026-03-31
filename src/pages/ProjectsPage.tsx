import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  listProjects,
  createProject,
  archiveProject,
  type Project,
  type GenreMode,
} from "@/modules/projectManager/projectManager";
import { estimateProjectCost, type CostEstimate } from "@/modules/costEstimator/costEstimator";
import { listSeries } from "@/modules/trilogyManager/trilogyManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Archive, FolderOpen, DollarSign, BookOpen } from "lucide-react";

// ── Create Project Dialog ───────────────────────────────────────────────

function CreateProjectDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, genre: GenreMode) => void;
}) {
  const [name, setName] = useState("");
  const [genre, setGenre] = useState<GenreMode>("psychological_thriller");
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);

  useEffect(() => {
    if (name) {
      setEstimate(estimateProjectCost(30)); // default 30 chapter estimate
    }
  }, [name]);

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), genre);
    setName("");
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create New Project</AlertDialogTitle>
          <AlertDialogDescription>Set up a new novel project for the Leila Rex brand.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 py-2">
          <Input
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select value={genre} onValueChange={(v) => setGenre(v as GenreMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="psychological_thriller">Psychological Thriller</SelectItem>
              <SelectItem value="standard_thriller">Standard Thriller</SelectItem>
            </SelectContent>
          </Select>
          {estimate && (
            <div className="bg-muted/30 border border-border p-3 text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. cost (30 chapters)</span>
                <span className="text-foreground">${estimate.estimated_total_usd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Per chapter avg</span>
                <span className="text-foreground">${estimate.per_chapter_average.toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Anthropic</span>
                <span>${estimate.by_provider.anthropic.toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Google</span>
                <span>${estimate.by_provider.google.toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>OpenAI</span>
                <span>${estimate.by_provider.openai.toFixed(4)}</span>
              </div>
            </div>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleCreate} disabled={!name.trim()}>
            <Plus className="w-4 h-4 mr-1" />
            Create Project
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Project Card ────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onOpen,
  onArchive,
}: {
  project: Project;
  onOpen: () => void;
  onArchive: () => void;
}) {
  const statusColor =
    project.status === "ACTIVE"
      ? "text-green-500 border-green-500/30"
      : project.status === "COMPLETE"
        ? "text-blue-500 border-blue-500/30"
        : "text-muted-foreground border-border";

  const lastActive = new Date(project.last_active);
  const progress =
    project.chapter_count > 0
      ? `${project.approved_chapter_count}/${project.chapter_count}`
      : "0 chapters";

  return (
    <div className="border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{project.name}</h3>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
            {project.genre_mode.replace("_", " ")}
          </p>
        </div>
        <Badge variant="outline" className={`text-[10px] font-mono ${statusColor}`}>
          {project.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div>
          <span className="text-muted-foreground">Progress</span>
          <p className="text-foreground">{progress}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Last active</span>
          <p className="text-foreground">{lastActive.toLocaleDateString("en-GB")}</p>
        </div>
        {project.actual_cost_usd !== null && (
          <div>
            <span className="text-muted-foreground">Cost</span>
            <p className="text-foreground">${project.actual_cost_usd.toFixed(2)}</p>
          </div>
        )}
        {project.estimated_cost_usd !== null && (
          <div>
            <span className="text-muted-foreground">Est. cost</span>
            <p className="text-foreground">${project.estimated_cost_usd.toFixed(2)}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        {project.status !== "ARCHIVED" && (
          <>
            <Button size="sm" variant="outline" onClick={onOpen} className="flex-1">
              <FolderOpen className="w-3.5 h-3.5 mr-1" />
              Open
            </Button>
            <Button size="sm" variant="ghost" onClick={onArchive}>
              <Archive className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────

const ProjectsPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);
  const [seriesCount, setSeriesCount] = useState(0);

  const refresh = useCallback(async () => {
    const [p, s] = await Promise.all([listProjects(), listSeries()]);
    setProjects(p);
    setSeriesCount(s.length);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = async (name: string, genre: GenreMode) => {
    try {
      await createProject(name, genre);
      toast.success(`Project "${name}" created`);
      refresh();
      navigate("/dna-intake");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    const ok = await archiveProject(archiveTarget);
    if (ok) {
      toast.success("Project archived");
    } else {
      toast.error("Archive failed");
    }
    setArchiveTarget(null);
    refresh();
  };

  const handleOpen = (projectId: string) => {
    // In production this would call loadProject + switchProject
    toast.success(`Loaded project ${projectId}`);
    navigate("/generate");
  };

  const activeProjects = projects.filter((p) => p.status === "ACTIVE");
  const archivedProjects = projects.filter((p) => p.status === "ARCHIVED");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-wide">Projects</h1>
        <div className="flex items-center gap-3">
          {seriesCount > 0 && (
            <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              {seriesCount} series
            </span>
          )}
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" />
            New Project
          </Button>
        </div>
      </div>

      {activeProjects.length === 0 && archivedProjects.length === 0 && (
        <div className="border border-border bg-card p-12 text-center space-y-3">
          <DollarSign className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground font-mono">No projects yet</p>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Create your first project
          </Button>
        </div>
      )}

      {activeProjects.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Active Projects</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeProjects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => handleOpen(p.id)}
                onArchive={() => setArchiveTarget(p.id)}
              />
            ))}
          </div>
        </div>
      )}

      {archivedProjects.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Archived</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {archivedProjects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => handleOpen(p.id)}
                onArchive={() => setArchiveTarget(p.id)}
              />
            ))}
          </div>
        </div>
      )}

      <CreateProjectDialog open={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />

      {/* Archive confirmation */}
      <AlertDialog open={archiveTarget !== null} onOpenChange={() => setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this project?</AlertDialogTitle>
            <AlertDialogDescription>
              The project will be moved to archived status. You can still access its data but it will no longer appear in the active list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>
              <Archive className="w-4 h-4 mr-1" />
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectsPage;
