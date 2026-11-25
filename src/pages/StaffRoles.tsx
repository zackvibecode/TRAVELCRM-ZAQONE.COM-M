import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Pause,
  Play,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { refreshPermissionMatrix } from "@/lib/permission-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StaffRole } from "@/lib/auth";

type StaffStatus = "active" | "invited" | "suspended";
type StaffTab = "team" | "roles" | "activity";

interface StaffMember {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  last: string;
  device: string;
  joined: string;
  twofa: boolean;
  activity: number;
}

const ROLES: StaffRole[] = ["super_admin", "management", "sales", "finance", "operations"];

const ROLE_LABELS: Record<StaffRole, { ms: string; en: string }> = {
  super_admin: { ms: "Super Admin", en: "Super Admin" },
  management: { ms: "Pengurusan", en: "Management" },
  sales: { ms: "Jualan", en: "Sales" },
  finance: { ms: "Kewangan", en: "Finance" },
  operations: { ms: "Operasi", en: "Operations" },
};

const STATUS_LABELS: Record<StaffStatus, { ms: string; en: string }> = {
  active: { ms: "Aktif", en: "Active" },
  invited: { ms: "Menunggu", en: "Pending" },
  suspended: { ms: "Nonaktif", en: "Inactive" },
};

const STATUS_CLASS: Record<StaffStatus, string> = {
  active: "bg-emerald-50 text-emerald-700",
  invited: "bg-amber-50 text-amber-700",
  suspended: "bg-muted text-muted-foreground",
};

const MODULES = [
  { id: "bookings", ms: "Tempahan", en: "Bookings" },
  { id: "customers", ms: "Pelanggan & Lead", en: "Customer & Lead" },
  { id: "followup", ms: "Follow-Up & Lead Pipeline", en: "Follow-Up & Lead Pipeline" },
  { id: "share_report", ms: "Team Sales Share Report", en: "Team Sales Share Report" },
  { id: "billing", ms: "Billing & Pembayaran", en: "Billing & Payments" },
  { id: "packages", ms: "Pakej", en: "Packages" },
  { id: "trips", ms: "Trip & Kerusi", en: "Trips & Seats" },
  { id: "website", ms: "Pengurus Laman", en: "Website Manager" },
  { id: "staff", ms: "Akses Staf", en: "Staff Access" },
  { id: "mcp", ms: "Pelayan MCP", en: "MCP Server" },
];

const INITIAL_PERMISSIONS: Record<StaffRole, Record<string, boolean>> = {
  super_admin: { bookings: true, customers: true, followup: true, share_report: true, billing: true, packages: true, trips: true, website: true, staff: true, mcp: true },
  management: { bookings: true, customers: true, followup: true, share_report: true, billing: true, packages: true, trips: true, website: true, staff: false, mcp: false },
  sales: { bookings: true, customers: true, followup: true, share_report: true, billing: false, packages: true, trips: false, website: false, staff: false, mcp: false },
  finance: { bookings: true, customers: false, followup: false, share_report: false, billing: true, packages: false, trips: false, website: false, staff: false, mcp: false },
  operations: { bookings: true, customers: false, followup: false, share_report: false, billing: false, packages: true, trips: true, website: false, staff: false, mcp: false },
};

// Empty until the backend staff API is wired up.
const STUB_STAFF: StaffMember[] = [];

/** Map a D1 `user` row (from GET /staff) onto the UI's StaffMember shape. */
function toStaffMember(row: {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  emailVerified?: boolean;
  createdAt?: string;
}): StaffMember {
  const name = row.name ?? row.email ?? "Staf";
  const role = (row.role ?? "sales") as StaffRole;
  const status: StaffStatus =
    row.status === "suspended" ? "suspended" : row.status === "active" ? "active" : "invited";
  return {
    id: row.id,
    name,
    initials: name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join(""),
    email: row.email ?? "",
    role,
    status,
    last: "—",
    device: "—",
    joined: row.createdAt ? row.createdAt.slice(0, 10) : "—",
    twofa: false,
    activity: 0,
  };
}

interface ActivityEntry {
  id: string;
  who: string;
  action: { ms: string; en: string };
  target: string;
  time: string;
  ip: string;
  ok: boolean;
}

const ACTIVITY: ActivityEntry[] = [];

export default function StaffRoles() {
  const { t } = useLang();
  const [staff, setStaff] = useState<StaffMember[]>(STUB_STAFF);
  const [permissions, setPermissions] = useState(INITIAL_PERMISSIONS);
  /** Server-saved copy — used to detect unsaved changes and reset. */
  const [savedPermissions, setSavedPermissions] = useState(INITIAL_PERMISSIONS);
  const [permLoading, setPermLoading] = useState(true);
  const [permSaving, setPermSaving] = useState(false);
  const [tab, setTab] = useState<StaffTab>("team");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "all">("all");
  const [selectedId, setSelectedId] = useState("");
  const [logFilter, setLogFilter] = useState<"all" | "ok" | "fail">("all");
  const [notice, setNotice] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "sales" as StaffRole });
  const [inviteError, setInviteError] = useState("");
  // Inline edit + delete confirmation for the selected staff member.
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({ name: "", email: "", role: "sales" as StaffRole });
  const [editError, setEditError] = useState("");
  const [deleteArm, setDeleteArm] = useState(false); // two-step delete confirmation
  const [busy, setBusy] = useState(false);
  const myUserId = getSession()?.userId ?? "";

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4000);
  }

  // Load staff from D1 so the team list reflects real users (and their roles).
  const [staffLoading, setStaffLoading] = useState(true);
  function loadStaff() {
    setStaffLoading(true);
    apiFetch<{ staff?: Array<Record<string, unknown>> }>("/staff")
      .then((res) => {
        const rows = (res.staff ?? []) as Array<{
          id: string;
          name?: string;
          email?: string;
          role?: string;
          status?: string;
          emailVerified?: boolean;
          createdAt?: string;
        }>;
        setStaff(rows.map(toStaffMember));
      })
      .catch(() => {
        // Server unreachable — leave current list (may be empty).
      })
      .finally(() => setStaffLoading(false));
  }
  useEffect(() => {
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the saved permission matrix once on mount; fall back to defaults.
  useEffect(() => {
    let cancelled = false;
    setPermLoading(true);
    apiFetch<{ settings?: Record<string, unknown> }>("/settings")
      .then((res) => {
        if (cancelled) return;
        const stored = res.settings?.permissions as
          | Record<StaffRole, Record<string, boolean>>
          | undefined;
        if (stored && typeof stored === "object") {
          // Merge over defaults so newly added modules always have a value.
          const merged = { ...INITIAL_PERMISSIONS };
          for (const role of Object.keys(merged) as StaffRole[]) {
            merged[role] = { ...merged[role], ...(stored[role] ?? {}) };
          }
          setPermissions(merged);
          setSavedPermissions(merged);
        }
      })
      .catch(() => {
        // Server unreachable — keep defaults; Save will retry the PUT.
      })
      .finally(() => {
        if (!cancelled) setPermLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const permDirty = useMemo(
    () => JSON.stringify(permissions) !== JSON.stringify(savedPermissions),
    [permissions, savedPermissions],
  );

  async function savePermissions() {
    setPermSaving(true);
    try {
      await apiFetch("/settings/permissions", {
        method: "PUT",
        body: JSON.stringify(permissions),
      });
      setSavedPermissions(permissions);
      showNotice(t("Matriks izin disimpan.", "Permission matrix saved."));
      // Refresh the frontend matrix cache so sidebar/route guards update live.
      void refreshPermissionMatrix();
    } catch (err) {
      showNotice(
        err instanceof Error ? err.message : t("Gagal simpan izin.", "Failed to save permissions."),
      );
    } finally {
      setPermSaving(false);
    }
  }

  function patchStaff(id: string, patch: Partial<StaffMember>) {
    setStaff((current) => current.map((p) => (p.id === id ? { ...p, ...patch } : p)));

    // Persist role/status changes to the backend (best-effort; local state is
    // already optimistic). Skip synthetic invite ids (s-…).
    if (id.startsWith("s-")) return;
    const body: Record<string, unknown> = {};
    if (patch.role) body.role = patch.role;
    if (patch.status === "active") body.status = "active";
    if (patch.status === "suspended") body.status = "suspended";
    if (Object.keys(body).length > 0) {
      apiFetch(`/staff/${id}`, { method: "PATCH", body: JSON.stringify(body) })
        .then(() => loadStaff())
        .catch((err) => showNotice(err instanceof Error ? err.message : String(err)));
    }
  }

  function submitInvite() {
    const email = invite.email.trim();
    if (!email) {
      setInviteError(t("Email wajib diisi", "Email is required"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setInviteError(t("Format email belum benar", "Invalid email format"));
      return;
    }
    if (staff.some((p) => p.email.toLowerCase() === email.toLowerCase())) {
      setInviteError(t("Email ini sudah terdaftar", "This email is already registered"));
      return;
    }
    const name = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    // Create the user server-side (status: active, role set by admin) and
    // reload the list so the new staff member appears with a real id.
    apiFetch<{ success: boolean; staff?: Record<string, unknown> }>("/staff", {
      method: "POST",
      body: JSON.stringify({ name, email: email.toLowerCase(), role: invite.role }),
    })
      .then(() => {
        loadStaff();
        setTab("team");
        setQuery("");
        setRoleFilter("all");
        setInvite({ email: "", role: "sales" });
        setInviteError("");
        setInviteOpen(false);
        showNotice(t(`Staf ${email} ditambah sebagai ${ROLE_LABELS[invite.role].en}`, `Staff ${email} added as ${ROLE_LABELS[invite.role].en}`));
      })
      .catch((err) => {
        setInviteError(err instanceof Error ? err.message : String(err));
      });
  }

  // Save inline edit (name / role / status) via PATCH /staff/:id.
  function saveEdit() {
    if (!selected) return;
    const name = edit.name.trim();
    if (!name) {
      setEditError(t("Nama wajib diisi", "Name is required"));
      return;
    }
    // Guard: cannot demote the last super admin (mirrors backend rule).
    const isLastSuper =
      selected.role === "super_admin" &&
      edit.role !== "super_admin" &&
      staff.filter((p) => p.role === "super_admin").length <= 1;
    if (isLastSuper) {
      setEditError(t("Tak boleh turunkan Super Admin terakhir", "Cannot demote the last super admin"));
      return;
    }
    setBusy(true);
    apiFetch(`/staff/${selected.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name, role: edit.role }),
    })
      .then(() => {
        loadStaff();
        setEditOpen(false);
        setEditError("");
        showNotice(t(`${name} dikemaskini.`, `${name} updated.`));
      })
      .catch((err) => setEditError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  }

  // Delete the selected staff member via DELETE /staff/:id.
  function removeStaff() {
    if (!selected) return;
    if (selected.id === myUserId) {
      showNotice(t("Tak boleh padam akaun sendiri.", "You cannot delete your own account."));
      return;
    }
    setBusy(true);
    apiFetch(`/staff/${selected.id}`, { method: "DELETE" })
      .then(() => {
        loadStaff();
        setSelectedId("");
        setDeleteArm(false);
        showNotice(t(`${selected.name} dipadam.`, `${selected.name} deleted.`));
      })
      .catch((err) => showNotice(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  }

  const visible = useMemo(
    () =>
      staff.filter((p) => {
        const q = query.trim().toLowerCase();
        if (q && !p.name.toLowerCase().includes(q) && !p.email.toLowerCase().includes(q)) return false;
        if (roleFilter !== "all" && p.role !== roleFilter) return false;
        return true;
      }),
    [staff, query, roleFilter],
  );

  const selected = staff.find((p) => p.id === selectedId) ?? staff[0];
  const activeCount = staff.filter((p) => p.status === "active").length;
  const pendingCount = staff.filter((p) => p.status === "invited").length;
  const todayEvents = ACTIVITY.filter((e) => e.time.startsWith("Hari ini")).length;
  const logs = ACTIVITY.filter((e) => logFilter === "all" || (logFilter === "ok" ? e.ok : !e.ok));
  const pillCls = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap";
  const tabs: { id: StaffTab; label: { ms: string; en: string }; count: number }[] = [
    { id: "team", label: { ms: "Staf", en: "Team" }, count: staff.length },
    { id: "roles", label: { ms: "Peran & izin", en: "Roles & permissions" }, count: ROLES.length },
    { id: "activity", label: { ms: "Aktiviti", en: "Activity" }, count: ACTIVITY.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("Akses Staf", "Staff Access")}</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {activeCount} {t("staf aktif", "active staff")} · {ROLES.length} {t("peran", "roles")} · {pendingCount} {t("undangan menunggu", "pending invites")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => showNotice(t("Laporan akses 30 hari disediakan", "30-day access report prepared"))} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-semibold hover:bg-muted/50">
            <Download className="h-4 w-4" />
            {t("Laporan Akses", "Access Report")}
          </button>
          <button onClick={() => { setInviteError(""); setInviteOpen(true); }} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary/90">
            <UserPlus className="h-4 w-4" />
            {t("Undang Staf", "Invite Staff")}
          </button>
        </div>
      </header>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: t("Staf aktif", "Active staff"), icon: Users, value: String(activeCount), note: t(`dari ${staff.length} akaun`, `of ${staff.length} accounts`) },
          { label: t("Peran terpakai", "Roles in use"), icon: ShieldCheck, value: String(ROLES.length), note: t(`${MODULES.length} modul diatur`, `${MODULES.length} modules managed`) },
          { label: t("Undangan menunggu", "Pending invites"), icon: Mail, value: String(pendingCount), note: t("belum terima emel", "emails not accepted yet") },
          { label: t("Aktiviti hari ini", "Activity today"), icon: Activity, value: String(todayEvents), note: t("termasuk 1 cubaan gagal", "including 1 failed attempt") },
        ].map((m, i) => (
          <article key={i} className="flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[12px] font-semibold text-muted-foreground">{m.label}</span>
              <m.icon className="h-3.5 w-3.5 flex-none text-muted-foreground" />
            </div>
            <div className="font-display text-[24px] font-bold leading-tight tracking-tight [font-variant-numeric:tabular-nums]">{m.value}</div>
            <span className="truncate text-[12px] text-muted-foreground">{m.note}</span>
          </article>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
              tab === item.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(item.label.ms, item.label.en)}
            <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-bold [font-variant-numeric:tabular-nums]", tab === item.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {/* Team tab */}
      {tab === "team" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px] items-start">
          {/* Pending access requests — approve new sign-ups here. */}
          {staff.filter((p) => p.status === "invited").length > 0 && (
            <section className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] lg:col-span-2">
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-warning)]/30 px-5 py-3">
                <Mail className="h-4 w-4 text-[var(--color-warning)]" />
                <h2 className="flex-1 font-display text-base font-bold">
                  {t("Permintaan Akses", "Access Requests")}
                </h2>
                <span className="rounded-full bg-[var(--color-warning)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-on-primary)]">
                  {staff.filter((p) => p.status === "invited").length}
                </span>
              </div>
              <ul className="m-0 list-none p-0">
                {staff.filter((p) => p.status === "invited").map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 border-t border-[var(--color-warning)]/20 px-5 py-3 first:border-t-0">
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white text-xs font-bold text-muted-foreground">{p.initials}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold">{p.name}</span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">{p.email} · {t(ROLE_LABELS[p.role].ms, ROLE_LABELS[p.role].en)}</span>
                    </span>
                    <button
                      onClick={() => { patchStaff(p.id, { status: "active" }); showNotice(t(`${p.name} diluluskan.`, `${p.name} approved.`)); }}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-success)] px-3 py-1.5 text-xs font-bold text-white hover:brightness-95"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {t("Luluskan", "Approve")}
                    </button>
                    <button
                      onClick={() => { patchStaff(p.id, { status: "suspended" }); showNotice(t(`${p.name} ditolak.`, `${p.name} rejected.`)); }}
                      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50"
                    >
                      <X className="h-3.5 w-3.5" />
                      {t("Tolak", "Reject")}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-surface)]">
            <div className="flex flex-wrap items-center gap-2 border-b p-4">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <Search className="h-3.5 w-3.5 flex-none text-muted-foreground" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Cari nama atau emel…", "Search name or email…")} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {t("Peran", "Role")}
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as StaffRole | "all")} className="h-9 rounded-md border bg-white px-2 text-xs">
                  <option value="all">{t("Semua peran", "All roles")}</option>
                  {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_LABELS[r].ms, ROLE_LABELS[r].en)}</option>)}
                </select>
              </label>
            </div>
            {staffLoading ? (
              <div className="flex items-center justify-center gap-2 px-5 py-12 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-[13px]">{t("Memuatkan staf…", "Loading staff…")}</span>
              </div>
            ) : visible.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="font-semibold">{t("Tiada staf sepadan", "No matching staff")}</p>
                <p className="mt-1.5 text-[13px] text-muted-foreground">{t("Ubah kata kunci atau peran.", "Change the keyword or role filter.")}</p>
                <button onClick={() => { setQuery(""); setRoleFilter("all"); }} className="mt-3 rounded-md border px-3 py-1.5 text-xs font-semibold">{t("Atur ulang", "Reset filter")}</button>
              </div>
            ) : (
              <ul>
                {visible.map((p) => (
                  <li key={p.id} className="border-b last:border-0">
                    <button
                      onClick={() => { setSelectedId(p.id); setDeleteArm(false); setEditOpen(false); }}
                      className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30", selected?.id === p.id && "bg-primary/5")}
                    >
                      <span className={cn("grid h-9 w-9 flex-none place-items-center rounded-full text-xs font-bold", selected?.id === p.id ? "bg-white text-primary" : "bg-muted text-muted-foreground")}>{p.initials}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold">{p.name}</span>
                        <span className="block truncate text-[11.5px] text-muted-foreground">{t(ROLE_LABELS[p.role].ms, ROLE_LABELS[p.role].en)} · {p.last}</span>
                      </span>
                      <span className={cn(pillCls, STATUS_CLASS[p.status])}>{t(STATUS_LABELS[p.status].ms, STATUS_LABELS[p.status].en)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Detail panel */}
          {selected && (
            <aside className="overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-surface)]">
              <div className="flex flex-col gap-4 p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-muted text-sm font-bold text-muted-foreground">{selected.initials}</span>
                  <div className="min-w-0">
                    <p className="break-words text-[15px] font-bold">{selected.name}</p>
                    <p className="mt-0.5 break-words text-xs text-muted-foreground">{selected.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className={cn(pillCls, STATUS_CLASS[selected.status])}>{t(STATUS_LABELS[selected.status].ms, STATUS_LABELS[selected.status].en)}</span>
                  <span className="rounded-full border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {selected.twofa ? t("2FA aktif", "2FA active") : t("2FA belum aktif", "2FA not active")}
                  </span>
                </div>
                <dl className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
                  <dt className="text-xs text-muted-foreground">{t("Peran", "Role")}</dt>
                  <dd>
                    <select
                      value={selected.role}
                      onChange={(e) => { const role = e.target.value as StaffRole; patchStaff(selected.id, { role }); showNotice(t(`Peran ${selected.name} ditukar ke ${ROLE_LABELS[role].en}`, `${selected.name} role changed to ${ROLE_LABELS[role].en}`)); }}
                      className="h-8 w-full rounded-md border bg-white px-2 text-xs"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_LABELS[r].ms, ROLE_LABELS[r].en)}</option>)}
                    </select>
                  </dd>
                  <dt className="text-xs text-muted-foreground">{t("Masuk terakhir", "Last sign-in")}</dt>
                  <dd>{selected.last}</dd>
                  <dt className="text-xs text-muted-foreground">{t("Perangkat", "Device")}</dt>
                  <dd>{selected.device}</dd>
                  <dt className="text-xs text-muted-foreground">{t("Bergabung", "Joined")}</dt>
                  <dd>{selected.joined}</dd>
                  <dt className="text-xs text-muted-foreground">{t("Aktiviti", "Activity")}</dt>
                  <dd className="[font-variant-numeric:tabular-nums]">{selected.activity} {t("aksi minggu ini", "actions this week")}</dd>
                </dl>
                <div className="flex flex-col gap-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("Modul boleh diakses", "Accessible modules")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {MODULES.filter((m) => permissions[selected.role]?.[m.id]).map((m) => (
                      <span key={m.id} className="rounded-full border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{t(m.ms, m.en)}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  <button
                    onClick={() => { patchStaff(selected.id, { status: selected.status === "active" ? "suspended" : "active" }); showNotice(t(`Akaun ${selected.name} ${selected.status === "active" ? "dijeda" : "diaktifkan"}`, `${selected.name} account ${selected.status === "active" ? "paused" : "activated"}`)); }}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-semibold hover:bg-muted/50"
                  >
                    {selected.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {selected.status === "active" ? t("Jeda Akaun", "Pause Account") : t("Aktifkan Akaun", "Activate Account")}
                  </button>
                  <button
                    onClick={() => showNotice(t(`Pautan tetapan semula kata laluan dihantar ke ${selected.email}`, `Password reset link sent to ${selected.email}`))}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-semibold hover:bg-muted/50"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    {t("Atur Ulang Sandi", "Reset Password")}
                  </button>
                  <button
                    onClick={() => {
                      setEdit({ name: selected.name, email: selected.email, role: selected.role });
                      setEditError("");
                      setEditOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-semibold hover:bg-muted/50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t("Sunting", "Edit")}
                  </button>
                  {selected.id !== myUserId && (
                    deleteArm ? (
                      <span className="inline-flex items-center gap-1.5">
                        <button
                          onClick={removeStaff}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("Pasti Padam", "Confirm Delete")}
                        </button>
                        <button
                          onClick={() => setDeleteArm(false)}
                          className="rounded-md border px-2 py-1.5 text-xs font-semibold hover:bg-muted/50"
                        >
                          {t("Batal", "Cancel")}
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setDeleteArm(true)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("Padam", "Delete")}
                      </button>
                    )
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      )}

      {/* Roles tab */}
      {tab === "roles" && (
        <section className="overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-surface)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold">{t("Matriks Izin Peran", "Role Permission Matrix")}</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">{t("Tandakan modul yang boleh dibuka oleh setiap peran, kemudian simpan.", "Tick the modules each role is allowed to open, then save.")}</p>
            </div>
            <div className="flex flex-none items-center gap-2">
              {permLoading ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("Memuatkan…", "Loading…")}
                </span>
              ) : (
                <>
                  {permDirty && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      {t("Belum disimpan", "Unsaved changes")}
                    </span>
                  )}
                  <button
                    onClick={() => setPermissions(savedPermissions)}
                    disabled={!permDirty || permSaving}
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-semibold hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    {t("Batalkan", "Discard")}
                  </button>
                  <button
                    onClick={savePermissions}
                    disabled={!permDirty || permSaving}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {permSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {permSaving ? t("Menyimpan…", "Saving…") : t("Simpan Izin", "Save Permissions")}
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-bold">{t("Modul", "Module")}</th>
                  {ROLES.map((r) => <th key={r} className="px-3 py-2.5 text-center font-bold">{t(ROLE_LABELS[r].ms, ROLE_LABELS[r].en).split(" ")[0]}</th>)}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-semibold">{t(m.ms, m.en)}</td>
                    {ROLES.map((r) => (
                      <td key={r} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={permissions[r][m.id]}
                          disabled={r === "super_admin" && m.id === "staff"}
                          aria-label={`${t(m.ms, m.en)} — ${t(ROLE_LABELS[r].ms, ROLE_LABELS[r].en)}`}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setPermissions((cur) => ({ ...cur, [r]: { ...cur[r], [m.id]: checked } }));
                          }}
                          className="h-4 w-4 accent-[var(--color-primary)]"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Activity tab */}
      {tab === "activity" && (
        <section className="overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-surface)]">
          <div className="flex flex-wrap items-center gap-2 border-b p-4">
            <h2 className="flex-1 font-display text-base font-bold">{t("Log Aktiviti", "Activity Log")}</h2>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {t("Status", "Status")}
              <select value={logFilter} onChange={(e) => setLogFilter(e.target.value as "all" | "ok" | "fail")} className="h-9 rounded-md border bg-white px-2 text-xs">
                <option value="all">{t("Semua", "All")}</option>
                <option value="ok">{t("Berjaya", "Success")}</option>
                <option value="fail">{t("Gagal", "Failed")}</option>
              </select>
            </label>
          </div>
          <div>
            {logs.map((e) => (
              <div key={e.id} className="flex items-start gap-3 border-b px-4 py-3 last:border-0">
                <span className={cn("grid h-7 w-7 flex-none place-items-center rounded-full bg-muted text-muted-foreground", !e.ok && "bg-red-50 text-red-600")}>
                  {e.ok ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">{t(e.action.ms, e.action.en)}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                    <span>{e.who}</span><span>· {e.target}</span><span>· {e.ip}</span>
                  </div>
                </div>
                <div className="flex flex-none flex-col items-end gap-1">
                  <span className={cn(pillCls, e.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                    {e.ok ? t("Berjaya", "Success") : t("Gagal", "Failed")}
                  </span>
                  <span className="whitespace-nowrap text-[11px] text-muted-foreground">{e.time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Edit staff dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) { setEditOpen(false); setEditError(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Sunting Staf", "Edit Staff")}</DialogTitle>
            <DialogDescription>{edit.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="sa-edit-name" className="text-[12.5px] font-semibold text-muted-foreground">{t("Nama", "Name")}</label>
              <input
                id="sa-edit-name"
                value={edit.name}
                onChange={(e) => { setEdit((c) => ({ ...c, name: e.target.value })); setEditError(""); }}
                placeholder={t("Nama penuh", "Full name")}
                className={cn("h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", editError && "border-red-400")}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="sa-edit-role" className="text-[12.5px] font-semibold text-muted-foreground">{t("Peran", "Role")}</label>
              <select id="sa-edit-role" value={edit.role} onChange={(e) => setEdit((c) => ({ ...c, role: e.target.value as StaffRole }))} className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm">
                {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_LABELS[r].ms, ROLE_LABELS[r].en)}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("Modul akan terbuka", "Modules to open")}</p>
              <div className="flex flex-wrap gap-1.5">
                {MODULES.filter((m) => permissions[edit.role]?.[m.id]).map((m) => (
                  <span key={m.id} className="rounded-full border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{t(m.ms, m.en)}</span>
                ))}
              </div>
            </div>
            {editError && <p className="flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle className="h-3.5 w-3.5" />{editError}</p>}
          </div>
          <DialogFooter>
            <button onClick={() => { setEditOpen(false); setEditError(""); }} className="rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">{t("Batal", "Cancel")}</button>
            <button onClick={saveEdit} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {busy ? t("Menyimpan…", "Saving…") : t("Simpan", "Save")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Undang Staf Baru", "Invite New Staff")}</DialogTitle>
            <DialogDescription>{t("Undangan dihantar melalui email; staf pilih kata laluan sendiri.", "The invite is sent by email; the staff member picks their own password.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="sa-email" className="text-[12.5px] font-semibold text-muted-foreground">{t("Emel Kerja", "Work email")}</label>
              <input
                id="sa-email"
                type="email"
                value={invite.email}
                onChange={(e) => { setInvite((c) => ({ ...c, email: e.target.value })); setInviteError(""); }}
                aria-invalid={!!inviteError}
                placeholder="nama@zaqone.travel"
                className={cn("h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", inviteError && "border-red-400")}
              />
              {inviteError && <p className="flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle className="h-3.5 w-3.5" />{inviteError}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="sa-role" className="text-[12.5px] font-semibold text-muted-foreground">{t("Peran", "Role")}</label>
              <select id="sa-role" value={invite.role} onChange={(e) => setInvite((c) => ({ ...c, role: e.target.value as StaffRole }))} className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm">
                {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_LABELS[r].ms, ROLE_LABELS[r].en)}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("Modul akan terbuka", "Modules to open")}</p>
              <div className="flex flex-wrap gap-1.5">
                {MODULES.filter((m) => permissions[invite.role]?.[m.id]).map((m) => (
                  <span key={m.id} className="rounded-full border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{t(m.ms, m.en)}</span>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setInviteOpen(false)} className="rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">{t("Batal", "Cancel")}</button>
            <button onClick={submitInvite} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90">
              <UserPlus className="h-4 w-4" />
              {t("Hantar Undangan", "Send Invite")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {notice && (
        <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-[80] flex max-w-[340px] items-center gap-3 rounded-[var(--radius-card)] bg-[var(--color-text)] px-4 py-3 text-[13px] text-[var(--color-surface)] shadow-2xl">
          <CheckCircle2 className="h-4 w-4 flex-none text-emerald-300" />
          <span className="min-w-0 flex-1">{notice}</span>
          <button aria-label={t("Tutup notifikasi", "Dismiss notification")} onClick={() => setNotice("")} className="grid h-6 w-6 flex-none place-items-center"><X className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}
