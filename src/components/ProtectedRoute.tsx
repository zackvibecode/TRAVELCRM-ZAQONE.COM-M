import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getSession } from "@/lib/auth";

/**
 * Gates the admin workspace behind the mock staff session.
 * Unauthenticated visitors are redirected to /login, preserving the
 * attempted path so they return there after signing in.
 */
export default function ProtectedRoute() {
  const location = useLocation();

  if (!getSession()) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <Outlet />;
}
