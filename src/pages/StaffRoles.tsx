import { useState } from "react";
import { Users, ShieldCheck, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROUTE_ROLES } from "@/lib/roles";
import type { StaffRole } from "@/lib/auth";

type StaffStatus = "active" | "invited" | "suspended";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  lastActive: string;
}

const ROLES: StaffRole[] = [
  "super_admin",
  "management",
  "sales",
  "finance",
  "operations",
];

const ROLE_LABELS: Record<StaffRole, { ms: string; en: string }> = {
  super_admin: { ms: "Super Admin", en: "Super Admin" },
  management: { ms: "Pengurusan", en: "Management" },
  sales: { ms: "Jualan", en: "Sales" },
  finance: { ms: "Kewangan", en: "Finance" },
  operations: { ms: "Operasi", en: "Operations" },
};

const ROLE_BADGE_CLASS: Record<StaffRole, string> = {
  super_admin: "bg-red-50 text-red-700 border-red-200",
  management: "bg-violet-50 text-violet-700 border-violet-200",
  sales: "bg-sky-50 text-sky-700 border-sky-200",
  finance: "bg-emerald-50 text-emerald-700 border-emerald-200",
  operations: "bg-amber-50 text-amber-700 border-amber-200",
};

const STATUS_LABELS: Record<StaffStatus, { ms: string; en: string }> = {
  active: { ms: "Aktif", en: "Active" },
  invited: { ms: "Dijemput", en: "Invited" },
  suspended: { ms: "Digantung", en: "Suspended" },
};

// Stub data — backend staff API menyusul pada task backend.
const STUB_STAFF: StaffMember[] = [
  { id: "usr_owner", name: "Zack (Owner)", email: "owner@zaqone.travel", role: "super_admin", status: "active", lastActive: "2026-11-17 15:40" },
  { id: "usr_mgr", name: "Farah (Management)", email: "manager@zaqone.travel", role: "management", status: "active", lastActive: "2026-11-17 11:02" },
  { id: "usr_sales", name: "Adib (Sales)", email: "sales@zaqone.travel", role: "sales", status: "active", lastActive: "2026-11-16 18:25" },
  { id: "usr_fin", name: "Melati (Finance)", email: "finance@zaqone.travel", role: "finance", status: "active", lastActive: "2026-11-15 09:14" },
  { id: "usr_ops", name: "Imran (Operations)", email: "ops@zaqone.travel", role: "operations", status: "invited", lastActive: "—" },
];

const ROUTE_LABELS: Record<string, { ms: string; en: string }> = {
  "/": { ms: "Papan Pemuka", en: "Dashboard" },
  "/bookings": { ms: "Tempahan", en: "Bookings" },
  "/trips": { ms: "Trip & Kerusi", en: "Trips & Seats" },
  "/packages": { ms: "Pakej", en: "Packages" },
  "/customers": { ms: "Pelanggan", en: "Customers" },
  "/leads": { ms: "Saluran Leads", en: "Leads Pipeline" },
  "/billing": { ms: "Billing & Pembayaran", en: "Billing & Payments" },
  "/reports": { ms: "Laporan", en: "Reports" },
  "/website": { ms: "Pengurus Laman", en: "Website Manager" },
  "/ai-tokens": { ms: "Token Akses AI", en: "AI Access Tokens" },
  "/mcp-audit": { ms: "Log Audit MCP", en: "MCP Audit Log" },
  "/staff": { ms: "Peranan Staf", en: "Staff Roles" },
  "/staff-audit": { ms: "Log Audit Staf", en: "Staff Audit Log" },
  "/company-profile": { ms: "Profil Syarikat", en: "Company Profile" },
  "/bank-accounts": { ms: "Akaun Bank", en: "Bank Accounts" },
  "/document-numbering": { ms: "Penomboran Dokumen", en: "Document Numbering" },
  "/settings": { ms: "Tetapan", en: "Settings" },
};

export default function StaffRoles() {
  const { t, lang } = useLang();
  const [staff, setStaff] = useState<StaffMember[]>(STUB_STAFF);

  // Change-role dialog state (mock submit — backend staff API menyusul)
  const [roleTarget, setRoleTarget] = useState<StaffMember | null>(null);
  const [pickedRole, setPickedRole] = useState<StaffRole>("sales");
  const [submitting, setSubmitting] = useState(false);

  const openRoleDialog = (member: StaffMember) => {
    setRoleTarget(member);
    setPickedRole(member.role);
  };

  const handleRoleChange = () => {
    if (!roleTarget) return;
    setSubmitting(true);
    window.setTimeout(() => {
      setStaff((prev) =>
        prev.map((m) =>
          m.id === roleTarget.id ? { ...m, role: pickedRole } : m,
        ),
      );
      setSubmitting(false);
      setRoleTarget(null);
    }, 400);
  };

  const roleCounts = ROLES.map((r) => ({
    role: r,
    count: staff.filter((m) => m.role === r).length,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {t("Peranan Staf", "Staff Roles")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Urus peranan dan akses staf ke ruang kerja CRM.",
            "Manage staff roles and their access to the CRM workspace.",
          )}
        </p>
      </div>

      {/* Role summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {roleCounts.map(({ role, count }) => (
          <div key={role} className="rounded-lg border bg-white p-3">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  ROLE_BADGE_CLASS[role],
                )}
              >
                {t(ROLE_LABELS[role].ms, ROLE_LABELS[role].en)}
              </span>
            </div>
            <p className="mt-2 font-display text-xl font-bold">{count}</p>
            <p className="text-xs text-muted-foreground">
              {t("staf", "staff")}
            </p>
          </div>
        ))}
      </div>

      {/* Staff table */}
      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">
                {t("Staf", "Staff")}
              </th>
              <th className="px-4 py-2.5 font-semibold">
                {t("Peranan", "Role")}
              </th>
              <th className="px-4 py-2.5 font-semibold">
                {t("Status", "Status")}
              </th>
              <th className="hidden px-4 py-2.5 font-semibold md:table-cell">
                {t("Aktif Terakhir", "Last Active")}
              </th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {staff.map((m) => (
              <tr key={m.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
                      ROLE_BADGE_CLASS[m.role],
                    )}
                  >
                    {t(ROLE_LABELS[m.role].ms, ROLE_LABELS[m.role].en)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {m.status === "active" ? (
                    <span className="text-emerald-700">
                      ● {t(STATUS_LABELS.active.ms, STATUS_LABELS.active.en)}
                    </span>
                  ) : m.status === "invited" ? (
                    <span className="text-amber-700">
                      ● {t(STATUS_LABELS.invited.ms, STATUS_LABELS.invited.en)}
                    </span>
                  ) : (
                    <span className="text-red-700">
                      ● {t(STATUS_LABELS.suspended.ms, STATUS_LABELS.suspended.en)}
                    </span>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                  {m.lastActive}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openRoleDialog(m)}
                    className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {t("Tukar Peranan", "Change Role")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Permission matrix preview */}
      <div>
        <h2 className="mb-2 font-display text-lg font-bold tracking-tight">
          {t("Matriks Kebenaran Halaman", "Page Permission Matrix")}
        </h2>
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">
                  {t("Halaman", "Page")}
                </th>
                {ROLES.map((r) => (
                  <th key={r} className="px-3 py-2.5 text-center font-semibold">
                    {t(ROLE_LABELS[r].ms, ROLE_LABELS[r].en).split(" ")[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(ROUTE_ROLES).map(([path, allowed]) => (
                <tr key={path} className="border-b last:border-b-0">
                  <td className="px-4 py-2.5">
                    <span className="font-medium">
                      {t(
                        ROUTE_LABELS[path]?.ms ?? path,
                        ROUTE_LABELS[path]?.en ?? path,
                      )}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {path}
                    </span>
                  </td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-3 py-2.5 text-center">
                      {allowed.includes(r) ? (
                        <Check className="mx-auto h-4 w-4 text-emerald-600" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Change-role dialog */}
      <Dialog open={roleTarget !== null} onOpenChange={(o) => !o && setRoleTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("Tukar Peranan", "Change Role")}
            </DialogTitle>
            <DialogDescription>
              {roleTarget?.name} · {roleTarget?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setPickedRole(r)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50",
                  pickedRole === r && "border-primary/60 bg-primary/5",
                )}
              >
                <span className="font-medium">
                  {t(ROLE_LABELS[r].ms, ROLE_LABELS[r].en)}
                </span>
                {pickedRole === r && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
          <DialogFooter>
            <button
              onClick={() => setRoleTarget(null)}
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50"
            >
              {t("Batal", "Cancel")}
            </button>
            <button
              onClick={handleRoleChange}
              disabled={submitting || pickedRole === roleTarget?.role}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <Users className="h-4 w-4" />
              {submitting
                ? t("Sedang simpan…", "Saving…")
                : t("Simpan Peranan", "Save Role")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ChevronDown className="h-3.5 w-3.5" />
        {t(
          "Data olok-olok — pengurusan staf sebenar akan didayakan pada fasa backend.",
          "Mock data — real staff management will be enabled in the backend phase.",
        )}
        {lang === "ms" ? "" : ""}
      </p>
    </div>
  );
}
