import { useMemo, useState } from "react";
import {
  FileText,
  Download,
  Printer,
  BarChart3,
  Wallet,
  Users,
  BedDouble,
} from "lucide-react";
import { mockBookings, mockInvoices, mockLeads } from "@/lib/mock-data";
import { cn , formatRinggit } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatRupiah(value: number): string {
  return formatRinggit(value);
}

type ReportKind = "sales" | "finance" | "occupancy" | "staff";

interface ReportColumn {
  key: string;
  label: string;
  align?: "right";
}

const REPORTS: Record<
  ReportKind,
  {
    labelMs: string;
    labelEn: string;
    descMs: string;
    descEn: string;
    icon: typeof BarChart3;
  }
> = {
  sales: {
    labelMs: "Laporan Jualan",
    labelEn: "Sales Report",
    descMs: "Tempahan, nilai transaksi, dan pembayaran setiap bulan",
    descEn: "Bookings, transaction value, and monthly payments",
    icon: BarChart3,
  },
  finance: {
    labelMs: "Laporan Kewangan",
    labelEn: "Finance Report",
    descMs: "Invois, kutipan, baki tertunggak, dan bayaran balik",
    descEn: "Invoices, collections, outstanding balances, and refunds",
    icon: Wallet,
  },
  occupancy: {
    labelMs: "Laporan Okupansi",
    labelEn: "Occupancy Report",
    descMs: "Pax terisi setiap pakej dan status keberangkatan",
    descEn: "Pax filled per package and departure status",
    icon: BedDouble,
  },
  staff: {
    labelMs: "Laporan Staf",
    labelEn: "Staff Report",
    descMs: "Aktiviti dan sumbangan setiap ejen",
    descEn: "Activity and contribution per agent",
    icon: Users,
  },
};

function buildRows(
  kind: ReportKind,
): { columns: ReportColumn[]; rows: Record<string, string | number>[] } {
  if (kind === "sales") {
    const byMonth = new Map<string, Record<string, string | number>>();
    for (const b of mockBookings) {
      if (b.status === "cancelled") continue;
      const month = b.createdAt.slice(0, 7);
      const entry =
        byMonth.get(month) ?? { month, bookings: 0, gross: 0, paid: 0 };
      entry.bookings = (entry.bookings as number) + 1;
      entry.gross = (entry.gross as number) + b.totalAmount;
      entry.paid = (entry.paid as number) + b.paidAmount;
      byMonth.set(month, entry);
    }
    return {
      columns: [
        { key: "month", label: "Bulan" },
        { key: "bookings", label: "Booking", align: "right" },
        { key: "gross", label: "Nilai Transaksi", align: "right" },
        { key: "paid", label: "Terkumpul", align: "right" },
      ],
      rows: [...byMonth.values()].sort((a, b) =>
        String(a.month).localeCompare(String(b.month)),
      ),
    };
  }

  if (kind === "finance") {
    const rows = mockInvoices
      .filter((i) => i.status !== "draft")
      .map((i) => ({
        number: i.number,
        customer: i.customerName,
        status: i.status,
        total: i.total,
        paid: i.paidAmount,
        balance: i.balanceDue,
      }));
    return {
      columns: [
        { key: "number", label: "Invoice" },
        { key: "customer", label: "Customer" },
        { key: "status", label: "Status" },
        { key: "total", label: "Total", align: "right" },
        { key: "paid", label: "Dibayar", align: "right" },
        { key: "balance", label: "Sisa", align: "right" },
      ],
      rows,
    };
  }

  if (kind === "occupancy") {
    const byPkg = new Map<string, Record<string, string | number>>();
    for (const b of mockBookings) {
      if (b.status === "cancelled") continue;
      const entry =
        byPkg.get(b.packageName) ??
        { pkg: b.packageName, pax: 0, bookings: 0, lastDeparture: "—" };
      entry.pax = (entry.pax as number) + b.paxAdult + b.paxChild;
      entry.bookings = (entry.bookings as number) + 1;
      if (b.departureDate > String(entry.lastDeparture)) {
        entry.lastDeparture = b.departureDate;
      }
      byPkg.set(b.packageName, entry);
    }
    return {
      columns: [
        { key: "pkg", label: "Paket" },
        { key: "bookings", label: "Booking", align: "right" },
        { key: "pax", label: "Total Pax", align: "right" },
        { key: "lastDeparture", label: "Keberangkatan Terakhir" },
      ],
      rows: [...byPkg.values()],
    };
  }

  // staff
  const byAgent = new Map<string, Record<string, string | number>>();
  for (const l of mockLeads) {
    const entry =
      byAgent.get(l.assignedTo) ??
      { agent: l.assignedTo, leads: 0, won: 0, lost: 0, customers: 0 };
    entry.leads = (entry.leads as number) + 1;
    if (l.stage === "won") entry.won = (entry.won as number) + 1;
    if (l.stage === "lost") entry.lost = (entry.lost as number) + 1;
    byAgent.set(l.assignedTo, entry);
  }
  return {
    columns: [
      { key: "agent", label: "Agent" },
      { key: "leads", label: "Leads", align: "right" },
      { key: "won", label: "Won", align: "right" },
      { key: "lost", label: "Lost", align: "right" },
      { key: "customers", label: "Customers", align: "right" },
    ],
    rows: [...byAgent.values()],
  };
}

function toCSV(columns: ReportColumn[], rows: Record<string, string | number>[]): string {
  const header = columns.map((c) => `"${c.label}"`).join(",");
  const body = rows
    .map((r) =>
      columns.map((c) => `"${String(r[c.key] ?? "").replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  return `${header}\n${body}`;
}

export default function ReportsPage() {
  const { t } = useLang();
  const [kind, setKind] = useState<ReportKind>("sales");
  const report = useMemo(() => buildRows(kind), [kind]);
  const meta = REPORTS[kind];

  const handleExport = () => {
    const csv = toCSV(report.columns, report.rows);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("Laporan & Eksport", "Reports & Exports")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Pratonton laporan perniagaan dan muat turun sebagai CSV atau cetak PDF.",
            "Preview business reports and download as CSV or print to PDF.",
          )}
        </p>
      </div>

      {/* Report type picker */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(REPORTS) as ReportKind[]).map((key) => {
          const r = REPORTS[key];
          const active = kind === key;
          return (
            <button
              key={key}
              onClick={() => setKind(key)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                active
                  ? "border-red-300 bg-red-50"
                  : "hover:bg-muted/50",
              )}
            >
              <div className="flex items-center gap-2">
                <r.icon
                  className={cn(
                    "h-4 w-4",
                    active ? "text-red-600" : "text-muted-foreground",
                  )}
                />
                <span className="text-sm font-semibold">
                  {t(r.labelMs, r.labelEn)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(r.descMs, r.descEn)}
              </p>
            </button>
          );
        })}
      </div>

      {/* Preview */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">
              {t(meta.labelMs, meta.labelEn)} — {report.rows.length} {t("baris", "rows")}
            </CardTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              {t("Cetak", "Print")}
            </Button>
            <Button size="sm" onClick={handleExport}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {t("Eksport CSV", "Export CSV")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {report.columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={col.align === "right" ? "text-right" : ""}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((row, idx) => (
                <TableRow key={idx}>
                  {report.columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        col.align === "right" && "text-right tabular-nums",
                        col.key === "status" && "capitalize",
                      )}
                    >
                      {typeof row[col.key] === "number" &&
                      ["gross", "paid", "total", "balance"].includes(col.key)
                        ? formatRupiah(row[col.key] as number)
                        : String(row[col.key] ?? "—")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {report.rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={report.columns.length}
                    className="text-center text-muted-foreground"
                  >
                    {t("Tiada data.", "No data.")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
