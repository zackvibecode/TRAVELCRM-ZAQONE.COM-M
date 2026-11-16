import { useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Clock,
  MessageCircle,
  Send,
} from "lucide-react";
import type { Invoice, PaymentReminder, ReminderChannel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
}

interface ReminderDashboardProps {
  invoices: Invoice[];
  reminders: PaymentReminder[];
  onSent: (reminder: PaymentReminder) => void;
}

export default function ReminderDashboard({
  invoices,
  reminders,
  onSent,
}: ReminderDashboardProps) {
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [channel, setChannel] = useState<ReminderChannel>("whatsapp");
  const [message, setMessage] = useState("");

  // Invoices that need reminding: not void/draft, still has balance,
  // due within 30 days or already overdue.
  const needsReminder = useMemo(() => {
    return invoices
      .filter(
        (inv) =>
          inv.status !== "void" &&
          inv.status !== "draft" &&
          inv.balanceDue > 0,
      )
      .map((inv) => ({ inv, days: daysUntil(inv.dueDate) }))
      .filter(({ days }) => days <= 30)
      .sort((a, b) => a.days - b.days);
  }, [invoices]);

  const defaultTemplate = (inv: Invoice) =>
    `Halo ${inv.customerName}, ini pengingat pembayaran untuk invoice ${inv.number} (${inv.packageName}). Sisa tagihan: ${formatRupiah(inv.balanceDue)}, jatuh tempo ${inv.dueDate}. Terima kasih!`;

  function handleSelect(inv: Invoice) {
    setSelected(inv);
    setMessage(defaultTemplate(inv));
  }

  function handleSend() {
    if (!selected || !message.trim()) return;
    const reminder: PaymentReminder = {
      id: crypto.randomUUID(),
      invoiceId: selected.id,
      invoiceNumber: selected.number,
      customerName: selected.customerName,
      channel,
      message: message.trim(),
      sentAt: new Date().toISOString(),
      sentBy: "Finance Team",
    };
    onSent(reminder);
    if (channel === "whatsapp") {
      const digits = "6281234567890"; // placeholder customer phone in mock
      window.open(
        `https://wa.me/${digits}?text=${encodeURIComponent(message.trim())}`,
        "_blank",
      );
    }
    setSelected(null);
    setMessage("");
  }

  const remindersForInvoice = (invoiceId: string) =>
    reminders.filter((r) => r.invoiceId === invoiceId);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Needs-reminder list */}
      <div className="space-y-4 lg:col-span-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Bell className="h-4 w-4" />
          Invoice Perlu Reminder ({needsReminder.length})
        </div>
        {needsReminder.length === 0 ? (
          <Card>
            <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
              Semua tagihan sehat — tidak ada yang perlu diingatkan.
            </CardContent>
          </Card>
        ) : (
          needsReminder.map(({ inv, days }) => {
            const sentCount = remindersForInvoice(inv.id).length;
            const overdue = days < 0;
            return (
              <Card
                key={inv.id}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-muted/40",
                  selected?.id === inv.id && "border-primary bg-muted/50",
                )}
                onClick={() => handleSelect(inv)}
              >
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="space-y-0.5">
                    <p className="font-mono text-sm font-medium">
                      {inv.number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {inv.customerName} • sisa{" "}
                      {formatRupiah(inv.balanceDue)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {sentCount > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {sentCount}x terkirim
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        overdue
                          ? "border-red-200 bg-red-50 text-red-700"
                          : days <= 7
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-slate-200 bg-slate-50 text-slate-700",
                      )}
                    >
                      <Clock className="mr-1 h-3 w-3" />
                      {overdue
                        ? `Lewat ${Math.abs(days)} hari`
                        : days === 0
                          ? "Jatuh tempo hari ini"
                          : `${days} hari lagi`}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Composer + history */}
      <div className="space-y-4 lg:col-span-2">
        {selected ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base font-bold">
                Kirim Reminder — {selected.number}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {(
                  [
                    ["whatsapp", "WhatsApp"],
                    ["email", "Email"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setChannel(value)}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-2 text-sm transition-colors",
                      channel === value
                        ? "border-primary bg-primary text-white"
                        : "text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Pesan (bisa diedit)
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-32"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelected(null);
                    setMessage("");
                  }}
                >
                  Batal
                </Button>
                <Button
                  className="gap-2"
                  disabled={!message.trim()}
                  onClick={handleSend}
                >
                  <Send className="h-4 w-4" />
                  Kirim &amp; Catat
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              Pilih invoice di kiri untuk mengirim reminder.
            </CardContent>
          </Card>
        )}

        {/* Reminder history */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base font-bold">
              Riwayat Reminder ({reminders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reminders.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Belum ada reminder terkirim.
              </p>
            ) : (
              reminders.slice(0, 8).map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border p-3 text-xs"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">
                      {r.invoiceNumber} • {r.customerName}
                    </span>
                    <Badge variant="secondary">
                      {r.channel === "whatsapp" ? "WhatsApp" : "Email"}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-muted-foreground">
                    {r.message}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {r.sentAt} • oleh {r.sentBy}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
