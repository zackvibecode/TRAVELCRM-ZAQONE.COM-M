import { useMemo } from "react";
import {
  AlertCircle,
  Clock,
  MessageCircle,
  FileWarning,
  CheckCircle2,
} from "lucide-react";
import {
  mockInvoices,
  mockLeads,
  mockPayments,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

interface AlertItem {
  id: string;
  kind: "overdue" | "pending_payment" | "follow_up";
  title: string;
  detail: string;
  meta: string;
}

const KIND_STYLES = {
  overdue: {
    icon: AlertCircle,
    iconClass: "text-red-600 bg-red-50",
    labelKey: ["Tertunggak", "Overdue"] as const,
    labelClass: "border-red-200 bg-red-50 text-red-700",
  },
  pending_payment: {
    icon: Clock,
    iconClass: "text-amber-600 bg-amber-50",
    labelKey: ["Menunggu Pengesahan", "Pending Verification"] as const,
    labelClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  follow_up: {
    icon: MessageCircle,
    iconClass: "text-blue-600 bg-blue-50",
    labelKey: ["Susulan", "Follow-up"] as const,
    labelClass: "border-blue-200 bg-blue-50 text-blue-700",
  },
} as const;

export default function AlertsPanel() {
  const { t } = useLang();

  const alerts = useMemo<AlertItem[]>(() => {
    const items: AlertItem[] = [];
    const today = new Date().toISOString().slice(0, 10);

    // 1. Overdue invoices with outstanding balance.
    for (const inv of mockInvoices) {
      if (
        inv.balanceDue > 0 &&
        inv.status !== "void" &&
        inv.status !== "draft" &&
        inv.dueDate < today
      ) {
        items.push({
          id: `overdue-${inv.id}`,
          kind: "overdue",
          title: `${inv.number} — ${inv.customerName}`,
          detail: `Sisa ${formatRupiah(inv.balanceDue)} jatuh tempo ${inv.dueDate}`,
          meta: inv.packageName ?? "Invoice",
        });
      }
    }

    // 2. Payments pending verification.
    for (const p of mockPayments) {
      if (p.status === "pending_verification") {
        const inv = mockInvoices.find((i) => i.id === p.invoiceId);
        items.push({
          id: `pending-${p.id}`,
          kind: "pending_payment",
          title: `${formatRupiah(p.amount)} — ${p.customerName}`,
          detail: `Metode ${p.method.replace("_", " ")} menunggu verifikasi finance`,
          meta: inv?.number ?? p.invoiceNumber,
        });
      }
    }

    // 3. Lead follow-ups due today or overdue.
    for (const lead of mockLeads) {
      if (
        !["won", "lost"].includes(lead.stage) &&
        lead.nextFollowUp &&
        lead.nextFollowUp <= today
      ) {
        items.push({
          id: `followup-${lead.id}`,
          kind: "follow_up",
          title: `${lead.name} — ${lead.assignedTo}`,
          detail: `Follow-up ${lead.nextFollowUp === today ? "hari ini" : `terlambat (${lead.nextFollowUp})`}`,
          meta: lead.destination || "Lead",
        });
      }
    }

    // Overdue first, then pending payments, then follow-ups.
    const order = { overdue: 0, pending_payment: 1, follow_up: 2 };
    return items.sort((a, b) => order[a.kind] - order[b.kind]);
  }, []);

  const overdueCount = alerts.filter((a) => a.kind === "overdue").length;
  const pendingCount = alerts.filter((a) => a.kind === "pending_payment").length;
  const followUpCount = alerts.filter((a) => a.kind === "follow_up").length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">{t("Perlu Perhatian", "Needs Attention")}</CardTitle>
        <FileWarning className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {/* Summary chips */}
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { label: t("Tertunggak", "Overdue"), count: overdueCount, class: "border-red-200 bg-red-50 text-red-700" },
            { label: t("Pengesahan", "Verify"), count: pendingCount, class: "border-amber-200 bg-amber-50 text-amber-700" },
            { label: t("Susulan", "Follow-up"), count: followUpCount, class: "border-blue-200 bg-blue-50 text-blue-700" },
          ].map((chip) => (
            <span
              key={chip.label}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                chip.count > 0
                  ? chip.class
                  : "border-muted bg-muted/40 text-muted-foreground",
              )}
            >
              {chip.count} {chip.label}
            </span>
          ))}
        </div>

        {alerts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium">{t("Semua beres!", "All clear!")}</p>
            <p className="text-xs text-muted-foreground">
              {t(
                "Tiada invois tertunggak, pembayaran tertunda, atau susulan terlewat.",
                "No overdue invoices, pending payments, or missed follow-ups.",
              )}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {alerts.slice(0, 8).map((alert) => {
              const style = KIND_STYLES[alert.kind];
              return (
                <li
                  key={alert.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <div className={cn("rounded-lg p-2", style.iconClass)}>
                    <style.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {alert.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {alert.detail}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      style.labelClass,
                    )}
                  >
                    {t(style.labelKey[0], style.labelKey[1])}
                  </span>
                </li>
              );
            })}
            {alerts.length > 8 && (
              <li className="pt-1 text-center text-xs text-muted-foreground">
                +{alerts.length - 8} {t("lagi", "more")}
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
