import { useState } from "react";
import { Save } from "lucide-react";
import type { Invoice } from "@/lib/types";
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
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

interface RefundFormProps {
  invoice: Invoice;
  onCreated: (invoice: Invoice, amount: number, reason: string) => void;
  onCancel: () => void;
}

export default function RefundForm({
  invoice,
  onCreated,
  onCancel,
}: RefundFormProps) {
  const maxRefund = invoice.paidAmount;
  const [amount, setAmount] = useState(maxRefund);
  const [reason, setReason] = useState("");

  const valid = amount > 0 && amount <= maxRefund && reason.trim().length > 0;

  return (
    <Card className="border-2 border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base font-bold">
            Buat Refund / Credit Note — {invoice.number}
          </CardTitle>
          <Badge variant="secondary">
            Dibayar: {formatRupiah(invoice.paidAmount)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Jumlah Refund (Rp) *
            </label>
            <Input
              type="number"
              min={0}
              max={maxRefund}
              value={amount || ""}
              onChange={(e) =>
                setAmount(Math.max(0, Number(e.target.value) || 0))
              }
            />
            {amount > maxRefund && (
              <p className="text-xs text-red-500">
                Melebihi total yang sudah dibayar.
              </p>
            )}
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            Refund hanya bisa dilakukan untuk dana yang sudah dibayar customer
            (maks {formatRupiah(maxRefund)}).
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Alasan *
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="cth. Pembatalan trip, pembayaran ganda, kompensasi..."
            className="min-h-20"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Batal
          </Button>
          <Button
            disabled={!valid}
            onClick={() => onCreated(invoice, amount, reason.trim())}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Ajukan Refund
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
