import { Routes, Route } from "react-router-dom";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleRoute from "@/components/RoleRoute";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
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
import StaffRoles from "@/pages/StaffRoles";
import StaffAuditLog from "@/pages/StaffAuditLog";

export default function App() {
  return (
    <Routes>
      {/* Staff login & password recovery (mock auth) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Admin workspace (requires session) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<RoleRoute path="/"><DashboardOverview /></RoleRoute>} />
          <Route path="/bookings" element={<RoleRoute path="/bookings"><BookingWorkspace /></RoleRoute>} />
          <Route path="/trips" element={<RoleRoute path="/trips"><TripsDashboard /></RoleRoute>} />
          <Route path="/packages" element={<RoleRoute path="/packages"><PackageCatalog /></RoleRoute>} />
          <Route path="/leads" element={<RoleRoute path="/leads"><LeadsPipeline /></RoleRoute>} />
          <Route path="/customers" element={<RoleRoute path="/customers"><Customers /></RoleRoute>} />
          <Route path="/billing" element={<RoleRoute path="/billing"><BillingWorkspace /></RoleRoute>} />
          <Route path="/reports" element={<RoleRoute path="/reports"><ReportsPage /></RoleRoute>} />
          <Route path="/website" element={<RoleRoute path="/website"><WebsiteManager /></RoleRoute>} />
          <Route path="/ai-tokens" element={<RoleRoute path="/ai-tokens"><AiTokens /></RoleRoute>} />
          <Route path="/mcp-audit" element={<RoleRoute path="/mcp-audit"><McpAuditLog /></RoleRoute>} />
          <Route path="/staff" element={<RoleRoute path="/staff"><StaffRoles /></RoleRoute>} />
          <Route path="/staff-audit" element={<RoleRoute path="/staff-audit"><StaffAuditLog /></RoleRoute>} />
          <Route path="/settings" element={<RoleRoute path="/settings"><Placeholder title="Settings" /></RoleRoute>} />
        </Route>
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
