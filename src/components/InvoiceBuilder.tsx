import { useMemo, useState } from "react";
import { Eye, Plus, Save, Trash2 } from "lucide-react";
import type { Invoice, InvoiceItem } from "@/lib/types";
import { formatRinggit } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatRupiah(value: number): string {
  return formatRinggit(value);
}

interface InvoiceBuilderProps {
  onCreated?: (invoice: Invoice) => void;
}

export default function InvoiceBuilder({ onCreated }: InvoiceBuilderProps) {
  const { t } = useLang();
  const [customerName, setCustomerName] = useState("");
  const [bookingReference, setBookingReference] = useState("");
  const [packageName, setPackageName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
    [items],
  );
  const total = Math.max(0, subtotal - discount);

  function updateItem(idx: number, patch: Partial<InvoiceItem>) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
    );
  }

  function handleSave() {
    if (!customerName.trim()) return;
    const invoice: Invoice = {
      id: crypto.randomUUID(),
      number: `INV-DRAFT-${Date.now().toString().slice(-4)}`,
      bookingReference: bookingReference || "TRV-DRAFT",
      customerName,
      packageName,
      status: "draft",
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate,
      items: items.filter((i) => i.description),
      subtotal,
      discount,
      total,
      depositAmount: deposit,
      paidAmount: 0,
      balanceDue: total,
      notes,
      createdAt: new Date().toISOString(),
    };
    onCreated?.(invoice);
    setSaved(true);
  }

  const canSave = customerName.trim().length > 0 && total > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Form */}
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base font-bold">
              Informasi Invoice
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Nama Customer *
              </label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="cth. Budi Santoso"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Ref. Booking
              </label>
              <Input
                value={bookingReference}
                onChange={(e) => setBookingReference(e.target.value)}
                placeholder="TRV-2026-XXXX"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Paket
              </label>
              <Input
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder="cth. Japan Sakura Tour"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Jatuh Tempo
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base font-bold">
                Rincian Tagihan
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    { description: "", quantity: 1, unitPrice: 0 },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 items-end gap-2">
                <div className="col-span-6 space-y-1.5">
                  {idx === 0 && (
                    <label className="text-xs font-medium text-muted-foreground">
                      Deskripsi
                    </label>
                  )}
                  <Input
                    value={item.description}
                    onChange={(e) =>
                      updateItem(idx, { description: e.target.value })
                    }
                    placeholder="cth. Paket tour 5D4N"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  {idx === 0 && (
                    <label className="text-xs font-medium text-muted-foreground">
                      Qty
                    </label>
                  )}
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(idx, {
                        quantity: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                </div>
                <div className="col-span-3 space-y-1.5">
                  {idx === 0 && (
                    <label className="text-xs font-medium text-muted-foreground">
                      Harga
                    </label>
                  )}
                  <Input
                    type="number"
                    min={0}
                    value={item.unitPrice || ""}
                    onChange={(e) =>
                      updateItem(idx, {
                        unitPrice: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 w-9 p-0 text-red-500 hover:bg-red-50"
                    onClick={() =>
                      setItems((prev) =>
                        prev.length === 1
                          ? prev
                          : prev.filter((_, i) => i !== idx),
                      )
                    }
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Diskaun (RM)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={discount || ""}
                  onChange={(e) =>
                    setDiscount(Math.max(0, Number(e.target.value) || 0))
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Deposit (RM)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={deposit || ""}
                  onChange={(e) =>
                    setDeposit(Math.max(0, Number(e.target.value) || 0))
                  }
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Catatan
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("Syarat pembayaran, maklumat transfer...", "Payment terms, transfer info...")}
                className="min-h-20"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Receipt preview */}
      <div>
        <div className="sticky top-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Eye className="h-4 w-4" />
            Preview Invoice
          </div>
          <Card className="border-2 border-dashed bg-white">
            <CardHeader className="border-b border-dashed pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">
                    ZAQONE TRAVEL CRM
                  </p>
                  <p className="text-xs text-muted-foreground">
                    INVOICE
                  </p>
                </div>
                <div className="text-right">
                  <Badge
                    variant="outline"
                    className="border-slate-200 bg-slate-50 text-slate-700"
                  >
                    draft
                  </Badge>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {new Date().toISOString().slice(0, 10)}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Ditagihkan kepada
                  </p>
                  <p className="font-medium">{customerName || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Ref. Booking
                  </p>
                  <p className="font-medium">
                    {bookingReference || "TRV-2026-XXXX"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">{t("Pakej", "Package")}</p>
                  <p className="font-medium">{packageName || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Jatuh Tempo
                  </p>
                  <p className="font-medium">{dueDate || "—"}</p>
                </div>
              </div>

              <div className="space-y-1.5 border-t border-dashed pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Rincian
                </p>
                {items.every((i) => !i.description) ? (
                  <p className="text-xs text-muted-foreground">
                    Belum ada item — isi di form.
                  </p>
                ) : (
                  items
                    .filter((i) => i.description)
                    .map((i, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {i.description} × {i.quantity}
                        </span>
                        <span className="font-medium">
                          {formatRupiah(i.quantity * i.unitPrice)}
                        </span>
                      </div>
                    ))
                )}
              </div>

              <div className="space-y-1.5 border-t border-dashed pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("Diskaun", "Discount")}</span>
                  <span className="text-green-600">
                    -{formatRupiah(discount)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>{t("Jumlah Tagihan", "Total Due")}</span>
                  <span className="text-primary">{formatRupiah(total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("Deposit", "Deposit")}</span>
                  <span>{formatRupiah(deposit)}</span>
                </div>
              </div>

              {notes && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                    Catatan
                  </p>
                  <p className="text-sm">{notes}</p>
                </div>
              )}

              <Button
                className="w-full gap-2"
                disabled={!canSave}
                onClick={handleSave}
              >
                <Save className="h-4 w-4" />
                Simpan Draft Invoice
              </Button>
              {saved && (
                <p className="text-center text-xs text-green-600">
                  ✓ Draft invoice tersimpan (mock).
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
