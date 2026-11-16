import { Routes, Route } from "react-router-dom";
import AppShell from "@/components/AppShell";
import BookingWorkspace from "@/pages/BookingWorkspace";
import TripsDashboard from "@/pages/TripsDashboard";
import PackageCatalog from "@/pages/PackageCatalog";
import Placeholder from "@/pages/Placeholder";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Placeholder title="Dashboard" />} />
        <Route path="/bookings" element={<BookingWorkspace />} />
        <Route path="/trips" element={<TripsDashboard />} />
        <Route path="/packages" element={<PackageCatalog />} />
        <Route path="/customers" element={<Placeholder title="Customers" />} />
        <Route
          path="/billing"
          element={<Placeholder title="Billing & Payments" />}
        />
        <Route
          path="/website"
          element={<Placeholder title="Website Manager" />}
        />
        <Route path="/settings" element={<Placeholder title="Settings" />} />
      </Route>
    </Routes>
  );
}
