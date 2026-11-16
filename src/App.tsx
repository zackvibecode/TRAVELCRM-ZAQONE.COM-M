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
        <Route
          path="/website"
          element={<Placeholder title="Website Manager" />}
        />
        <Route path="/settings" element={<Placeholder title="Settings" />} />
      </Route>
    </Routes>
  );
}
