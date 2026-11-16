import { useMemo, useState } from "react";
import {
  Users,
  Search,
  MessageCircle,
  Filter,
  LayoutGrid,
  List as ListIcon,
  Plus,
  TrendingUp,
  CalendarClock,
} from "lucide-react";
import { mockLeads } from "@/lib/mock-data";
import {
  LEAD_STAGES,
  type Lead,
  type LeadStage,
  type LeadSource,
} from "@/lib/types";
import { cn, waLink , formatRinggit } from "@/lib/utils";
import LeadDetailDrawer from "@/components/LeadDetailDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

const SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Website",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  referral: "Referral",
  walk_in: "Walk-in",
  campaign: "Campaign",
};

function formatRupiah(value: number): string {
  return formatRinggit(value);
}

function stageBadgeClass(stage: LeadStage): string {
  switch (stage) {
    case "new":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "contacted":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "qualified":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "quotation":
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    case "won":
      return "bg-green-50 text-green-700 border-green-200";
    case "lost":
      return "bg-red-50 text-red-700 border-red-200";
  }
}

export default function LeadsPipeline() {
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [view, setView] = useState<"board" | "list">("board");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId],
  );

  function openLead(lead: Lead) {
    setSelectedLeadId(lead.id);
    setDrawerOpen(true);
  }

  function handleStageChange(leadId: string, stage: LeadStage) {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              stage,
              activities: [
                ...l.activities,
                {
                  id: `la-${Date.now()}`,
                  at: new Date().toISOString(),
                  type: "stage_change" as const,
                  text: `${LEAD_STAGES.find((s) => s.value === l.stage)?.label} → ${LEAD_STAGES.find((s) => s.value === stage)?.label}`,
                  user: "Anda (Sales)",
                },
              ],
            }
          : l,
      ),
    );
  }

  function handleAssigneeChange(leadId: string, assignee: string) {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              assignedTo: assignee,
              activities: [
                ...l.activities,
                {
                  id: `la-${Date.now()}`,
                  at: new Date().toISOString(),
                  type: "note" as const,
                  text: `Lead di-assign ke ${assignee}.`,
                  user: "Anda (Sales)",
                },
              ],
            }
          : l,
      ),
    );
  }

  function handleFollowUpChange(leadId: string, date: string | null) {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              nextFollowUp: date ?? undefined,
              activities: [
                ...l.activities,
                {
                  id: `la-${Date.now()}`,
                  at: new Date().toISOString(),
                  type: "note" as const,
                  text: date
                    ? `Follow-up dijadwalkan: ${date}.`
                    : "Follow-up dihapus.",
                  user: "Anda (Sales)",
                },
              ],
            }
          : l,
      ),
    );
  }

  function handleActivityAdd(
    leadId: string,
    type: "note" | "call" | "whatsapp" | "email" | "stage_change",
    text: string,
  ) {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              activities: [
                ...l.activities,
                {
                  id: `la-${Date.now()}`,
                  at: new Date().toISOString(),
                  type,
                  text,
                  user: "Anda (Sales)",
                },
              ],
              lastActivityAt: new Date().toISOString(),
            }
          : l,
      ),
    );
  }

  // Follow-up reminders: open leads with follow-up today or overdue.
  const today = new Date().toISOString().slice(0, 10);
  const reminders = useMemo(
    () =>
      leads.filter(
        (l) =>
          l.stage !== "won" &&
          l.stage !== "lost" &&
          l.nextFollowUp &&
          l.nextFollowUp <= today,
      ),
    [leads, today],
  );

  const assignees = useMemo(
    () => Array.from(new Set(leads.map((l) => l.assignedTo))).sort(),
    [leads],
  );

  // Per-source summary: lead count + open pipeline value per source.
  const sourceSummary = useMemo(() => {
    const map = new Map<
      LeadSource,
      { count: number; openCount: number; pipelineValue: number; won: number }
    >();
    for (const lead of leads) {
      const entry = map.get(lead.source) ?? {
        count: 0,
        openCount: 0,
        pipelineValue: 0,
        won: 0,
      };
      entry.count += 1;
      if (lead.stage !== "won" && lead.stage !== "lost") {
        entry.openCount += 1;
        entry.pipelineValue += lead.budget;
      }
      if (lead.stage === "won") entry.won += 1;
      map.set(lead.source, entry);
    }
    return Object.entries(SOURCE_LABELS).map(([key, label]) => ({
      source: key as LeadSource,
      label,
      ...(map.get(key as LeadSource) ?? {
        count: 0,
        openCount: 0,
        pipelineValue: 0,
        won: 0,
      }),
    }));
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter((lead) => {
      if (q) {
        if (
          !lead.name.toLowerCase().includes(q) &&
          !lead.destination.toLowerCase().includes(q) &&
          !lead.phone.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (sourceFilter !== "all" && lead.source !== sourceFilter) return false;
      if (assigneeFilter !== "all" && lead.assignedTo !== assigneeFilter)
        return false;
      return true;
    });
  }, [leads, search, sourceFilter, assigneeFilter]);

  const byStage = useMemo(() => {
    const map = new Map<LeadStage, Lead[]>();
    for (const stage of LEAD_STAGES) map.set(stage.value, []);
    for (const lead of filtered) map.get(lead.stage)!.push(lead);
    return map;
  }, [filtered]);

  const kpi = useMemo(() => {
    const open = filtered.filter(
      (l) => l.stage !== "won" && l.stage !== "lost",
    );
    const won = filtered.filter((l) => l.stage === "won");
    const pipelineValue = open.reduce((s, l) => s + l.budget, 0);
    const conversion =
      won.length + filtered.filter((l) => l.stage === "lost").length > 0
        ? Math.round(
            (won.length /
              (won.length + filtered.filter((l) => l.stage === "lost").length)) *
              100,
          )
        : 0;
    const followUps = open.filter(
      (l) => l.nextFollowUp && l.nextFollowUp <= "2026-11-18",
    ).length;
    return {
      totalLeads: filtered.length,
      openLeads: open.length,
      pipelineValue,
      conversion,
      followUps,
    };
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Leads Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Track prospek dari enquiry hingga closing.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Lead
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Users className="h-4 w-4" /> Total Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-bold">{kpi.totalLeads}</p>
            <p className="text-xs text-muted-foreground">
              {kpi.openLeads} aktif
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4" /> Pipeline Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-bold">
              {formatRupiah(kpi.pipelineValue)}
            </p>
            <p className="text-xs text-muted-foreground">estimasi budget aktif</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4" /> Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-bold">{kpi.conversion}%</p>
            <p className="text-xs text-muted-foreground">won vs lost</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <CalendarClock className="h-4 w-4" /> Follow-up Dekat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-bold">{kpi.followUps}</p>
            <p className="text-xs text-muted-foreground">2 hari ke depan</p>
          </CardContent>
        </Card>
      </div>

      {/* Lead source summary / quick filter bar */}
      <div className="flex flex-wrap gap-2">
        {sourceSummary.map((s) => (
          <button
            key={s.source}
            onClick={() =>
              setSourceFilter(sourceFilter === s.source ? "all" : s.source)
            }
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors",
              sourceFilter === s.source
                ? "border-primary bg-primary text-white"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
            title={`${s.openCount} aktif • pipeline ${formatRupiah(s.pipelineValue)}`}
          >
            <span className="font-medium">{s.label}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                sourceFilter === s.source
                  ? "bg-white/20 text-white"
                  : "bg-muted text-foreground",
              )}
            >
              {s.count}
            </span>
            <span
              className={cn(
                "text-[10px]",
                sourceFilter === s.source
                  ? "text-white/80"
                  : "text-muted-foreground",
              )}
            >
              {s.won > 0 ? `${s.won} won` : formatRupiah(s.pipelineValue)}
            </span>
          </button>
        ))}
      </div>

      {/* Follow-up reminders */}
      {reminders.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="space-y-2 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <CalendarClock className="h-4 w-4" />
              Follow-up perlu tindakan ({reminders.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {reminders.map((lead) => {
                const overdue = lead.nextFollowUp! < today;
                return (
                  <button
                    key={lead.id}
                    onClick={() => openLead(lead)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      overdue
                        ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        : "border-amber-200 bg-amber-100/70 text-amber-800 hover:bg-amber-200/70",
                    )}
                  >
                    {lead.name} • {lead.destination}
                    <Badge
                      variant="outline"
                      className={cn(
                        "px-1.5 py-0 text-[10px]",
                        overdue
                          ? "border-red-300 bg-red-100 text-red-800"
                          : "border-amber-300 bg-amber-50 text-amber-800",
                      )}
                    >
                      {overdue
                        ? `Terlambat ${lead.nextFollowUp}`
                        : `Hari ini`}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama, destinasi, atau no. telepon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
          </div>
          <select
            value={sourceFilter}
            onChange={(e) =>
              setSourceFilter(e.target.value as LeadSource | "all")
            }
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Semua Source</option>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Semua Agent</option>
            {assignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <div className="ml-auto flex items-center rounded-md border p-1">
            <button
              onClick={() => setView("board")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-sm",
                view === "board"
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="h-4 w-4" /> Board
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-sm",
                view === "list"
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ListIcon className="h-4 w-4" /> List
            </button>
          </div>
        </div>
      </div>

      {/* Board view */}
      {view === "board" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {LEAD_STAGES.map((stage) => {
            const stageLeads = byStage.get(stage.value) ?? [];
            return (
              <div key={stage.value} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{stage.label}</span>
                  <Badge variant="secondary">{stageLeads.length}</Badge>
                </div>
                <div className="flex flex-col gap-3">
                  {stageLeads.map((lead) => (
                    <Card
                      key={lead.id}
                      className="cursor-pointer transition-shadow hover:shadow-md"
                      onClick={() => openLead(lead)}
                    >
                      <CardContent className="space-y-2 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-tight">
                            {lead.name}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 text-[10px]",
                              stageBadgeClass(lead.stage),
                            )}
                          >
                            {SOURCE_LABELS[lead.source]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {lead.destination} • {lead.pax} pax
                        </p>
                        <p className="text-xs font-medium">
                          {formatRupiah(lead.budget)}
                        </p>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-muted-foreground">
                            {lead.assignedTo}
                          </span>
                          <a
                            href={waLink(lead.phone)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/20"
                            title={`Chat WhatsApp ${lead.name}`}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        </div>
                        {lead.nextFollowUp && (
                          <p className="border-t pt-1.5 text-[11px] text-primary">
                            Follow-up: {lead.nextFollowUp}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                      Tidak ada lead
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Destinasi</TableHead>
                  <TableHead>Pax</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Follow-up</TableHead>
                  <TableHead className="text-right">WhatsApp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer"
                    onClick={() => openLead(lead)}
                  >
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs">{lead.phone}</span>
                        <span className="text-xs text-muted-foreground">
                          {lead.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{lead.destination}</TableCell>
                    <TableCell>{lead.pax}</TableCell>
                    <TableCell>{formatRupiah(lead.budget)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {SOURCE_LABELS[lead.source]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={stageBadgeClass(lead.stage)}
                      >
                        {LEAD_STAGES.find((s) => s.value === lead.stage)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {lead.assignedTo}
                    </TableCell>
                    <TableCell className="text-xs">
                      {lead.nextFollowUp ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={waLink(lead.phone)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/20"
                        title={`Chat WhatsApp ${lead.name}`}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Tidak ada lead yang cocok dengan filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Lead detail drawer */}
      <LeadDetailDrawer
        lead={selectedLead}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onStageChange={handleStageChange}
        onAssigneeChange={handleAssigneeChange}
        onFollowUpChange={handleFollowUpChange}
        onActivityAdd={handleActivityAdd}
        assignees={assignees}
      />
    </div>
  );
}
