import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LanguageProvider } from "@/lib/i18n";
import { preloadBranding } from "@/lib/useBranding";
import "./index.css";

// Warm the shared branding cache so the CRM shell and the public website
// render the same company name, contact details and WhatsApp link.
void preloadBranding();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
);
