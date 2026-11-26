import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LanguageProvider } from "@/lib/i18n";
import { preloadBranding } from "@/lib/useBranding";
import { registerServiceWorker } from "@/lib/pwa";
import { TourProvider } from "@/components/tour/TourContext";
import { SALES_TOUR_STEPS } from "@/components/tour/steps";
import "./index.css";

// Warm the shared branding cache so the CRM shell and the public website
// render the same company name, contact details and WhatsApp link.
void preloadBranding();

// PWA: enable "Install app" from the browser (service worker + prompt).
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <TourProvider steps={SALES_TOUR_STEPS}>
          <App />
        </TourProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
);
