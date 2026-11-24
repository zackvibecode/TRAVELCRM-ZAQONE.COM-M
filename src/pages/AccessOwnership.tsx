import { useMemo } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { crmAccessRole } from "@/pages/LeadManagement";
import { useLeadList } from "@/lib/useFollowup";
import {
  FollowupErrorState,
  FollowupLoading,
} from "@/components/FollowupStates";

/**
 * Akses & Kepemilikan — explains how the existing roles map to CRM access
 * (ADMIN / SALES), how every lead carries an owner, and how the single
 * `requireOwnedLead` guard answers 404 for leads the caller does not own.
 *
 * Mirrors the DesainPakeAI prototype (akses-kepemilikan.page.jsx): role map,
 * lead ownership table, a guard demonstration, and language/time-zone info.
 * It reads the real session and the real lead list — not mock staff arrays.
 */

const ROLE_MAP = [
  {
    existing: ["super_admin", "management"],
    mapped: "ADMIN",
    scope: { ms: "Setiap lead dan setiap modul; boleh menetapkan semula pemilikan dan konfigurasi peringkat follow-up.", en: "Every lead and every module; can reassign ownership and configure follow-up stages." },
  },
  {
    existing: ["sales"],
    mapped: "SALES",
    scope: { ms: "Hanya lead yang dimiliki; senarai ditapis mengikut owner_user_id secara automatik.", en: "Only the leads they own; lists filter by owner_user_id automatically." },
  },
];

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]", className)}>
      {children}
    </section>
  );
}

function CardHead({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
      <h2 className="m-0 text-[15px] font-semibold text-[var(--color-text)]">{title}</h2>
      {aside}
    </div>
  );
}

function Pill({ tone, children }: { tone: "primary" | "success" | "danger" | "neutral" | "info"; children: React.ReactNode }) {
  const toneClass = {
    primary: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
    success: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
    danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
    neutral: "bg-[var(--color-neutral-soft)] text-[var(--color-text-muted)]",
    info: "bg-[var(--color-info-soft)] text-[var(--color-info)]",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", toneClass)}>{children}</span>;
}

export default function AccessOwnership() {
  const { t } = useLang();
  const session = getSession();
  const access = session ? crmAccessRole(session.role) : null;

  const list = useLeadList({}, 500);
  const leads = useMemo(() => list.data?.data ?? [], [list.data]);

  const isAdmin = access === "ADMIN";
  const ownerId = session?.userId ?? "";

  const owned = useMemo(() => leads.filter((l) => l.ownerUserId === ownerId), [leads, ownerId]);
  const visible = useMemo(() => (isAdmin ? leads : owned), [isAdmin, leads, owned]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[22px] font-bold tracking-tight text-[var(--color-text)]">
            {t("Akses & Kepemilikan", "Access & Ownership")}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {t(
              "Guna login sedia ada — tiada login kedua. Setiap permintaan disemak untuk pastikan anda pemilik lead itu.",
              "Uses your existing login — no second login. Every request is checked to make sure the lead belongs to you.",
            )}
          </p>
        </div>
      </header>

      {list.loading ? (
        <FollowupLoading />
      ) : list.status === "error" ? (
        <FollowupErrorState message={list.error ?? ""} onRetry={() => void list.refetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div className="flex min-w-0 flex-col gap-5">
            <Card>
              <CardHead
                title={t("Pemetaan peranan", "Role mapping")}
                aside={<Pill tone="success">{t("Sistem login sama", "Same login system")}</Pill>}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-[var(--color-surface-raised)] text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">{t("Peranan sedia ada", "Existing role")}</th>
                      <th className="px-4 py-2.5 font-semibold">{t("Tahap akses", "Access level")}</th>
                      <th className="px-4 py-2.5 font-semibold">{t("Apa yang dibuka", "What it unlocks")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {ROLE_MAP.map((row) => (
                      <tr key={row.mapped}>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex flex-wrap gap-1.5">
                            {row.existing.map((role) => (
                              <span key={role} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--color-text-secondary)]">
                                {role}
                              </span>
                            ))}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Pill tone={row.mapped === "ADMIN" ? "primary" : "info"}>{row.mapped}</Pill>
                        </td>
                        <td className="px-4 py-2.5 leading-relaxed text-[var(--color-text-secondary)]">
                          {t(row.scope.ms, row.scope.en)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHead
                title={t("Kepemilikan lead", "Lead ownership")}
                aside={
                  <span className="text-[12.5px] text-muted-foreground">
                    {t(`${visible.length} daripada ${leads.length} lead kelihatan kepada anda`, `${visible.length} of ${leads.length} leads visible to you`)}
                  </span>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-[var(--color-surface-raised)] text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">{t("Lead", "Lead")}</th>
                      <th className="px-4 py-2.5 font-semibold">owner_user_id</th>
                      <th className="px-4 py-2.5 font-semibold">{t("Kelihatan kepada anda", "Visible to you")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {leads.slice(0, 50).map((lead) => {
                      const hidden = !isAdmin && lead.ownerUserId !== ownerId;
                      return (
                        <tr key={lead.id} className={cn(hidden && "text-muted-foreground")}>
                          <td className="px-4 py-2.5">
                            <strong className="font-semibold text-[var(--color-text)]">{lead.name}</strong>
                            <span className="block text-[12px] text-muted-foreground">
                              {lead.id} · {lead.destination ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--color-text-secondary)]">
                              {lead.ownerUserId}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {hidden ? (
                              <Pill tone="neutral">{t("Ditapis daripada senarai", "Filtered out of list")}</Pill>
                            ) : (
                              <Pill tone="success">
                                <Check className="h-3 w-3" />
                                {t("Tersenarai", "Listed")}
                              </Pill>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {leads.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-[13px] text-muted-foreground">
                          {t("Belum ada lead lagi.", "No leads yet.")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHead title={t("Ujian guard kepemilikan", "Ownership guard test")} aside={<span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--color-text-secondary)]">requireOwnedLead()</span>} />
              <div className="flex flex-col gap-4 p-5">
                <p className="m-0 text-[12.5px] leading-relaxed text-muted-foreground">
                  {isAdmin
                    ? t(
                        "Anda ADMIN — anda boleh membuka sebarang lead. Sales hanya boleh membuka lead milik mereka sendiri.",
                        "You are ADMIN — you may open any lead. Sales users may only open their own.",
                      )
                    : t(
                        "Anda SALES — permintaan untuk lead bukan milik anda pulangkan mesej sama seperti lead yang tak wujud. Sistem tak akan dedahkan lead itu wujud atau tidak.",
                        "You are SALES — a request for a lead you don't own returns the same message as a lead that doesn't exist. The system won't reveal whether that lead is real.",
                      )}
                </p>
                <div className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 font-mono text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">
                  {isAdmin
                    ? `HTTP/1.1 200 OK — { "viewer": { "access": "ADMIN" } }`
                    : `HTTP/1.1 404 Not Found — { "error": { "code": "not_found" } }`}
                </div>
              </div>
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <Card>
              <CardHead title={t("Bahasa & zon waktu", "Language & time zone")} />
              <div className="flex flex-col gap-3 p-5">
                <Row label={t("Fail locale", "Locale files")} value={<span className="inline-flex gap-1.5"><Code>en</Code><Code>ms</Code></span>} />
                <Row label={t("Locale lalai", "Default locale")} value={<strong className="text-[13px] font-semibold">English (en)</strong>} />
                <Row label={t("Dikecualikan", "Excluded")} value={<Pill tone="danger">id — tidak dihantar</Pill>} />
                <div className="border-t border-[var(--color-border)] pt-3">
                  <Row label={t("Zon waktu", "Time zone")} value={<Code>Asia/Kuala_Lumpur</Code>} />
                </div>
                <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">
                  {t(
                    "Semua tarikh akhir, senarai tertunggak dan masa eksport guna waktu Malaysia, tidak kira jam pada peranti anda.",
                    "All due dates, overdue lists and export times use Malaysia time, no matter what your device clock says.",
                  )}
                </p>
              </div>
            </Card>

            <Card>
              <CardHead title={t("Anda melihat sebagai", "You are viewing as")} />
              <div className="flex flex-col gap-3 p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[var(--color-primary)] text-[12px] font-semibold text-[var(--color-on-primary)]">
                    {session ? session.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() : "?"}
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-[13.5px] font-semibold text-[var(--color-text)]">
                      {session?.name ?? t("Staf", "Staff")}
                    </strong>
                    <span className="block truncate text-[12px] text-muted-foreground">{session?.email ?? ""}</span>
                  </span>
                </div>
                <dl className="m-0 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("Peranan", "Role")}</dt>
                    <dd className="m-0 mt-0.5 text-[13px] text-[var(--color-text)]">{session?.role ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("Akses", "Access")}</dt>
                    <dd className="m-0 mt-0.5 text-[13px] text-[var(--color-text)]">{access ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("Lead dimiliki", "Owned leads")}</dt>
                    <dd className="m-0 mt-0.5 text-[13px] text-[var(--color-text)]">{owned.length}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("Kelihatan", "Visible")}</dt>
                    <dd className="m-0 mt-0.5 text-[13px] text-[var(--color-text)]">{visible.length}</dd>
                  </div>
                </dl>
                <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">
                  {t(
                    "Akses & Kepemilikan guna sesi login yang sama; log keluar dari CRM juga log keluar anda di sini.",
                    "Access & Ownership uses the same login session; signing out of the CRM signs you out here too.",
                  )}
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-[var(--color-text-secondary)]">{label}</span>
      {value}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--color-text-secondary)]">{children}</span>;
}
