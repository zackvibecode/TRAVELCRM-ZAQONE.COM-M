import { useMemo, useState } from "react";
import { Eye, Plus, Save, Trash2 } from "lucide-react";
import type { InvoiceItem, Quotation } from "@/lib/types";
import { formatRinggit } from "@/lib/utils";
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

interface QuotationBuilderProps {
  onCreated?: (quotation: Quotation) => void;
}

export default function QuotationBuilder({
  onCreated,
}: QuotationBuilderProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [packageName, setPackageName] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [paxAdult, setPaxAdult] = useState(2);
  const [paxChild, setPaxChild] = useState(0);
  const [paxInfant, setPaxInfant] = useState(0);
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [discount, setDiscount] = useState(0);
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
    const quotation: Quotation = {
      id: crypto.randomUUID(),
      number: `QTN-DRAFT-${Date.now().toString().slice(-4)}`,
      customerName,
      customerPhone,
      packageName,
      destination,
      paxAdult,
      paxChild,
      paxInfant,
      departureDate,
      status: "draft",
      validUntil,
      subtotal,
      discount,
      total,
      createdBy: "Anda",
      createdAt: new Date().toISOString(),
      notes,
    };
    onCreated?.(quotation);
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
              Informasi Customer
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
                placeholder="cth. Agus Wibowo"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                No. WhatsApp
              </label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+62 8xx-xxxx-xxxx"
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
                Destinasi
              </label>
              <Input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="cth. Japan"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Tgl Berangkat
              </label>
              <Input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base font-bold">
              Jumlah Pax
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            {(
              [
                ["Dewasa", paxAdult, setPaxAdult],
                ["Anak", paxChild, setPaxChild],
                ["Bayi", paxInfant, setPaxInfant],
              ] as const
            ).map(([label, value, setter]) => (
              <div key={label} className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {label}
                </label>
                <Input
                  type="number"
                  min={0}
                  value={value}
                  onChange={(e) =>
                    setter(Math.max(0, Number(e.target.value) || 0))
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base font-bold">
                Rincian Harga
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
                    placeholder="cth. Land tour 5D4N"
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
                  Berlaku s.d.
                </label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
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
                placeholder="Termasuk tiket, hotel bintang 4, breakfast..."
                className="min-h-20"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <div>
        <div className="sticky top-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Eye className="h-4 w-4" />
            Preview Quotation
          </div>
          <Card className="border-2 border-dashed">
            <CardHeader className="border-b pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-lg font-bold">
                    ZAQONE TRAVEL CRM
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Penawaran Perjalanan
                  </p>
                </div>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                  draft
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] text-muted-foreground">Ditujukan kepada</p>
                  <p className="font-medium">{customerName || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Paket</p>
                  <p className="font-medium">{packageName || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Tgl Berangkat
                  </p>
                  <p className="font-medium">{departureDate || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Berlaku s.d.
                  </p>
                  <p className="font-medium">{validUntil || "—"}</p>
                </div>
              </div>

              <div className="rounded-lg border p-3 text-sm">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Jumlah Pax
                </p>
                <p>
                  {paxAdult} Dewasa • {paxChild} Anak • {paxInfant} Bayi
                </p>
              </div>

              <div className="space-y-1.5">
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
                      <div
                        key={idx}
                        className="flex justify-between text-sm"
                      >
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

              <div className="space-y-1.5 border-t pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Diskon</span>
                  <span className="text-green-600">
                    -{formatRupiah(discount)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatRupiah(total)}</span>
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
                Simpan Draft Quotation
              </Button>
              {saved && (
                <p className="text-center text-xs text-green-600">
                  ✓ Draft tersimpan (mock) — silakan lanjut ke tab Quotations.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
