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
} from "lucide-react";
import { mockInvoices, mockPayments, mockRefunds, mockQuotations } from "@/lib/mock-data";
import QuotationBuilder from "@/components/QuotationBuilder";
import InvoiceBuilder from "@/components/InvoiceBuilder";
import type { Invoice, InvoiceStatus, Quotation, QuotationStatus } from "@/lib/types";
import { cn, waLink } from "@/lib/utils";
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
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
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

type Tab = "invoices" | "quotations" | "payments" | "refunds";

export default function BillingWorkspace() {
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
  const [quotations, setQuotations] = useState<Quotation[]>(mockQuotations);
  const [tab, setTab] = useState<Tab>("invoices");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");
  const [quotationStatusFilter, setQuotationStatusFilter] = useState<
    "all" | QuotationStatus
  >("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showInvoiceBuilder, setShowInvoiceBuilder] = useState(false);

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
    return mockPayments.filter((p) => {
      if (!q) return true;
      return (
        p.invoiceNumber.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q)
      );
    });
  }, [search]);

  const filteredRefunds = useMemo(() => {
    const q = search.toLowerCase();
    return mockRefunds.filter((r) => {
      if (!q) return true;
      return (
        r.number.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q)
      );
    });
  }, [search]);

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
    return mockPayments.filter((p) => p.invoiceId === selectedInvoice.id);
  }, [selectedInvoice]);

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
            Billing &amp; Payments
          </h1>
          <p className="text-sm text-muted-foreground">
            Invoice, pembayaran, deposit, dan refund.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowInvoiceBuilder(true)}
          >
            <Plus className="h-4 w-4" />
            Buat Invoice
          </Button>
          <Button className="gap-2" onClick={() => setShowBuilder(true)}>
            <Plus className="h-4 w-4" />
            Buat Quotation
          </Button>
        </div>
      </div>

      {/* Invoice builder (overlay mode) */}
      {showInvoiceBuilder && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">
              Buat Invoice Baru
            </h2>
            <Button
              variant="outline"
              onClick={() => setShowInvoiceBuilder(false)}
            >
              Tutup
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
              Buat Quotation Baru
            </h2>
            <Button variant="outline" onClick={() => setShowBuilder(false)}>
              Tutup
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
              <FileText className="h-4 w-4" /> Total Ditagih
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
              <Wallet className="h-4 w-4" /> Terkumpul
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
              <Banknote className="h-4 w-4" /> Outstanding
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
              <AlertTriangle className="h-4 w-4" /> Overdue
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
              ["invoices", "Invoices", Receipt],
              ["quotations", "Quotations", ClipboardList],
              ["payments", "Payments", Banknote],
              ["refunds", "Refunds", Undo2],
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
              <option value="all">Semua Status</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="partially_paid">Partial</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
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
              <option value="all">Semua Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </select>
          )}
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={
                tab === "invoices"
                  ? "Cari no. invoice, customer, booking..."
                  : "Cari referensi atau customer..."
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
                    <TableHead>Nomor</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Paket</TableHead>
                    <TableHead>Jatuh Tempo</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Dibayar</TableHead>
                  <TableHead>Sisa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
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
                    <p className="text-[11px] text-muted-foreground">Customer</p>
                    <p className="text-xs font-medium">
                      {selectedInvoice.customerName}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[11px] text-muted-foreground">Booking</p>
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
                    Rincian Item
                  </p>
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Deskripsi</TableHead>
                          <TableHead className="text-center">Qty</TableHead>
                          <TableHead className="text-right">Harga Satuan</TableHead>
                          <TableHead className="text-right">Jumlah</TableHead>
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
                      <span className="text-muted-foreground">Diskon</span>
                      <span className="text-green-600">
                        -{formatRupiah(selectedInvoice.discount)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-1.5 font-semibold">
                      <span>Total</span>
                      <span>{formatRupiah(selectedInvoice.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Deposit</span>
                      <span>{formatRupiah(selectedInvoice.depositAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dibayar</span>
                      <span className="text-green-600">
                        {formatRupiah(selectedInvoice.paidAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold text-primary">
                      <span>Sisa Tagihan</span>
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
        </div>
      )}

      {/* Quotations tab */}
      {tab === "quotations" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nomor</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Paket</TableHead>
                  <TableHead>Pax</TableHead>
                  <TableHead>Berangkat</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Berlaku s.d.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
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
                            Kirim
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
                              Terima
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
                              Tolak
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
                            Convert
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
                            Reopen
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
                      Tidak ada quotation yang cocok.
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
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Bukti</TableHead>
                  <TableHead>Status</TableHead>
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
                        <Badge variant="secondary">Ada</Badge>
                      ) : (
                        <Badge variant="outline">Tidak</Badge>
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
                          ? "Terverifikasi"
                          : p.status === "pending_verification"
                            ? "Menunggu Verifikasi"
                            : "Ditolak"}
                      </Badge>
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
                  <TableHead>Nomor</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Diminta</TableHead>
                  <TableHead>Status</TableHead>
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
                  </TableRow>
                ))}
                {filteredRefunds.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Belum ada refund / credit note.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
        </>
      )}
    </div>
  );
}
