import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { fetchSession, getSession } from "@/lib/auth";

/**
 * Gates the admin workspace behind the real Better Auth session.
 * On mount it verifies the session against the Worker (authoritative),
 * while immediately using the cached session to avoid flicker.
 */
export default function ProtectedRoute() {
  const location = useLocation();
  const [cached] = useState(() => getSession());
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    fetchSession().then((session) => {
      if (!active) return;
      setVerified(session !== null);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // Fast path: no cached session at all -> straight to login.
  if (!cached && !verified) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // Still verifying with the server but we have a cached session — render
  // children; if the server says signed-out the next guard pass redirects.
  if (checking && cached) return <Outlet />;

  if (!verified) {
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
