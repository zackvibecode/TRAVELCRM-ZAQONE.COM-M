import { useEffect, useMemo, useRef, useState } from "react";
import {
  UsersRound,
  Sparkles,
  RefreshCw,
  BadgeCheck,
  Download,
  UserPlus,
  Search,
  ArrowRightLeft,
  CheckCircle2,
  X,
  MessageCircle,
  Wallet,
} from "lucide-react";
import { fetchBookings, fetchCustomers } from "@/lib/live-data";
import { apiFetch } from "@/lib/api";
import type { Booking, Customer } from "@/lib/types";
import { cn, waLink, formatRinggit } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

const STAGES = ["New", "Contacted", "Quotation", "Booking"];
const SOURCES = ["Instagram", "Website", "Referral", "WhatsApp", "Travel fair"];

type Stage = (typeof STAGES)[number];
type Tab = "lead" | "customer";

interface Lead {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  city: string;
  kind: "lead";
  stage: Stage;
  source: string;
  value: number;
  trip: string;
  owner: string;
  created: string;
  note: string;
  history: { text: string; time: string }[];
}

const INITIAL_LEADS: Lead[] = [
  { id: "l1", name: "Rani Kusuma", initials: "RK", email: "rani.kusuma@mail.my", phone: "012 334 5511", city: "Penang", kind: "lead", stage: "New", source: "Instagram", value: 4850, trip: "Langkawi 4D3N", owner: "Rizky Putra", created: "Today, 08:42", note: "Requested a Langkawi itinerary for a family of four.", history: [{ text: "Lead captured from the Instagram campaign", time: "Today, 08:42" }] },
  { id: "l2", name: "Dimas Prakoso", initials: "DP", email: "dimas.prakoso@mail.my", phone: "013 221 7788", city: "Kuala Lumpur", kind: "lead", stage: "Contacted", source: "Website", value: 6200, trip: "Perhentian 6D5N", owner: "Nadia Sari", created: "Yesterday, 15:10", note: "Called once, waiting to confirm the departure date.", history: [{ text: "6-minute call — asked about seat availability", time: "Yesterday, 16:20" }, { text: "Lead captured from the Perhentian destination form", time: "Yesterday, 15:10" }] },
  { id: "l3", name: "Siti Nurhaliza", initials: "SN", email: "siti.nur@mail.my", phone: "017 889 0022", city: "Johor Bahru", kind: "lead", stage: "Quotation", source: "Referral", value: 12400, trip: "Umrah 9D", owner: "Ayu Rahma", created: "12 Feb, 10:05", note: "Quotation sent, comparing two departure dates.", history: [{ text: "9D quotation emailed to the customer", time: "12 Feb, 14:00" }, { text: "Referral from existing customer Siti Rahmawati", time: "12 Feb, 10:05" }] },
  { id: "l4", name: "Adi Nugroho", initials: "AN", email: "adi.nugroho@mail.my", phone: "011 445 6677", city: "Ipoh", kind: "lead", stage: "Booking", source: "WhatsApp", value: 3750, trip: "Mount Bromo Sunrise", owner: "Rizky Putra", created: "11 Feb, 09:30", note: "Deposit received, balance due before 20 Feb.", history: [{ text: "RM 1,000 deposit received", time: "11 Feb, 13:15" }, { text: "Seats held for 2 passengers", time: "11 Feb, 10:02" }] },
];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function stagePill(stage: Stage | "Customer") {
  const map: Record<string, { bg: string; fg: string }> = {
    New: { bg: "var(--color-info-soft)", fg: "var(--color-info)" },
    Contacted: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
    Quotation: { bg: "var(--color-neutral-soft)", fg: "var(--color-text-secondary)" },
    Booking: { bg: "var(--color-success-soft)", fg: "var(--color-success)" },
    Customer: { bg: "var(--color-primary-soft)", fg: "var(--color-primary)" },
  };
  return map[stage] ?? map.New;
}

function MetricCard({ label, icon: Icon, value, note }: { label: string; icon: typeof UsersRound; value: string; note: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="font-display text-[24px] font-bold leading-tight tracking-tight [font-variant-numeric:tabular-nums]">{value}</span>
      <span className="text-[12px] text-muted-foreground">{note}</span>
    </div>
  );
}

export default function Customers() {
  const { t } = useLang();
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [tab, setTab] = useState<Tab>("customer");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("All sources");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>("l1");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", source: "Instagram", trip: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [c, b] = await Promise.all([fetchCustomers(), fetchBookings()]);
      if (cancelled) return;
      setAllCustomers(c.customers);
      setAllBookings(b.bookings);
    })();
    return () => { cancelled = true; };
  }, []);

  const bookingsByCustomer = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const booking of allBookings) {
      const list = map.get(booking.customerName) ?? [];
      list.push(booking);
      map.set(booking.customerName, list);
    }
    return map;
  }, [allBookings]);

  function statsFor(customer: Customer) {
    const bookings = bookingsByCustomer.get(customer.name) ?? [];
    const totalSpend = bookings.filter((b) => b.status !== "cancelled").reduce((s, b) => s + b.paidAmount, 0);
    const active = bookings.filter((b) => b.status === "confirmed" || b.status === "pending_deposit" || b.status === "hold").length;
    return { bookings, totalSpend, active };
  }

  const visibleLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((c) => {
      const matchQuery = !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || c.trip.toLowerCase().includes(q);
      const matchSource = source === "All sources" || c.source === source;
      return matchQuery && matchSource;
    });
  }, [leads, query, source]);

  const visibleCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCustomers.filter((c) =>
      !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    );
  }, [allCustomers, query]);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? visibleLeads[0] ?? null;
  const newLeads = leads.filter((l) => l.stage === "New").length;
  const inProgress = leads.filter((l) => l.stage === "Contacted" || l.stage === "Quotation").length;
  const pipelineValue = leads.reduce((s, l) => s + l.value, 0);
  const ringgit = (v: number) => `RM ${v.toLocaleString("en-MY")}`;

  function showNotice(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setNotice(message);
    toastTimer.current = setTimeout(() => setNotice(""), 4000);
  }

  function moveStage(next: Stage) {
    if (!selectedLead) return;
    setLeads((prev) => prev.map((l) => l.id === selectedLead.id ? {
      ...l, stage: next,
      history: [{ text: `Stage moved to ${next}`, time: "Just now" }, ...l.history],
    } : l));
    showNotice(`${selectedLead.name} moved to ${next}`);
  }

  function convertLead() {
    if (!selectedLead) return;
    const customer: Customer = {
      id: crypto.randomUUID(), name: selectedLead.name, phone: selectedLead.phone,
      email: selectedLead.email, type: "individual", city: selectedLead.city,
      joinedAt: new Date().toISOString().slice(0, 10), notes: selectedLead.note,
    };
    setAllCustomers((prev) => [customer, ...prev]);
    setLeads((prev) => prev.filter((l) => l.id !== selectedLead.id));
    setTab("customer");
    setSelectedCustomer(customer);
    showNotice(`${selectedLead.name} is now recorded as a customer`);
    void apiFetch("/customers", { method: "POST", body: JSON.stringify(customer) }).catch(() => {});
  }

  function submitLead(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.contact.trim()) next.contact = "Email or phone number is required";
    setErrors(next);
    if (Object.keys(next).length) return;
    const isEmail = form.contact.includes("@");
    const lead: Lead = {
      id: `l-${Date.now()}`, name: form.name.trim(), initials: initials(form.name),
      email: isEmail ? form.contact.trim() : "Not provided",
      phone: isEmail ? "Not provided" : form.contact.trim(), city: "Not provided",
      kind: "lead", stage: "New", source: form.source, value: 0,
      trip: form.trip || "Not decided", owner: "Ayu Rahma", created: "Just now",
      note: form.note || "No notes yet.",
      history: [{ text: "Lead added manually", time: "Just now" }],
    };
    setLeads((prev) => [lead, ...prev]);
    setTab("lead");
    setSelectedLeadId(lead.id);
    setQuery(""); setSource("All sources"); setFormOpen(false);
    setForm({ name: "", contact: "", source: "Instagram", trip: "", note: "" });
    showNotice(`${lead.name} added to the lead pipeline`);
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[22px] font-bold tracking-tight">{t("Pelanggan & Lead", "Customers & Leads")}</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {leads.length} {t("lead dalam pipeline", "leads in pipeline")} · {allCustomers.length} {t("pelanggan aktif", "active customers")} · {t("nilai pipeline", "pipeline value")} {ringgit(pipelineValue)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => showNotice("Contact list (CSV) is ready to download")} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-[13px] font-semibold hover:bg-[var(--color-surface-muted)]">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button type="button" onClick={() => { setErrors({}); setFormOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[var(--color-primary-hover)]">
            <UserPlus className="h-3.5 w-3.5" /> {t("Tambah Lead", "Add lead")}
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={t("Ringkasan kontak", "Contact summary")}>
        <MetricCard label={t("Jumlah Kontak", "Total contacts")} icon={UsersRound} value={String(leads.length + allCustomers.length)} note={t("Semua lead dan pelanggan", "All leads and customers")} />
        <MetricCard label={t("Lead Baharu", "New leads")} icon={Sparkles} value={String(newLeads)} note={t("Belum dihubungi", "Not contacted yet")} />
        <MetricCard label={t("Dalam Proses", "In progress")} icon={RefreshCw} value={String(inProgress)} note={t("Dihubungi & sebut harga", "Contacted and quoted")} />
        <MetricCard label={t("Pelanggan Aktif", "Active customers")} icon={BadgeCheck} value={String(allCustomers.length)} note={t("Pernah menempah", "Have booked before")} />
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="px-4 pt-4">
            <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)]" role="tablist">
              <button type="button" role="tab" aria-selected={tab === "lead"} onClick={() => setTab("lead")} className={cn("inline-flex items-center gap-2 border-b-2 border-transparent px-3 pb-3 pt-1.5 text-[13.5px] font-semibold text-muted-foreground hover:text-foreground", tab === "lead" && "border-[var(--color-primary)] text-[var(--color-primary)]")}>
                Leads <span className="rounded-full bg-[var(--color-neutral-soft)] px-1.5 text-[11px] font-bold">{leads.length}</span>
              </button>
              <button type="button" role="tab" aria-selected={tab === "customer"} onClick={() => setTab("customer")} className={cn("inline-flex items-center gap-2 border-b-2 border-transparent px-3 pb-3 pt-1.5 text-[13.5px] font-semibold text-muted-foreground hover:text-foreground", tab === "customer" && "border-[var(--color-primary)] text-[var(--color-primary)]")}>
                Customers <span className="rounded-full bg-[var(--color-neutral-soft)] px-1.5 text-[11px] font-bold">{allCustomers.length}</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2 py-3">
              <div className="flex min-w-0 max-w-[300px] flex-1 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Cari nama, emel, bandar…", "Search name, email, city…")} aria-label={t("Cari kontak", "Search contacts")} className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none" />
              </div>
              <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                Source
                <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-[13px]">
                  <option>All sources</option>
                  {SOURCES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
          </div>

          {tab === "lead" ? (
            visibleLeads.length === 0 ? (
              <div className="px-5 py-12 text-center text-muted-foreground">
                <p className="m-0 font-semibold text-foreground">{t("Tiada kontak sepadan", "No contacts match")}</p>
                <p className="mb-4 mt-1.5 text-[13px]">{t("Tukar kata kunci atau pilih sumber lain.", "Change the keyword or pick another source.")}</p>
                <button type="button" onClick={() => { setQuery(""); setSource("All sources"); }} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[12px] font-semibold">Reset filters</button>
              </div>
            ) : (
              <ul>
                {visibleLeads.map((lead) => {
                  const pill = stagePill(lead.stage);
                  return (
                    <li key={lead.id}>
                      <button type="button" onClick={() => setSelectedLeadId(lead.id)} aria-current={selectedLead?.id === lead.id ? "true" : undefined} className={cn("flex w-full items-center gap-3 border-b border-[var(--color-border)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--color-surface-raised)]", selectedLead?.id === lead.id && "bg-[var(--color-primary-soft)]")}>
                        <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[var(--color-neutral-soft)] text-[12px] font-bold text-[var(--color-text-secondary)]">{lead.initials}</span>
                        <div className="min-w-0 flex-1">
                          <p className="m-0 truncate text-[13.5px] font-semibold">{lead.name}</p>
                          <div className="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[11.5px] text-muted-foreground">
                            <span>{lead.trip}</span><span>{lead.source}</span><span className="max-md:hidden">{lead.owner}</span>
                          </div>
                        </div>
                        <div className="flex flex-none flex-col items-end gap-1.5">
                          <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: pill.bg, color: pill.fg }}>{lead.stage}</span>
                          <span className="text-[12px] font-semibold text-[var(--color-text-secondary)] [font-variant-numeric:tabular-nums]">{lead.value > 0 ? ringgit(lead.value) : "—"}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            visibleCustomers.length === 0 ? (
              <div className="px-5 py-12 text-center text-muted-foreground text-[13px]">{t("Tiada pelanggan sepadan.", "No customers match.")}</div>
            ) : (
              <ul>
                {visibleCustomers.map((customer) => {
                  const stats = statsFor(customer);
                  return (
                    <li key={customer.id}>
                      <button type="button" onClick={() => setSelectedCustomer(customer)} aria-current={selectedCustomer?.id === customer.id ? "true" : undefined} className={cn("flex w-full items-center gap-3 border-b border-[var(--color-border)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--color-surface-raised)]", selectedCustomer?.id === customer.id && "bg-[var(--color-primary-soft)]")}>
                        <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[var(--color-neutral-soft)] text-[12px] font-bold text-[var(--color-text-secondary)]">{initials(customer.name)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="m-0 truncate text-[13.5px] font-semibold">{customer.name}</p>
                          <div className="mt-0.5 flex flex-wrap gap-x-1.5 text-[11.5px] text-muted-foreground"><span>{customer.email}</span><span>{customer.city}</span></div>
                        </div>
                        <div className="flex flex-none flex-col items-end gap-1.5">
                          <span className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-primary)]">Customer</span>
                          <span className="text-[12px] font-semibold text-[var(--color-text-secondary)] [font-variant-numeric:tabular-nums]">{stats.totalSpend > 0 ? formatRinggit(stats.totalSpend) : "—"}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          )}
        </section>

        <aside className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          {tab === "lead" && selectedLead ? (
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-[var(--color-surface-muted)] text-[14px] font-bold text-[var(--color-primary)]">{selectedLead.initials}</span>
                <div className="min-w-0">
                  <p className="m-0 break-words text-[15px] font-bold">{selectedLead.name}</p>
                  <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: stagePill(selectedLead.stage).bg, color: stagePill(selectedLead.stage).fg }}>{selectedLead.stage}</span>
                </div>
              </div>
              <dl className="m-0 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
                <dt className="text-[12px] text-muted-foreground">Email</dt><dd className="m-0 break-words">{selectedLead.email}</dd>
                <dt className="text-[12px] text-muted-foreground">Phone</dt><dd className="m-0 [font-variant-numeric:tabular-nums]">{selectedLead.phone}</dd>
                <dt className="text-[12px] text-muted-foreground">City</dt><dd className="m-0">{selectedLead.city}</dd>
                <dt className="text-[12px] text-muted-foreground">Package</dt><dd className="m-0">{selectedLead.trip}</dd>
                <dt className="text-[12px] text-muted-foreground">Value</dt><dd className="m-0 [font-variant-numeric:tabular-nums]">{selectedLead.value > 0 ? ringgit(selectedLead.value) : "No value yet"}</dd>
                <dt className="text-[12px] text-muted-foreground">Source</dt><dd className="m-0">{selectedLead.source}</dd>
                <dt className="text-[12px] text-muted-foreground">Owner</dt><dd className="m-0">{selectedLead.owner}</dd>
              </dl>
              <div className="flex flex-col gap-1.5">
                <p className="m-0 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Notes</p>
                <p className="m-0 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{selectedLead.note}</p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="m-0 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Pipeline stage</p>
                <div className="flex flex-wrap gap-1.5">
                  {STAGES.map((stage) => (
                    <button key={stage} type="button" aria-pressed={selectedLead.stage === stage} onClick={() => moveStage(stage)} className={cn("rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-[12px] font-semibold hover:bg-[var(--color-surface-muted)]", selectedLead.stage === stage && "border-[var(--color-primary)] bg-[var(--color-primary)] text-white")}>
                      {stage}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={convertLead} className="mt-0.5 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[12px] font-semibold hover:bg-[var(--color-surface-muted)]">
                  <BadgeCheck className="h-3.5 w-3.5" /> Convert to customer
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <p className="m-0 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Activity</p>
                <ul className="m-0 flex flex-col gap-3 p-0">
                  {selectedLead.history.map((entry, i) => (
                    <li key={i} className="flex gap-2.5 text-[12.5px] text-[var(--color-text-secondary)]">
                      <ArrowRightLeft className="mt-0.5 h-3.5 w-3.5 flex-none text-muted-foreground" />
                      <div><span>{entry.text}</span><time className="mt-0.5 block text-[11px] text-muted-foreground">{entry.time}</time></div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : tab === "customer" && selectedCustomer ? (
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-[var(--color-surface-muted)] text-[14px] font-bold text-[var(--color-primary)]">{initials(selectedCustomer.name)}</span>
                <div className="min-w-0">
                  <p className="m-0 break-words text-[15px] font-bold">{selectedCustomer.name}</p>
                  <span className="mt-1 inline-block rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-primary)]">Customer</span>
                </div>
              </div>
              <dl className="m-0 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
                <dt className="text-[12px] text-muted-foreground">Email</dt><dd className="m-0 break-words">{selectedCustomer.email}</dd>
                <dt className="text-[12px] text-muted-foreground">Phone</dt><dd className="m-0 [font-variant-numeric:tabular-nums]">{selectedCustomer.phone}</dd>
                <dt className="text-[12px] text-muted-foreground">City</dt><dd className="m-0">{selectedCustomer.city ?? "—"}</dd>
                <dt className="text-[12px] text-muted-foreground">Spend</dt><dd className="m-0 font-semibold text-[var(--color-primary)] [font-variant-numeric:tabular-nums]">{formatRinggit(statsFor(selectedCustomer).totalSpend)}</dd>
                <dt className="text-[12px] text-muted-foreground">Bookings</dt><dd className="m-0">{statsFor(selectedCustomer).bookings.length}</dd>
              </dl>
              <a href={waLink(selectedCustomer.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-2 text-[12.5px] font-semibold text-green-700 hover:bg-green-500/20">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
              <div className="flex flex-col gap-2">
                <p className="m-0 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Booking history</p>
                {statsFor(selectedCustomer).bookings.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-[12px] text-muted-foreground">{t("Belum ada tempahan.", "No bookings yet.")}</p>
                ) : statsFor(selectedCustomer).bookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] p-3">
                    <div className="min-w-0"><p className="m-0 truncate text-[12.5px] font-semibold">{b.reference} — {b.packageName}</p><p className="m-0 text-[11px] text-muted-foreground">{b.departureDate}</p></div>
                    <Wallet className="h-3.5 w-3.5 flex-none text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 p-5">
              <p className="m-0 font-semibold">{t("Pilih kontak", "Select a contact")}</p>
              <p className="m-0 text-[13px] text-muted-foreground">{t("Butiran dan tindakan pipeline dipaparkan di sini.", "Lead details and pipeline actions appear here.")}</p>
            </div>
          )}
        </aside>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setFormOpen(false)}>
          <form onSubmit={submitLead} noValidate onClick={(e) => e.stopPropagation()} className="w-full max-w-[480px] overflow-hidden rounded-[var(--radius-panel)] bg-[var(--color-surface)] shadow-2xl">
            <div className="flex flex-col gap-4 p-5">
              <div>
                <h2 className="m-0 font-display text-[17px] font-bold">{t("Tambah Lead Baharu", "Add a new lead")}</h2>
                <p className="mb-0 mt-1 text-[12.5px] text-muted-foreground">{t("Lead bermula di peringkat New dan boleh ditindaklanjuti serta-merta.", "The lead starts in the New stage and can be followed up straight away.")}</p>
              </div>
              {[
                { key: "name", label: t("Nama Penuh", "Full name"), placeholder: "Prospect name" },
                { key: "contact", label: t("Emel atau Telefon", "Email or phone number"), placeholder: "name@mail.my or 012…" },
              ].map((f) => (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <label className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">{f.label}</label>
                  <input value={form[f.key as keyof typeof form]} onChange={(e) => setForm((c) => ({ ...c, [f.key]: e.target.value }))} placeholder={f.placeholder} aria-invalid={Boolean(errors[f.key])} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-border-strong)]" />
                  {errors[f.key] && <span className="text-[12px] text-[var(--color-danger)]">{errors[f.key]}</span>}
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">Source</label>
                  <select value={form.source} onChange={(e) => setForm((c) => ({ ...c, source: e.target.value }))} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[13px]">{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">{t("Pakej diminati", "Package of interest")}</label>
                  <input value={form.trip} onChange={(e) => setForm((c) => ({ ...c, trip: e.target.value }))} placeholder="e.g. Langkawi 4D3N" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[13px] outline-none" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">Notes</label>
                <textarea rows={3} value={form.note} onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))} placeholder="Requirements, travellers, dates…" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[13px] outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] px-5 py-4">
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]">Cancel</button>
              <button type="submit" className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[var(--color-primary-hover)]">{t("Simpan Lead", "Save lead")}</button>
            </div>
          </form>
        </div>
      )}

      {notice && (
        <div className="fixed bottom-6 right-6 z-[60] flex max-w-[340px] items-center gap-3 rounded-[var(--radius-card)] bg-[var(--color-text)] px-3.5 py-3 text-[13px] text-[var(--color-surface)] shadow-2xl" role="status" aria-live="polite">
          <CheckCircle2 className="h-4 w-4 flex-none" />
          <span className="flex-1">{notice}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice("")} className="grid place-items-center"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </div>
  );
}
