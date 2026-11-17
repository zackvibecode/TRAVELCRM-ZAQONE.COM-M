import { useState } from "react";
import { Save } from "lucide-react";
import type { Invoice } from "@/lib/types";
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
  const { t } = useLang();
  const maxRefund = invoice.paidAmount;
  const [amount, setAmount] = useState(maxRefund);
  const [reason, setReason] = useState("");

  const valid = amount > 0 && amount <= maxRefund && reason.trim().length > 0;

  return (
    <Card className="border-2 border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base font-bold">
            {t("Buat Bayaran Balik / Credit Note", "Create Refund / Credit Note")} — {invoice.number}
          </CardTitle>
          <Badge variant="secondary">
            {t("Dibayar", "Paid")}: {formatRupiah(invoice.paidAmount)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Jumlah Bayaran Balik (RM) *
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
                {t("Melebihi jumlah yang sudah dibayar.", "Exceeds the amount already paid.")}
              </p>
            )}
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            {t(
              "Bayaran balik hanya boleh dilakukan untuk dana yang sudah dibayar oleh pelanggan (maks",
              "Refunds can only be issued for funds already paid by the customer (max",
            )}{" "}
            {formatRupiah(maxRefund)}).
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("Sebab", "Reason")} *
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t(
              "cth. Pembatalan trip, pembayaran berganda, pampasan...",
              "e.g. Trip cancellation, double payment, compensation...",
            )}
            className="min-h-20"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t("Batal", "Cancel")}
          </Button>
          <Button
            disabled={!valid}
            onClick={() => onCreated(invoice, amount, reason.trim())}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {t("Ajukan Bayaran Balik", "Submit Refund")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
