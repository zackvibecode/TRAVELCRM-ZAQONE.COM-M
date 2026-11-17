import { Routes, Route } from "react-router-dom";
import AppShell from "@/components/AppShell";
import BookingWorkspace from "@/pages/BookingWorkspace";
import TripsDashboard from "@/pages/TripsDashboard";
import PackageCatalog from "@/pages/PackageCatalog";
import LeadsPipeline from "@/pages/LeadsPipeline";
import Customers from "@/pages/Customers";
import BillingWorkspace from "@/pages/BillingWorkspace";
import Placeholder from "@/pages/Placeholder";
import DashboardOverview from "@/pages/DashboardOverview";
import ReportsPage from "@/pages/ReportsPage";
import PublicSiteShell from "@/components/PublicSiteShell";
import PublicHome from "@/pages/PublicHome";
import PublicPromos from "@/pages/PublicPromos";
import PublicPackages from "@/pages/PublicPackages";
import PublicPackageDetail from "@/pages/PublicPackageDetail";
import PublicContact from "@/pages/PublicContact";
import WebsiteManager from "@/pages/WebsiteManager";
import AiTokens from "@/pages/AiTokens";
import McpAuditLog from "@/pages/McpAuditLog";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardOverview />} />
        <Route path="/bookings" element={<BookingWorkspace />} />
        <Route path="/trips" element={<TripsDashboard />} />
        <Route path="/packages" element={<PackageCatalog />} />
        <Route path="/leads" element={<LeadsPipeline />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/billing" element={<BillingWorkspace />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/website" element={<WebsiteManager />} />
        <Route path="/ai-tokens" element={<AiTokens />} />
        <Route path="/mcp-audit" element={<McpAuditLog />} />
        <Route path="/settings" element={<Placeholder title="Settings" />} />
      </Route>

      {/* Public website */}
      <Route path="/site" element={<PublicSiteShell />}>
        <Route index element={<PublicHome />} />
        <Route path="promos" element={<PublicPromos />} />
        <Route path="packages" element={<PublicPackages />} />
        <Route path="packages/:id" element={<PublicPackageDetail />} />
        <Route path="contact" element={<PublicContact />} />
        <Route path="about" element={<PublicHome />} />
      </Route>
    </Routes>
  );
}
