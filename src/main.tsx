import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { githubStorage } from "./storage/githubStorage";
import "./security/sanitizer"; // registers window.__ghostly_sanitizer

// Initialize storage and expose for console testing
githubStorage.init();
(window as unknown as Record<string, unknown>).__ghostly_storage = githubStorage;

createRoot(document.getElementById("root")!).render(<App />);
