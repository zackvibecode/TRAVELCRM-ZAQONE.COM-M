import { useState } from "react";
import { Paperclip, Save } from "lucide-react";
import type { Invoice, Payment, PaymentMethod } from "@/lib/types";
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

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "bank_transfer", label: "Transfer Bank" },
  { value: "credit_card", label: "Kartu Kredit" },
  { value: "cash", label: "Tunai" },
  { value: "ewallet", label: "E-Wallet" },
  { value: "other", label: "Lainnya" },
];

interface PaymentProofFormProps {
  invoice: Invoice;
  onRecorded: (invoice: Invoice, payment: Payment) => void;
  onCancel: () => void;
}

export default function PaymentProofForm({
  invoice,
  onRecorded,
  onCancel,
}: PaymentProofFormProps) {
  const [amount, setAmount] = useState(invoice.balanceDue);
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [proofFileName, setProofFileName] = useState<string | null>(null);
  const [markVerified, setMarkVerified] = useState(false);

  const valid = amount > 0 && amount <= invoice.balanceDue;

  function handleSubmit() {
    if (!valid) return;
    const payment: Payment = {
      id: crypto.randomUUID(),
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      customerName: invoice.customerName,
      amount,
      method,
      status: markVerified ? "verified" : "pending_verification",
      paidAt: new Date().toISOString(),
      verifiedBy: markVerified ? "Finance Team" : undefined,
      proofUploaded: proofFileName !== null,
      reference: reference || undefined,
      notes: notes || undefined,
    };
    onRecorded(invoice, payment);
  }

  return (
    <Card className="border-2 border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base font-bold">
            Catat Pembayaran — {invoice.number}
          </CardTitle>
          <Badge variant="secondary">
            Sisa: {formatRupiah(invoice.balanceDue)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Jumlah (RM) *
            </label>
            <Input
              type="number"
              min={0}
              max={invoice.balanceDue}
              value={amount || ""}
              onChange={(e) =>
                setAmount(Math.max(0, Number(e.target.value) || 0))
              }
            />
            {amount > invoice.balanceDue && (
              <p className="text-xs text-red-500">
                Melebihi sisa tagihan.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Metode
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              No. Referensi
            </label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="cth. TRF-881234"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Bukti Transfer
            </label>
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed border-input px-3 text-xs text-muted-foreground hover:bg-muted/50">
              <Paperclip className="h-3.5 w-3.5" />
              {proofFileName ?? "Unggah bukti (mock)"}
              <input
                type="file"
                className="hidden"
                onChange={(e) =>
                  setProofFileName(
                    e.target.files?.[0]?.name ?? null,
                  )
                }
              />
            </label>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Catatan
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="cth. Transfer BCA pagi ini"
            className="min-h-16"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={markVerified}
            onChange={(e) => setMarkVerified(e.target.checked)}
            className="h-4 w-4"
          />
          Langsung verifikasi (sudah cek mutasi bank)
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Batal
          </Button>
          <Button disabled={!valid} onClick={handleSubmit} className="gap-2">
            <Save className="h-4 w-4" />
            Simpan Pembayaran
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
