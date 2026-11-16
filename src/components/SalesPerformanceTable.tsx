import { useMemo } from "react";
import { Trophy, Target, TrendingUp } from "lucide-react";
import { mockBookings, mockLeads } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
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

/** Monthly sales target per agent (Rp) — illustrative until the targets
 *  table lands in the backend phase. */
const AGENT_TARGETS: Record<string, number> = {
  "Rina (Sales)": 150_000_000,
  "Dewi (Sales)": 150_000_000,
  "Bagas (Sales)": 100_000_000,
};

const DEFAULT_TARGET = 100_000_000;

export default function SalesPerformanceTable() {
  const agents = useMemo(() => {
    const byAgent = new Map<
      string,
      {
        name: string;
        leads: number;
        openLeads: number;
        won: number;
        lost: number;
        pipelineValue: number;
        wonValue: number;
      }
    >();

    for (const lead of mockLeads) {
      const entry = byAgent.get(lead.assignedTo) ?? {
        name: lead.assignedTo,
        leads: 0,
        openLeads: 0,
        won: 0,
        lost: 0,
        pipelineValue: 0,
        wonValue: 0,
      };
      entry.leads += 1;
      if (lead.stage === "won") {
        entry.won += 1;
        entry.wonValue += lead.budget;
      } else if (lead.stage === "lost") {
        entry.lost += 1;
      } else {
        entry.openLeads += 1;
        entry.pipelineValue += lead.budget;
      }
      byAgent.set(lead.assignedTo, entry);
    }

    // Booking revenue attributed by createdBy.
    const revenueByAgent = new Map<string, number>();
    for (const b of mockBookings) {
      if (b.status === "cancelled") continue;
      const agent = b.createdBy ?? "Lainnya";
      revenueByAgent.set(agent, (revenueByAgent.get(agent) ?? 0) + b.paidAmount);
    }

    return [...byAgent.values()]
      .map((a) => ({
        ...a,
        revenue: revenueByAgent.get(a.name) ?? 0,
        target: AGENT_TARGETS[a.name] ?? DEFAULT_TARGET,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, []);

  const best = agents[0];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">
          Performa Sales Agent
        </CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Win Rate</TableHead>
              <TableHead className="text-right">Pipeline</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead>Target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => {
              const decided = agent.won + agent.lost;
              const winRate =
                decided > 0 ? Math.round((agent.won / decided) * 100) : 0;
              const targetPct = Math.min(
                100,
                Math.round((agent.revenue / agent.target) * 100),
              );
              return (
                <TableRow key={agent.name}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {agent.name}
                      {best && agent.name === best.name && (
                        <Trophy className="h-3.5 w-3.5 text-amber-500" />
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {agent.leads}
                    <span className="ml-1 text-[11px] text-muted-foreground">
                      ({agent.openLeads} aktif)
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {winRate}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRupiah(agent.pipelineValue)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatRupiah(agent.revenue)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            targetPct >= 100
                              ? "bg-emerald-500"
                              : targetPct >= 50
                                ? "bg-blue-500"
                                : "bg-amber-500",
                          )}
                          style={{ width: `${Math.max(targetPct, 3)}%` }}
                        />
                      </div>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Target className="h-3 w-3" />
                        {targetPct}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {agents.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  Belum ada data leads.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
