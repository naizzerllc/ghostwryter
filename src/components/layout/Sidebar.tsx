import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  PenTool,
  CheckCircle,
  Archive,
  FileEdit,
  BarChart3,
  Settings,
  Dna,
  FileInput,
  Users,
  Mic,
  BookOpen,
  List,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/dna-intake", label: "DNA Intake", icon: Dna },
  { to: "/outline-import", label: "Outline Import", icon: FileInput },
  { to: "/outline", label: "Outline", icon: List },
  { to: "/characters", label: "Characters", icon: Users },
  { to: "/voice-corpus", label: "Voice Corpus", icon: Mic },
  { to: "/catalogue", label: "Catalogue", icon: BookOpen },
  { to: "/generate", label: "Generate", icon: PenTool },
  { to: "/review", label: "Review", icon: CheckCircle },
  { to: "/archive", label: "Archive", icon: Archive },
  { to: "/editorial", label: "Editorial", icon: FileEdit },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

const MODULE_SLOTS = Array.from({ length: 28 }, (_, i) => ({
  id: i + 1,
  label: `S${String(i + 1).padStart(2, "0")}`,
  status: i === 0 ? "active" : "pending",
}));

const Sidebar = () => {
  const location = useLocation();

  return (
    <aside className="w-[280px] min-w-[280px] h-full bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">G</span>
          </div>
          <div>
            <h1 className="text-foreground font-semibold text-base tracking-wide">GHOSTLY</h1>
            <span className="text-xs text-muted-foreground font-mono">v2.2.0</span>
          </div>
        </div>
      </div>

      {/* Active Project */}
      <div className="px-5 py-3 border-b border-sidebar-border">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Active Project</p>
        <p className="text-sm text-foreground">No project loaded</p>
      </div>

      {/* Navigation */}
      <nav className="px-3 py-3 flex-1">
        <p className="px-2 text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Navigation</p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Module Status */}
      <div className="px-5 py-3 border-t border-sidebar-border">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Sessions</p>
        <div className="grid grid-cols-7 gap-1">
          {MODULE_SLOTS.map((slot) => (
            <div
              key={slot.id}
              className={`text-[9px] font-mono text-center py-1 ${
                slot.status === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
              title={`Session ${slot.id}: ${slot.status}`}
            >
              {slot.label}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
