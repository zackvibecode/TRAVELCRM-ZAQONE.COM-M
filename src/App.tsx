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
import DashboardOverview from "@/pages/DashboardOverview";
import ReportsPage from "@/pages/ReportsPage";
import PublicSiteShell from "@/components/PublicSiteShell";
import PublicHome from "@/pages/PublicHome";
import PublicPromos from "@/pages/PublicPromos";
import PublicPackages from "@/pages/PublicPackages";
import PublicPackageDetail from "@/pages/PublicPackageDetail";
import PublicContact from "@/pages/PublicContact";
import WebsiteManager from "@/pages/WebsiteManager";
import WebsiteContentEditor from "@/pages/WebsiteContentEditor";
import AiTokens from "@/pages/AiTokens";
import McpAuditLog from "@/pages/McpAuditLog";
import StaffRoles from "@/pages/StaffRoles";
import StaffAuditLog from "@/pages/StaffAuditLog";
import Settings from "@/pages/Settings";
import CompanyProfile from "@/pages/CompanyProfile";
import BankAccounts from "@/pages/BankAccounts";
import DocumentNumbering from "@/pages/DocumentNumbering";
import BookingDefaults from "@/pages/BookingDefaults";
import NotificationTemplates from "@/pages/NotificationTemplates";
import ApiTokenPanel from "@/pages/ApiTokenPanel";
import DataMaintenance from "@/pages/DataMaintenance";
import SettingsAuditLog from "@/pages/SettingsAuditLog";

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
          <Route path="/website/editor" element={<RoleRoute path="/website"><WebsiteContentEditor /></RoleRoute>} />
          <Route path="/ai-tokens" element={<RoleRoute path="/ai-tokens"><AiTokens /></RoleRoute>} />
          <Route path="/mcp-audit" element={<RoleRoute path="/mcp-audit"><McpAuditLog /></RoleRoute>} />
          <Route path="/staff" element={<RoleRoute path="/staff"><StaffRoles /></RoleRoute>} />
          <Route path="/staff-audit" element={<RoleRoute path="/staff-audit"><StaffAuditLog /></RoleRoute>} />
          <Route path="/settings" element={<RoleRoute path="/settings"><Settings /></RoleRoute>} />
          <Route path="/company-profile" element={<RoleRoute path="/company-profile"><CompanyProfile /></RoleRoute>} />
          <Route path="/bank-accounts" element={<RoleRoute path="/bank-accounts"><BankAccounts /></RoleRoute>} />
          <Route path="/document-numbering" element={<RoleRoute path="/document-numbering"><DocumentNumbering /></RoleRoute>} />
          <Route path="/booking-defaults" element={<RoleRoute path="/booking-defaults"><BookingDefaults /></RoleRoute>} />
          <Route path="/notification-templates" element={<RoleRoute path="/notification-templates"><NotificationTemplates /></RoleRoute>} />
          <Route path="/api-tokens" element={<RoleRoute path="/api-tokens"><ApiTokenPanel /></RoleRoute>} />
          <Route path="/data-maintenance" element={<RoleRoute path="/data-maintenance"><DataMaintenance /></RoleRoute>} />
          <Route path="/settings-audit" element={<RoleRoute path="/settings-audit"><SettingsAuditLog /></RoleRoute>} />
        </Route>
      </Route>

      {/* Public website — default locale + explicit locale-prefixed URLs */}
      <Route path="/site" element={<PublicSiteShell />}>
        <Route index element={<PublicHome />} />
        <Route path="promos" element={<PublicPromos />} />
        <Route path="packages" element={<PublicPackages />} />
        <Route path="packages/:id" element={<PublicPackageDetail />} />
        <Route path="contact" element={<PublicContact />} />
        <Route path="about" element={<PublicHome />} />
      </Route>
      {(["ms", "en"] as const).map((locale) => (
        <Route
          key={locale}
          path={`/site/${locale}`}
          element={<PublicSiteShell />}
        >
          <Route index element={<PublicHome />} />
          <Route path="promos" element={<PublicPromos />} />
          <Route path="packages" element={<PublicPackages />} />
          <Route path="packages/:id" element={<PublicPackageDetail />} />
          <Route path="contact" element={<PublicContact />} />
          <Route path="about" element={<PublicHome />} />
        </Route>
      ))}
    </Routes>
  );
}
