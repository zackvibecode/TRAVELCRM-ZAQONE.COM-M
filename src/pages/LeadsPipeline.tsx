import { useMemo, useRef, useState } from "react";
import {
  UsersRound,
  Sparkles,
  RefreshCw,
  BadgeCheck,
  Search,
  Download,
  UserPlus,
  ArrowRightLeft,
  Phone,
  FileText,
  Wallet,
  CalendarCheck,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

const STAGES = ["New", "Contacted", "Quotation", "Booking"] as const;
const SOURCES = ["Instagram", "Website", "Referral", "WhatsApp", "Travel fair"];

type Stage = (typeof STAGES)[number];
type HistoryIcon = "sparkles" | "phone" | "file-text" | "wallet" | "calendar-check" | "alert-circle" | "arrow-right-left" | "badge-check";

/** Prototype leads (CONTACTS where kind === "lead"). */
interface Lead {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  city: string;
  stage: Stage;
  source: string;
  value: number;
  trip: string;
  owner: string;
  created: string;
  note: string;
  history: { icon: HistoryIcon; text: string; time: string }[];
}

const HISTORY_ICONS: Record<HistoryIcon, typeof Sparkles> = {
  sparkles: Sparkles,
  phone: Phone,
  "file-text": FileText,
  wallet: Wallet,
  "calendar-check": CalendarCheck,
  "alert-circle": AlertCircle,
  "arrow-right-left": ArrowRightLeft,
  "badge-check": BadgeCheck,
};

const INITIAL_LEADS: Lead[] = [];


const ringgit = (v: number) => `RM ${v.toLocaleString("en-MY")}`;

function stageTone(stage: Stage): { bg: string; fg: string } {
  const map: Record<Stage, { bg: string; fg: string }> = {
    New: { bg: "var(--color-info-soft)", fg: "var(--color-info)" },
    Contacted: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
    Quotation: { bg: "var(--color-neutral-soft)", fg: "var(--color-text-secondary)" },
    Booking: { bg: "var(--color-success-soft)", fg: "var(--color-success)" },
  };
  return map[stage];
}

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
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

export default function LeadsPipeline() {
  const { t } = useLang();
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("All sources");
  const [selectedId, setSelectedId] = useState<string>("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", source: "Instagram", trip: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((c) => {
      const matchQuery = !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || c.trip.toLowerCase().includes(q);
      const matchSource = source === "All sources" || c.source === source;
      return matchQuery && matchSource;
    });
  }, [leads, query, source]);

  const selected = leads.find((c) => c.id === selectedId) ?? visible[0] ?? null;
  const newLeads = leads.filter((c) => c.stage === "New").length;
  const inProgress = leads.filter((c) => c.stage === "Contacted" || c.stage === "Quotation").length;
  const pipelineValue = leads.reduce((s, c) => s + c.value, 0);

  function showNotice(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setNotice(message);
    toastTimer.current = setTimeout(() => setNotice(""), 4000);
  }

  function moveStage(nextStage: Stage) {
    if (!selected) return;
    setLeads((current) =>
      current.map((c) =>
        c.id === selected.id
          ? { ...c, stage: nextStage, history: [{ icon: "arrow-right-left", text: `Stage moved to ${nextStage}`, time: "Just now" }, ...c.history] }
          : c,
      ),
    );
    showNotice(`${selected.name} ${t("dipindahkan ke", "moved to")} ${nextStage}`);
  }

  function convertToCustomer() {
    if (!selected) return;
    setLeads((current) =>
      current.map((c) =>
        c.id === selected.id
          ? { ...c, history: [{ icon: "badge-check", text: "Lead converted to a customer", time: "Just now" }, ...c.history] }
          : c,
      ),
    );
    showNotice(`${selected.name} ${t("kini direkodkan sebagai pelanggan", "is now recorded as a customer")}`);
  }

  function submitLead(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.contact.trim()) next.contact = "Email or phone number is required";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const isEmail = form.contact.includes("@");
    const id = `c-${Date.now()}`;
    const newLead: Lead = {
      id,
      name: form.name.trim(),
      initials: initialsOf(form.name),
      email: isEmail ? form.contact.trim() : "Not provided",
      phone: isEmail ? "Not provided" : form.contact.trim(),
      city: "Not provided",
      stage: "New",
      source: form.source,
      value: 0,
      trip: form.trip || "Not decided",
      owner: "Ayu Rahma",
      created: "Just now",
      note: form.note || "No notes yet.",
      history: [{ icon: "sparkles", text: "Lead added manually", time: "Just now" }],
    };
    setLeads((current) => [newLead, ...current]);
    setSelectedId(id);
    setQuery("");
    setSource("All sources");
    setForm({ name: "", contact: "", source: "Instagram", trip: "", note: "" });
    setFormOpen(false);
    showNotice(`${newLead.name} ${t("ditambah ke pipeline lead", "added to the lead pipeline")}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[22px] font-bold tracking-tight">{t("Saluran Leads", "Leads Pipeline")}</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {leads.length} {t("lead dalam pipeline", "leads in pipeline")} · {t("nilai pipeline", "pipeline value")} {ringgit(pipelineValue)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => showNotice(t("Senarai lead (CSV) sedia untuk dimuat turun", "Contact list (CSV) is ready to download"))} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-[13px] font-semibold hover:bg-[var(--color-surface-muted)]">
            <Download className="h-3.5 w-3.5" /> {t("Eksport", "Export")}
          </button>
          <button type="button" onClick={() => { setErrors({}); setFormOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]">
            <UserPlus className="h-3.5 w-3.5" /> {t("Tambah Lead", "Add lead")}
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={t("Ringkasan lead", "Lead summary")}>
        <MetricCard label={t("Jumlah Lead", "Total leads")} icon={UsersRound} value={String(leads.length)} note={t("Semua lead dalam pipeline", "All leads in pipeline")} />
        <MetricCard label={t("Lead Baharu", "New leads")} icon={Sparkles} value={String(newLeads)} note={t("Belum dihubungi", "Not contacted yet")} />
        <MetricCard label={t("Dalam Proses", "In progress")} icon={RefreshCw} value={String(inProgress)} note={t("Dihubungi & sebut harga", "Contacted and quoted")} />
        <MetricCard label={t("Nilai Pipeline", "Pipeline value")} icon={BadgeCheck} value={ringgit(pipelineValue)} note={t("Jumlah nilai semua lead", "Total value of all leads")} />
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="px-4 pt-4">
            <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)]" role="tablist">
              <button type="button" role="tab" aria-selected="true" className="inline-flex items-center gap-2 border-b-2 border-[var(--color-primary)] px-3 pb-3 pt-1.5 text-[13.5px] font-semibold text-[var(--color-primary)]">
                {t("Leads", "Leads")} <span className="rounded-full bg-[var(--color-primary-soft)] px-1.5 text-[11px] font-bold text-[var(--color-primary)]">{leads.length}</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2 py-3">
              <div className="flex min-w-0 max-w-[300px] flex-1 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Cari nama, emel, bandar…", "Search name, email, city…")} aria-label={t("Cari lead", "Search leads")} className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none" />
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

          {visible.length === 0 ? (
            <div className="px-5 py-12 text-center text-muted-foreground">
              <p className="m-0 font-semibold text-foreground">{t("Tiada lead sepadan", "No leads match")}</p>
              <p className="mb-4 mt-1.5 text-[13px]">{t("Tukar kata kunci atau pilih sumber lain.", "Change the keyword or pick another source.")}</p>
              <button type="button" onClick={() => { setQuery(""); setSource("All sources"); }} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[12px] font-semibold">Reset filters</button>
            </div>
          ) : (
            <ul className="m-0 list-none p-0">
              {visible.map((lead) => {
                const pill = stageTone(lead.stage);
                return (
                  <li key={lead.id}>
                    <button type="button" onClick={() => setSelectedId(lead.id)} aria-current={selected?.id === lead.id ? "true" : undefined} className={cn("flex w-full items-center gap-3 border-b border-[var(--color-border)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--color-surface-raised)]", selected?.id === lead.id && "bg-[var(--color-primary-soft)]")}>
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
          )}
        </section>

        <aside className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          {!selected ? (
            <div className="flex flex-col gap-1.5 p-5">
              <p className="m-0 font-semibold">{t("Pilih lead", "Select a lead")}</p>
              <p className="m-0 text-[13px] text-muted-foreground">{t("Butiran lead dan tindakan pipeline dipaparkan di sini.", "Lead details and pipeline actions show here.")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-[var(--color-surface-muted)] text-[14px] font-bold text-[var(--color-primary)]">{selected.initials}</span>
                <div className="min-w-0">
                  <p className="m-0 break-words text-[15px] font-bold">{selected.name}</p>
                  <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: stageTone(selected.stage).bg, color: stageTone(selected.stage).fg }}>{selected.stage}</span>
                </div>
              </div>
              <dl className="m-0 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
                <dt className="text-[12px] text-muted-foreground">Email</dt><dd className="m-0 break-words">{selected.email}</dd>
                <dt className="text-[12px] text-muted-foreground">Phone</dt><dd className="m-0 [font-variant-numeric:tabular-nums]">{selected.phone}</dd>
                <dt className="text-[12px] text-muted-foreground">City</dt><dd className="m-0">{selected.city}</dd>
                <dt className="text-[12px] text-muted-foreground">Package</dt><dd className="m-0">{selected.trip}</dd>
                <dt className="text-[12px] text-muted-foreground">Value</dt><dd className="m-0 [font-variant-numeric:tabular-nums]">{selected.value > 0 ? ringgit(selected.value) : t("Tiada nilai lagi", "No value yet")}</dd>
                <dt className="text-[12px] text-muted-foreground">Source</dt><dd className="m-0">{selected.source}</dd>
                <dt className="text-[12px] text-muted-foreground">Owner</dt><dd className="m-0">{selected.owner}</dd>
              </dl>
              <div className="flex flex-col gap-1.5">
                <p className="m-0 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Notes</p>
                <p className="m-0 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{selected.note}</p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="m-0 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">{t("Peringkat pipeline", "Pipeline stage")}</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Tukar peringkat lead", "Change lead stage")}>
                  {STAGES.map((stage) => (
                    <button key={stage} type="button" aria-pressed={selected.stage === stage} onClick={() => moveStage(stage)} className={cn("rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-[12px] font-semibold hover:bg-[var(--color-surface-muted)]", selected.stage === stage && "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]")}>
                      {stage}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={convertToCustomer} className="mt-0.5 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[12px] font-semibold hover:bg-[var(--color-surface-muted)]">
                  <BadgeCheck className="h-3.5 w-3.5" /> {t("Tukar kepada pelanggan", "Convert to customer")}
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <p className="m-0 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Activity</p>
                <ul className="m-0 flex flex-col gap-3 p-0">
                  {selected.history.map((entry, i) => {
                    const Icon = HISTORY_ICONS[entry.icon] ?? Sparkles;
                    return (
                      <li key={`${selected.id}-${i}`} className="flex gap-2.5 text-[12.5px] text-[var(--color-text-secondary)]">
                        <Icon className="mt-0.5 h-3.5 w-3.5 flex-none text-muted-foreground" />
                        <div><span>{entry.text}</span><time className="mt-0.5 block text-[11px] text-muted-foreground">{entry.time}</time></div>
                      </li>
                    );
                  })}
                </ul>
              </div>
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
                <p className="mb-0 mt-1 text-[12.5px] text-muted-foreground">{t("Lead bermula di peringkat New dan boleh di-follow up terus.", "The lead starts in the New stage and can be followed up right away.")}</p>
              </div>
              {([
                { key: "name", label: t("Nama Penuh", "Full name"), placeholder: "Prospect name" },
                { key: "contact", label: t("Emel atau Nombor Telefon", "Email or phone number"), placeholder: "name@mail.my or 012…" },
              ] as const).map((f) => (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <label className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">{f.label}</label>
                  <input value={form[f.key]} onChange={(e) => setForm((c) => ({ ...c, [f.key]: e.target.value }))} placeholder={f.placeholder} aria-invalid={Boolean(errors[f.key])} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--color-border-strong)]" />
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
                <textarea rows={3} value={form.note} onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))} placeholder={t("Keperluan, bilangan pelancong, tarikh…", "Requirements, number of travellers, dates…")} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[13px] outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] px-5 py-4">
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]">{t("Batal", "Cancel")}</button>
              <button type="submit" className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]">{t("Simpan Lead", "Save lead")}</button>
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
