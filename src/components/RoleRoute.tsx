import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { getSession } from "@/lib/auth";
import { canAccess } from "@/lib/roles";
import { useLang } from "@/lib/i18n";

/**
 * Route-level authorisation. Renders an access-denied panel (not a redirect
 * loop) when the signed-in staff role is not allowed for this path.
 */
export default function RoleRoute({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  const session = getSession();
  const location = useLocation();
  const { t } = useLang();

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (!canAccess(path, session.role)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold">
          {t("Akses Dinafikan", "Access Denied")}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t(
            `Peranan ${session.role} tidak dibenarkan membuka halaman ini. Sila hubungi pentadbir jika anda perlukan akses.`,
            `Your ${session.role} role is not allowed to open this page. Contact an administrator if you need access.`,
          )}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
