import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PasswordGate from "./components/auth/PasswordGate";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Generate from "./pages/Generate";
import Review from "./pages/Review";
import ArchivePage from "./pages/Archive";
import EditorialPage from "./pages/EditorialPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ManuscriptHealthPage from "./pages/ManuscriptHealthPage";
import Settings from "./pages/Settings";
import DnaIntake from "./pages/DnaIntake";
import OutlineImport from "./pages/OutlineImport";
import OutlinePage from "./pages/OutlinePage";
import CharacterDBPage from "./pages/CharacterDB";
import VoiceCorpus from "./pages/VoiceCorpus";
import CatalogueRegistryPage from "./pages/CatalogueRegistry";
import CalibrationRunPage from "./pages/CalibrationRunPage";
import NotFound from "./pages/NotFound";
import ProjectsPage from "./pages/ProjectsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PasswordGate>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/generate" element={<Generate />} />
              <Route path="/review" element={<Review />} />
              <Route path="/archive" element={<ArchivePage />} />
              <Route path="/editorial" element={<EditorialPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/manuscript-health" element={<ManuscriptHealthPage />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/dna-intake" element={<DnaIntake />} />
              <Route path="/outline-import" element={<OutlineImport />} />
              <Route path="/outline" element={<OutlinePage />} />
              <Route path="/characters" element={<CharacterDBPage />} />
              <Route path="/voice-corpus" element={<VoiceCorpus />} />
              <Route path="/catalogue" element={<CatalogueRegistryPage />} />
              <Route path="/calibration" element={<CalibrationRunPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </PasswordGate>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
