import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  MessageCircle,
  X,
  User as UserIcon,
  MapPin,
  Users as UsersIcon,
  Wallet,
  History,
  CalendarClock,
} from "lucide-react";
import {
  LEAD_STAGES,
  type Lead,
  type LeadActivity,
  type LeadStage,
} from "@/lib/types";
import { Button } from "@/components/ui/button";

const ACTIVITY_ICONS: Record<LeadActivity["type"], string> = {
  note: "📝",
  call: "📞",
  whatsapp: "💬",
  email: "✉️",
  stage_change: "➡️",
};

const ACTIVITY_TYPE_OPTIONS: LeadActivity["type"][] = [
  "note",
  "call",
  "whatsapp",
  "email",
];

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface LeadDetailDrawerProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStageChange: (leadId: string, stage: LeadStage) => void;
  onAssigneeChange: (leadId: string, assignee: string) => void;
  onFollowUpChange: (leadId: string, date: string | null) => void;
  onActivityAdd: (
    leadId: string,
    type: LeadActivity["type"],
    text: string,
  ) => void;
  assignees: string[];
}

export default function LeadDetailDrawer({
  lead,
  open,
  onOpenChange,
  onStageChange,
  onAssigneeChange,
  onFollowUpChange,
  onActivityAdd,
  assignees,
}: LeadDetailDrawerProps) {
  const [stage, setStage] = useState<LeadStage | "">("");
  const [assignee, setAssignee] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [activityType, setActivityType] =
    useState<LeadActivity["type"]>("note");
  const [activityText, setActivityText] = useState("");

  useEffect(() => {
    if (lead) {
      setStage(lead.stage);
      setAssignee(lead.assignedTo);
      setFollowUp(lead.nextFollowUp ?? "");
      setActivityText("");
      setActivityType("note");
    }
  }, [lead]);

  if (!lead) return null;

  const stageDirty = stage !== lead.stage;
  const assigneeDirty = assignee !== lead.assignedTo;
  const followUpDirty = followUp !== (lead.nextFollowUp ?? "");

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l bg-background shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b p-5">
            <div className="space-y-1">
              <DialogPrimitive.Title className="font-display text-lg font-bold tracking-tight">
                {lead.name}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                {lead.destination} • dibuat {formatDateTime(lead.createdAt)}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="rounded-md p-1 opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            {/* Quick facts */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <UserIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Telepon</p>
                  <p className="truncate text-xs font-medium">{lead.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Email</p>
                  <p className="truncate text-xs font-medium">{lead.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Destinasi</p>
                  <p className="truncate text-xs font-medium">
                    {lead.destination}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <UsersIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Pax</p>
                  <p className="truncate text-xs font-medium">{lead.pax} orang</p>
                </div>
              </div>
              <div className="col-span-2 flex items-center gap-2 rounded-lg border p-3">
                <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Budget</p>
                  <p className="text-xs font-semibold text-primary">
                    {formatRupiah(lead.budget)}
                  </p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {lead.notes && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                  Catatan
                </p>
                <p className="text-sm">{lead.notes}</p>
              </div>
            )}

            {/* Stage control */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pipeline Stage
              </p>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as LeadStage)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {LEAD_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Agent assignment */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sales Agent
              </p>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {assignees.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Follow-up reminder */}
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <CalendarClock className="h-4 w-4" /> Follow-up Berikutnya
              </p>
              <input
                type="date"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>

            {/* Add activity */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tambah Aktivitas
              </p>
              <div className="flex gap-2">
                <select
                  value={activityType}
                  onChange={(e) =>
                    setActivityType(e.target.value as LeadActivity["type"])
                  }
                  className="h-9 shrink-0 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {ACTIVITY_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {ACTIVITY_ICONS[t]}{" "}
                      {t === "note"
                        ? "Catatan"
                        : t === "call"
                          ? "Telepon"
                          : t === "whatsapp"
                            ? "WhatsApp"
                            : "Email"}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Ringkasan aktivitas..."
                  value={activityText}
                  onChange={(e) => setActivityText(e.target.value)}
                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                />
                <Button
                  variant="outline"
                  disabled={!activityText.trim()}
                  onClick={() => {
                    onActivityAdd(
                      lead.id,
                      activityType,
                      activityText.trim(),
                    );
                    setActivityText("");
                  }}
                >
                  Tambah
                </Button>
              </div>
            </div>

            {/* Activity timeline */}
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <History className="h-4 w-4" /> Aktivitas
              </p>
              {lead.activities.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Belum ada aktivitas.
                </p>
              ) : (
                <div className="space-y-3">
                  {[...lead.activities].reverse().map((activity) => (
                    <div
                      key={activity.id}
                      className="flex gap-3 rounded-lg border p-3"
                    >
                      <span className="text-base leading-none">
                        {ACTIVITY_ICONS[activity.type]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{activity.text}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {activity.user} • {formatDateTime(activity.at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center gap-2 border-t p-4">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                window.open(
                  `https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`,
                  "_blank",
                )
              }
            >
              <MessageCircle className="h-4 w-4 text-green-600" />
              WhatsApp
            </Button>
            <Button
              className="ml-auto"
              disabled={!stageDirty && !assigneeDirty && !followUpDirty}
              onClick={() => {
                if (stageDirty) onStageChange(lead.id, stage as LeadStage);
                if (assigneeDirty) onAssigneeChange(lead.id, assignee);
                if (followUpDirty)
                  onFollowUpChange(lead.id, followUp || null);
                onOpenChange(false);
              }}
            >
              Simpan Perubahan
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
