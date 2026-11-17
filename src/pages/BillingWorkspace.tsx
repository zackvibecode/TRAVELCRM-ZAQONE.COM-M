import { useMemo, useState } from "react";
import {
  Wallet,
  Banknote,
  AlertTriangle,
  Receipt,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  FileText,
  Undo2,
  ClipboardList,
  Send,
  ThumbsUp,
  ThumbsDown,
  XCircle,
  Copy,
  Ban,
  Bell,
} from "lucide-react";
import { mockInvoices, mockPayments, mockRefunds, mockQuotations } from "@/lib/mock-data";
import QuotationBuilder from "@/components/QuotationBuilder";
import InvoiceBuilder from "@/components/InvoiceBuilder";
import PaymentProofForm from "@/components/PaymentProofForm";
import RefundForm from "@/components/RefundForm";
import ReminderDashboard from "@/components/ReminderDashboard";
import type {
  Invoice,
  InvoiceStatus,
  Payment,
  PaymentReminder,
  Quotation,
  QuotationStatus,
  Refund,
  RefundStatus,
} from "@/lib/types";
import { cn, waLink , formatRinggit } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const INVOICE_STATUS_CLASS: Record<InvoiceStatus, string> = {
  draft: "bg-slate-50 text-slate-700 border-slate-200",
  issued: "bg-blue-50 text-blue-700 border-blue-200",
  partially_paid: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-green-50 text-green-700 border-green-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  void: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Transfer Bank",
  credit_card: "Kartu Kredit",
  cash: "Tunai",
  ewallet: "E-Wallet",
  other: "Lainnya",
};

const REFUND_STATUS_CLASS: Record<string, string> = {
  requested: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

const QUOTATION_STATUS_CLASS: Record<QuotationStatus, string> = {
  draft: "bg-slate-50 text-slate-700 border-slate-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

type Tab =
  | "invoices"
  | "quotations"
  | "payments"
  | "refunds"
  | "reminders";

export default function BillingWorkspace() {
  const { t } = useLang();
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
  const [quotations, setQuotations] = useState<Quotation[]>(mockQuotations);
  const [payments, setPayments] = useState<Payment[]>(mockPayments);
  const [refunds, setRefunds] = useState<Refund[]>(mockRefunds);
  const [reminders, setReminders] = useState<PaymentReminder[]>([]);
  const [tab, setTab] = useState<Tab>("invoices");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");
  const [quotationStatusFilter, setQuotationStatusFilter] = useState<
    "all" | QuotationStatus
  >("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showInvoiceBuilder, setShowInvoiceBuilder] = useState(false);
  const [recordPaymentFor, setRecordPaymentFor] = useState<Invoice | null>(
    null,
  );
  const [refundInvoiceFor, setRefundInvoiceFor] = useState<Invoice | null>(
    null,
  );

  const filteredInvoices = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter((inv) => {
      if (q) {
        if (
          !inv.number.toLowerCase().includes(q) &&
          !inv.customerName.toLowerCase().includes(q) &&
          !inv.bookingReference.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      return true;
    });
  }, [invoices, search, statusFilter]);

  const filteredQuotations = useMemo(() => {
    const q = search.toLowerCase();
    return quotations.filter((qt) => {
      if (q) {
        if (
          !qt.number.toLowerCase().includes(q) &&
          !qt.customerName.toLowerCase().includes(q) &&
          !qt.packageName.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (quotationStatusFilter !== "all" && qt.status !== quotationStatusFilter)
        return false;
      return true;
    });
  }, [quotations, search, quotationStatusFilter]);

  const filteredPayments = useMemo(() => {
    const q = search.toLowerCase();
    return payments.filter((p) => {
      if (!q) return true;
      return (
        p.invoiceNumber.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q)
      );
    });
  }, [payments, search]);

  const filteredRefunds = useMemo(() => {
    const q = search.toLowerCase();
    return refunds.filter((r) => {
      if (!q) return true;
      return (
        r.number.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q)
      );
    });
  }, [refunds, search]);

  const kpi = useMemo(() => {
    const active = invoices.filter((i) => i.status !== "void" && i.status !== "draft");
    const totalBilled = active.reduce((s, i) => s + i.total, 0);
    const collected = active.reduce((s, i) => s + i.paidAmount, 0);
    const outstanding = active.reduce((s, i) => s + i.balanceDue, 0);
    const overdue = invoices
      .filter((i) => i.status === "overdue")
      .reduce((s, i) => s + i.balanceDue, 0);
    return { totalBilled, collected, outstanding, overdue };
  }, [invoices]);

  const paymentsForInvoice = useMemo(() => {
    if (!selectedInvoice) return [];
    return payments.filter((p) => p.invoiceId === selectedInvoice.id);
  }, [selectedInvoice, payments]);

  function markInvoicePaid(invoiceId: string) {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        const paidAmount = inv.total;
        return {
          ...inv,
          status: "paid",
          paidAmount,
          balanceDue: 0,
        };
      }),
    );
    setSelectedInvoice(null);
  }

  function updateQuotationStatus(
    quotationId: string,
    status: QuotationStatus,
  ) {
    setQuotations((prev) =>
      prev.map((qt) => (qt.id === quotationId ? { ...qt, status } : qt)),
    );
  }

  function issueInvoice(invoiceId: string) {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId && inv.status === "draft"
          ? { ...inv, status: "issued" }
          : inv,
      ),
    );
  }

  function voidInvoice(invoiceId: string) {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId && inv.status !== "void"
          ? { ...inv, status: "void" }
          : inv,
      ),
    );
    setSelectedInvoice(null);
  }

  function duplicateInvoice(invoiceId: string) {
    const source = invoices.find((inv) => inv.id === invoiceId);
    if (!source) return;
    const seq = invoices.length + 1;
    const copy: Invoice = {
      ...source,
      id: crypto.randomUUID(),
      number: `INV-2026-${String(seq).padStart(4, "0")}`,
      status: "draft",
      paidAmount: 0,
      balanceDue: source.total,
      createdAt: new Date().toISOString(),
      notes: `Duplikat dari ${source.number}.`,
    };
    setInvoices((prev) => [copy, ...prev]);
  }

  function handlePaymentRecorded(
    invoice: Invoice,
    payment: Omit<Payment, "id" | "invoiceId" | "invoiceNumber" | "customerName">,
  ) {
    const newPayment: Payment = {
      ...payment,
      id: crypto.randomUUID(),
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      customerName: invoice.customerName,
    };
    setPayments((prev) => [newPayment, ...prev]);
    if (newPayment.status === "verified") {
      setInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id !== invoice.id) return inv;
          const paidAmount = inv.paidAmount + newPayment.amount;
          const balanceDue = Math.max(0, inv.total - paidAmount);
          return {
            ...inv,
            paidAmount,
            balanceDue,
            status:
              balanceDue === 0
                ? "paid"
                : paidAmount > 0
                  ? "partially_paid"
                  : inv.status,
          };
        }),
      );
    }
    setRecordPaymentFor(null);
    setSelectedInvoice((prev) =>
      prev && prev.id === invoice.id
        ? {
            ...prev,
            paidAmount:
              newPayment.status === "verified"
                ? prev.paidAmount + newPayment.amount
                : prev.paidAmount,
            balanceDue:
              newPayment.status === "verified"
                ? Math.max(0, prev.total - (prev.paidAmount + newPayment.amount))
                : prev.balanceDue,
          }
        : prev,
    );
  }

  function verifyPayment(paymentId: string, accepted: boolean) {
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment || payment.status !== "pending_verification") return;
    setPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId
          ? {
              ...p,
              status: accepted ? "verified" : "rejected",
              verifiedBy: accepted ? "Finance Team" : undefined,
            }
          : p,
      ),
    );
    if (accepted) {
      setInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id !== payment.invoiceId) return inv;
          const paidAmount = inv.paidAmount + payment.amount;
          const balanceDue = Math.max(0, inv.total - paidAmount);
          return {
            ...inv,
            paidAmount,
            balanceDue,
            status:
              balanceDue === 0
                ? "paid"
                : "partially_paid",
          };
        }),
      );
    }
  }

  function handleRefundCreated(
    invoice: Invoice,
    amount: number,
    reason: string,
  ) {
    const seq = refunds.length + 2;
    const refund: Refund = {
      id: crypto.randomUUID(),
      number: `CRN-2026-${String(seq).padStart(4, "0")}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      customerName: invoice.customerName,
      amount,
      reason,
      status: "requested",
      requestedAt: new Date().toISOString(),
    };
    setRefunds((prev) => [refund, ...prev]);
    setRefundInvoiceFor(null);
    setTab("refunds");
  }

  function updateRefundStatus(refundId: string, status: RefundStatus) {
    setRefunds((prev) =>
      prev.map((r) =>
        r.id === refundId
          ? {
              ...r,
              status,
              processedAt:
                status === "completed"
                  ? new Date().toISOString()
                  : r.processedAt,
            }
          : r,
      ),
    );
  }

  function handleReminderSent(reminder: PaymentReminder) {
    setReminders((prev) => [reminder, ...prev]);
  }

  function handleQuotationCreated(quotation: Quotation) {
    setQuotations((prev) => [quotation, ...prev]);
    setShowBuilder(false);
    setTab("quotations");
  }

  function handleInvoiceCreated(invoice: Invoice) {
    setInvoices((prev) => [invoice, ...prev]);
    setShowInvoiceBuilder(false);
    setTab("invoices");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("Billing & Pembayaran", "Billing & Payments")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "Invois, pembayaran, deposit, dan bayaran balik.",
              "Invoices, payments, deposits, and refunds.",
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowInvoiceBuilder(true)}
          >
            <Plus className="h-4 w-4" />
            {t("Buat Invois", "Create Invoice")}
          </Button>
          <Button className="gap-2" onClick={() => setShowBuilder(true)}>
            <Plus className="h-4 w-4" />
            {t("Buat Sebut Harga", "Create Quotation")}
          </Button>
        </div>
      </div>

      {/* Invoice builder (overlay mode) */}
      {showInvoiceBuilder && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">
              {t("Buat Invois Baharu", "Create New Invoice")}
            </h2>
            <Button
              variant="outline"
              onClick={() => setShowInvoiceBuilder(false)}
            >
              {t("Tutup", "Close")}
            </Button>
          </div>
          <InvoiceBuilder onCreated={handleInvoiceCreated} />
        </div>
      )}

      {/* Quotation builder (overlay mode) */}
      {showBuilder && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">
              {t("Buat Sebut Harga Baharu", "Create New Quotation")}
            </h2>
            <Button variant="outline" onClick={() => setShowBuilder(false)}>
              {t("Tutup", "Close")}
            </Button>
          </div>
          <QuotationBuilder onCreated={handleQuotationCreated} />
        </div>
      )}

      {!showBuilder && !showInvoiceBuilder && (
        <>
          {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <FileText className="h-4 w-4" /> {t("Jumlah Ditagih", "Total Billed")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-bold">
              {formatRupiah(kpi.totalBilled)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Wallet className="h-4 w-4" /> {t("Terkumpul", "Collected")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-bold text-green-600">
              {formatRupiah(kpi.collected)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Banknote className="h-4 w-4" /> {t("Baki Tertunggak", "Outstanding")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-bold text-amber-600">
              {formatRupiah(kpi.outstanding)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <AlertTriangle className="h-4 w-4" /> {t("Tertunggak", "Overdue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-bold text-red-600">
              {formatRupiah(kpi.overdue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center rounded-md border p-1">
          {(
            [
              ["invoices", t("Invois", "Invoices"), Receipt],
              ["quotations", t("Sebut Harga", "Quotations"), ClipboardList],
              ["payments", t("Pembayaran", "Payments"), Banknote],
              ["refunds", t("Bayaran Balik", "Refunds"), Undo2],
              ["reminders", t("Peringatan", "Reminders"), Bell],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => {
                setTab(value);
                setSelectedInvoice(null);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors",
                tab === value
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
          {tab === "invoices" && (
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | InvoiceStatus)
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">{t("Semua Status", "All Statuses")}</option>
              <option value="draft">Draft</option>
              <option value="issued">{t("Diterbitkan", "Issued")}</option>
              <option value="partially_paid">{t("Sebahagian", "Partial")}</option>
              <option value="paid">{t("Dibayar", "Paid")}</option>
              <option value="overdue">{t("Tertunggak", "Overdue")}</option>
              <option value="void">Void</option>
            </select>
          )}
          {tab === "quotations" && (
            <select
              value={quotationStatusFilter}
              onChange={(e) =>
                setQuotationStatusFilter(
                  e.target.value as "all" | QuotationStatus,
                )
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">{t("Semua Status", "All Statuses")}</option>
              <option value="draft">Draft</option>
              <option value="sent">{t("Dihantar", "Sent")}</option>
              <option value="accepted">{t("Diterima", "Accepted")}</option>
              <option value="rejected">{t("Ditolak", "Rejected")}</option>
              <option value="expired">{t("Tamat", "Expired")}</option>
            </select>
          )}
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={
                tab === "invoices"
                  ? t("Cari no. invois, pelanggan, tempahan...", "Search invoice no., customer, booking...")
                  : t("Cari rujukan atau pelanggan...", "Search reference or customer...")
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Invoices tab */}
      {tab === "invoices" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Nombor", "Number")}</TableHead>
                    <TableHead>{t("Pelanggan", "Customer")}</TableHead>
                    <TableHead>{t("Pakej", "Package")}</TableHead>
                    <TableHead>{t("Jatuh Tempo", "Due Date")}</TableHead>
                    <TableHead>{t("Jumlah", "Total")}</TableHead>
                    <TableHead>{t("Dibayar", "Paid")}</TableHead>
                  <TableHead>{t("Baki", "Balance")}</TableHead>
                  <TableHead>{t("Status", "Status")}</TableHead>
                  <TableHead className="text-right">{t("Tindakan", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((inv) => (
                  <TableRow
                    key={inv.id}
                    className={cn(
                      "cursor-pointer",
                      selectedInvoice?.id === inv.id && "bg-muted/50",
                    )}
                    onClick={() =>
                      setSelectedInvoice(
                        selectedInvoice?.id === inv.id ? null : inv,
                      )
                    }
                  >
                    <TableCell className="font-medium">
                      {inv.number}
                    </TableCell>
                    <TableCell>{inv.customerName}</TableCell>
                    <TableCell className="max-w-48 truncate text-xs text-muted-foreground">
                      {inv.packageName}
                    </TableCell>
                    <TableCell className="text-xs">{inv.dueDate}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatRupiah(inv.total)}
                    </TableCell>
                    <TableCell className="text-sm text-green-600">
                      {formatRupiah(inv.paidAmount)}
                    </TableCell>
                    <TableCell className="text-sm text-amber-600">
                      {formatRupiah(inv.balanceDue)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={INVOICE_STATUS_CLASS[inv.status]}
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {inv.status === "draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1"
                            onClick={() => issueInvoice(inv.id)}
                          >
                            <Send className="h-3.5 w-3.5" />
                            Terbitkan
                          </Button>
                        )}
                        {inv.status !== "void" && inv.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 border-red-200 text-red-700 hover:bg-red-50"
                            onClick={() => voidInvoice(inv.id)}
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Void
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground"
                          title="Duplikat invoice"
                          onClick={() => duplicateInvoice(inv.id)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                  {filteredInvoices.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Tidak ada invoice yang cocok.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Invoice detail panel */}
          {selectedInvoice && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-lg font-bold">
                    {selectedInvoice.number}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={INVOICE_STATUS_CLASS[selectedInvoice.status]}
                  >
                    {selectedInvoice.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-[11px] text-muted-foreground">{t("Pelanggan", "Customer")}</p>
                    <p className="text-xs font-medium">
                      {selectedInvoice.customerName}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[11px] text-muted-foreground">{t("Tempahan", "Booking")}</p>
                    <p className="text-xs font-medium">
                      {selectedInvoice.bookingReference}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[11px] text-muted-foreground">
                      Diterbitkan
                    </p>
                    <p className="text-xs font-medium">
                      {selectedInvoice.issueDate}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[11px] text-muted-foreground">
                      Jatuh Tempo
                    </p>
                    <p className="text-xs font-medium">
                      {selectedInvoice.dueDate}
                    </p>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("Butiran Item", "Item Details")}
                  </p>
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("Penerangan", "Description")}</TableHead>
                          <TableHead className="text-center">Qty</TableHead>
                          <TableHead className="text-right">{t("Harga Seunit", "Unit Price")}</TableHead>
                          <TableHead className="text-right">{t("Jumlah", "Amount")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedInvoice.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs">
                              {item.description}
                            </TableCell>
                            <TableCell className="text-center text-xs">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {formatRupiah(item.unitPrice)}
                            </TableCell>
                            <TableCell className="text-right text-xs font-medium">
                              {formatRupiah(item.quantity * item.unitPrice)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatRupiah(selectedInvoice.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("Diskaun", "Discount")}</span>
                      <span className="text-green-600">
                        -{formatRupiah(selectedInvoice.discount)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-1.5 font-semibold">
                      <span>{t("Jumlah", "Total")}</span>
                      <span>{formatRupiah(selectedInvoice.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("Deposit", "Deposit")}</span>
                      <span>{formatRupiah(selectedInvoice.depositAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("Dibayar", "Paid")}</span>
                      <span className="text-green-600">
                        {formatRupiah(selectedInvoice.paidAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold text-primary">
                      <span>{t("Baki Tertunggak", "Balance Due")}</span>
                      <span>{formatRupiah(selectedInvoice.balanceDue)}</span>
                    </div>
                  </div>
                </div>

                {/* Payments for this invoice */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Riwayat Pembayaran
                  </p>
                  {paymentsForInvoice.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                      Belum ada pembayaran.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {paymentsForInvoice.map((p) => (
                        <div
                          key={p.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                        >
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">
                              {formatRupiah(p.amount)} •{" "}
                              {PAYMENT_METHOD_LABEL[p.method]}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {p.paidAt}
                              {p.reference ? ` • Ref: ${p.reference}` : ""}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              p.status === "verified"
                                ? "border-green-200 bg-green-50 text-green-700"
                                : p.status === "pending_verification"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-red-200 bg-red-50 text-red-700",
                            )}
                          >
                            {p.status === "verified" ? (
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                            ) : (
                              <Clock className="mr-1 h-3 w-3" />
                            )}
                            {p.status === "verified"
                              ? "Terverifikasi"
                              : p.status === "pending_verification"
                                ? "Menunggu Verifikasi"
                                : "Ditolak"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedInvoice.notes && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                      Catatan
                    </p>
                    <p className="text-sm">{selectedInvoice.notes}</p>
                  </div>
                )}

                {selectedInvoice.status !== "paid" &&
                  selectedInvoice.status !== "void" && (
                    <div className="flex flex-wrap justify-end gap-2">
                      {selectedInvoice.status === "draft" && (
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={() => issueInvoice(selectedInvoice.id)}
                        >
                          <Send className="h-4 w-4" />
                          Terbitkan
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => markInvoicePaid(selectedInvoice.id)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Tandai Lunas
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => setRecordPaymentFor(selectedInvoice)}
                      >
                        <Banknote className="h-4 w-4" />
                        Catat Pembayaran
                      </Button>
                      {selectedInvoice.paidAmount > 0 && (
                        <Button
                          variant="outline"
                          className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                          onClick={() => setRefundInvoiceFor(selectedInvoice)}
                        >
                          <Undo2 className="h-4 w-4" />
                          Refund
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="gap-2 border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => voidInvoice(selectedInvoice.id)}
                      >
                        <Ban className="h-4 w-4" />
                        Void
                      </Button>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}

          {/* Record payment form */}
          {recordPaymentFor && (
            <PaymentProofForm
              invoice={recordPaymentFor}
              onRecorded={handlePaymentRecorded}
              onCancel={() => setRecordPaymentFor(null)}
            />
          )}

          {/* Refund / credit note form */}
          {refundInvoiceFor && (
            <RefundForm
              invoice={refundInvoiceFor}
              onCreated={handleRefundCreated}
              onCancel={() => setRefundInvoiceFor(null)}
            />
          )}
        </div>
      )}

      {/* Quotations tab */}
      {tab === "quotations" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Nombor", "Number")}</TableHead>
                  <TableHead>{t("Pelanggan", "Customer")}</TableHead>
                  <TableHead>{t("Pakej", "Package")}</TableHead>
                  <TableHead>Pax</TableHead>
                  <TableHead>{t("Keberangkatan", "Departure")}</TableHead>
                  <TableHead>{t("Jumlah", "Total")}</TableHead>
                  <TableHead>{t("Sah sehingga", "Valid until")}</TableHead>
                  <TableHead>{t("Status", "Status")}</TableHead>
                  <TableHead className="text-right">{t("Tindakan", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotations.map((qt) => (
                  <TableRow key={qt.id}>
                    <TableCell className="font-medium">{qt.number}</TableCell>
                    <TableCell>
                      <p className="text-sm">{qt.customerName}</p>
                      <a
                        href={waLink(qt.customerPhone)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-green-600 hover:underline"
                      >
                        WhatsApp
                      </a>
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-xs text-muted-foreground">
                      {qt.packageName}
                    </TableCell>
                    <TableCell className="text-xs">
                      {qt.paxAdult + qt.paxChild + qt.paxInfant} pax
                    </TableCell>
                    <TableCell className="text-xs">{qt.departureDate}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatRupiah(qt.total)}
                    </TableCell>
                    <TableCell className="text-xs">{qt.validUntil}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={QUOTATION_STATUS_CLASS[qt.status]}
                      >
                        {qt.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {qt.status === "draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1"
                            onClick={() =>
                              updateQuotationStatus(qt.id, "sent")
                            }
                          >
                              <Send className="h-3.5 w-3.5" />
                              {t("Hantar", "Send")}
                            </Button>
                        )}
                        {qt.status === "sent" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 border-green-200 text-green-700 hover:bg-green-50"
                              onClick={() =>
                                updateQuotationStatus(qt.id, "accepted")
                              }
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                              {t("Terima", "Accept")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 border-red-200 text-red-700 hover:bg-red-50"
                              onClick={() =>
                                updateQuotationStatus(qt.id, "rejected")
                              }
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                              {t("Tolak", "Reject")}
                            </Button>
                          </>
                        )}
                        {qt.status === "accepted" && (
                          <Button
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() =>
                              updateQuotationStatus(qt.id, "accepted")
                            }
                            title="Convert ke booking & invoice (backend phase)"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {t("Tukar", "Convert")}
                          </Button>
                        )}
                        {(qt.status === "rejected" ||
                          qt.status === "expired") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-muted-foreground"
                            onClick={() =>
                              updateQuotationStatus(qt.id, "draft")
                            }
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            {t("Buka Semula", "Reopen")}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredQuotations.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t("Tiada quotation sepadan.", "No matching quotations.")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Payments tab */}
      {tab === "payments" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Invois", "Invoice")}</TableHead>
                  <TableHead>{t("Pelanggan", "Customer")}</TableHead>
                  <TableHead>{t("Kaedah", "Method")}</TableHead>
                  <TableHead>{t("Jumlah", "Amount")}</TableHead>
                  <TableHead>{t("Tarikh", "Date")}</TableHead>
                  <TableHead>{t("Bukti", "Proof")}</TableHead>
                  <TableHead>{t("Status", "Status")}</TableHead>
                  <TableHead className="text-right">{t("Tindakan", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.invoiceNumber}
                    </TableCell>
                    <TableCell>{p.customerName}</TableCell>
                    <TableCell className="text-xs">
                      {PAYMENT_METHOD_LABEL[p.method]}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatRupiah(p.amount)}
                    </TableCell>
                    <TableCell className="text-xs">{p.paidAt}</TableCell>
                    <TableCell>
                      {p.proofUploaded ? (
                        <Badge variant="secondary">{t("Ada", "Yes")}</Badge>
                      ) : (
                        <Badge variant="outline">{t("Tiada", "No")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          p.status === "verified"
                            ? "border-green-200 bg-green-50 text-green-700"
                            : p.status === "pending_verification"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-red-200 bg-red-50 text-red-700",
                        )}
                      >
                        {p.status === "verified"
                          ? t("Disahkan", "Verified")
                          : p.status === "pending_verification"
                            ? t("Menunggu Pengesahan", "Pending Verification")
                            : t("Ditolak", "Rejected")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.status === "pending_verification" && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 border-green-200 text-green-700 hover:bg-green-50"
                            onClick={() => verifyPayment(p.id, true)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t("Sahkan", "Verify")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 border-red-200 text-red-700 hover:bg-red-50"
                            onClick={() => verifyPayment(p.id, false)}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            {t("Tolak", "Reject")}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Refunds tab */}
      {tab === "refunds" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Nombor", "Number")}</TableHead>
                  <TableHead>{t("Invois", "Invoice")}</TableHead>
                  <TableHead>{t("Pelanggan", "Customer")}</TableHead>
                  <TableHead>{t("Jumlah", "Amount")}</TableHead>
                  <TableHead>{t("Sebab", "Reason")}</TableHead>
                  <TableHead>{t("Diminta", "Requested")}</TableHead>
                  <TableHead>{t("Status", "Status")}</TableHead>
                  <TableHead className="text-right">{t("Tindakan", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRefunds.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.number}</TableCell>
                    <TableCell className="text-xs">
                      {r.invoiceNumber}
                    </TableCell>
                    <TableCell>{r.customerName}</TableCell>
                    <TableCell className="text-sm font-medium text-red-600">
                      {formatRupiah(r.amount)}
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-xs text-muted-foreground">
                      {r.reason}
                    </TableCell>
                    <TableCell className="text-xs">{r.requestedAt}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={REFUND_STATUS_CLASS[r.status]}
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {r.status === "requested" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1"
                              onClick={() =>
                                updateRefundStatus(r.id, "processing")
                              }
                            >
                              <Clock className="h-3.5 w-3.5" />
                              {t("Proses", "Process")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 border-red-200 text-red-700 hover:bg-red-50"
                              onClick={() =>
                                updateRefundStatus(r.id, "rejected")
                              }
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              {t("Tolak", "Reject")}
                            </Button>
                          </>
                        )}
                        {r.status === "processing" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 border-green-200 text-green-700 hover:bg-green-50"
                            onClick={() =>
                              updateRefundStatus(r.id, "completed")
                            }
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t("Selesaikan", "Complete")}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRefunds.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t("Belum ada bayaran balik / credit note.", "No refunds / credit notes yet.")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Reminders tab */}
      {tab === "reminders" && (
        <ReminderDashboard
          invoices={invoices}
          reminders={reminders}
          onSent={handleReminderSent}
        />
      )}
        </>
      )}
    </div>
  );
}
