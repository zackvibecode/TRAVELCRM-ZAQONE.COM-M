import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface KpiPayload {
  leads: { total: number; open: number; winRate: number };
  customers: { total: number };
  bookings: {
    active: number;
    confirmed: number;
    collected: number;
    outstanding: number;
  };
  payments: { collected: number };
  invoices: { overdueCount: number; overdueAmount: number };
}

export interface DashboardKpi {
  totalLeads: number;
  openLeads: number;
  winRate: number;
  totalCustomers: number;
  bookingCount: number;
  confirmedCount: number;
  collected: number;
  outstanding: number;
  overdueCount: number;
  overdueAmount: number;
}

/** Fetch authoritative dashboard KPIs from the Worker/D1. */
export function useDashboardKpi() {
  const [kpi, setKpi] = useState<DashboardKpi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch<KpiPayload>("/dashboard/kpi")
      .then((d) => {
        if (!active) return;
        setKpi({
          totalLeads: d.leads.total,
          openLeads: d.leads.open,
          winRate: d.leads.winRate,
          totalCustomers: d.customers.total,
          bookingCount: d.bookings.active,
          confirmedCount: d.bookings.confirmed,
          collected: d.bookings.collected,
          outstanding: d.bookings.outstanding,
          overdueCount: d.invoices.overdueCount,
          overdueAmount: d.invoices.overdueAmount,
        });
      })
      .catch(() => {
        // Keep null -> caller falls back to mock values.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { kpi, loading };
}
