import { useEffect, useState } from "react";
import { ExternalLink, Plus, Trash2, X } from "lucide-react";
import type { ItineraryDay } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { useLang } from "@/lib/i18n";

const MEAL_OPTIONS = [
  { id: "B", label: "Breakfast" },
  { id: "L", label: "Lunch" },
  { id: "D", label: "Dinner" },
  { id: "MOB", label: "Meet & Board" },
];

interface CreatePackageDialogProps {  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  packageId?: string | null;
}

/**
 * Dialog to create a new travel package. POSTs to the Worker /packages
 * endpoint (requires sales/management/super_admin role) and notifies the
 * parent so it can reload the catalog.
 */
export default function CreatePackageDialog({
  open,
  onOpenChange,
  onCreated,
  packageId = null,
}: CreatePackageDialogProps) {
  const { t } = useLang();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [itinerary, setItinerary] = useState<ItineraryDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    destination: "",
    durationDays: "3",
    description: "",
    highlights: "",
    inclusions: "",
    exclusions: "",
    adultPrice: "",
    childPrice: "0",
    infantPrice: "0",
    publishStatus: "draft",
  });

  useEffect(() => {
    if (!open || !packageId) {
      setItinerary([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { fetchPackage } = await import("@/lib/live-data");
        const pkg = await fetchPackage(packageId);
        if (!pkg || cancelled) return;
        setForm({
          name: pkg.name,
          destination: pkg.destination,
          durationDays: String(pkg.durationDays || 1),
          description: pkg.description ?? "",
          highlights: (pkg.highlights ?? []).join("\n"),
          inclusions: pkg.inclusions.join("\n"),
          exclusions: (pkg.exclusions ?? []).join("\n"),
          adultPrice: String(pkg.adultPrice),
          childPrice: String(pkg.childPrice),
          infantPrice: String(pkg.infantPrice),
          publishStatus: pkg.published ? "published" : "draft",
        });
        setItinerary(pkg.itinerary ?? []);
      } catch {
        if (!cancelled) setError(t("Gagal memuatkan pakej.", "Could not load package."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, packageId]);

  if (!open) return null;

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.destination.trim()) {
      setError(t("Nama dan destinasi wajib diisi.", "Name and destination are required."));
      return;
    }

    const toList = (s: string) =>
      s
        .split(/\n|,/)
        .map((x) => x.trim())
        .filter(Boolean);

    const payload = {
      name: form.name.trim(),
      destination: form.destination.trim(),
      durationDays: Number(form.durationDays) || 0,
      description: form.description.trim() || null,
      highlights: toList(form.highlights),
      inclusions: toList(form.inclusions),
      exclusions: toList(form.exclusions),
      itinerary,
      adultPrice: Number(form.adultPrice) || 0,
      childPrice: Number(form.childPrice) || 0,
      infantPrice: Number(form.infantPrice) || 0,
      publishStatus: form.publishStatus,
    };

    setSaving(true);
    try {
      const res = await apiFetch<{ success: boolean; error?: string }>(
        packageId ? `/packages/${packageId}` : "/packages",
        { method: packageId ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      if (!res.success) {
        setError(res.error ?? t("Gagal menyimpan pakej.", "Failed to save package."));
        return;
      }
      onCreated();
      onOpenChange(false);
      // reset form for next open
      setItinerary([]);
      setForm({
        name: "",
        destination: "",
        durationDays: "3",
        description: "",
        highlights: "",
        inclusions: "",
        exclusions: "",
        adultPrice: "",
        childPrice: "0",
        infantPrice: "0",
        publishStatus: "draft",
      });
    } catch {
      setError(t("Gagal menyimpan pakej. Cuba lagi.", "Failed to save package. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)]";
  const labelCls = "mb-1 block text-[12px] font-medium text-[var(--color-text-secondary)]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("Tambah pakej baharu", "Create new package")}
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
    >
      <form
        onSubmit={submit}
        className="flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="m-0 text-[15px] font-bold">
            {packageId ? t("Kemas Kini Pakej", "Update Package") : t("Tambah Pakej Baharu", "Create New Package")}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t("Tutup", "Close")}
            className="cursor-pointer rounded-md p-1 hover:bg-[var(--color-surface-muted)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-5">
          {loading ? <p className="m-0 text-[13px] text-muted-foreground">{t("Memuatkan butiran pakej…", "Loading package details…")}</p> : null}
          {packageId ? (
            <a href={`/site/packages/${packageId}`} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-primary)] no-underline hover:underline">
              <ExternalLink className="h-3.5 w-3.5" />
              {t("Pratonton pakej di website", "Preview package on website")}
            </a>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="np-name">
                {t("Nama pakej *", "Package name *")}
              </label>
              <input
                id="np-name"
                className={inputCls}
                value={form.name}
                onChange={set("name")}
                placeholder="Langkawi Island Escape 4D3N"
                required
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="np-dest">
                {t("Destinasi *", "Destination *")}
              </label>
              <input
                id="np-dest"
                className={inputCls}
                value={form.destination}
                onChange={set("destination")}
                placeholder="Langkawi, Malaysia"
                required
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="np-days">
                {t("Tempoh (hari)", "Duration (days)")}
              </label>
              <input
                id="np-days"
                type="number"
                min="1"
                className={inputCls}
                value={form.durationDays}
                onChange={set("durationDays")}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="np-status">
                {t("Status terbitan", "Publish status")}
              </label>
              <select
                id="np-status"
                className={inputCls}
                value={form.publishStatus}
                onChange={set("publishStatus")}
              >
                <option value="draft">{t("Draf (belum nampak di website)", "Draft (not visible on website)")}</option>
                <option value="published">{t("Terbit (nampak di website)", "Published (visible on website)")}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls} htmlFor="np-adult">
                {t("Harga dewasa (RM)", "Adult price (RM)")}
              </label>
              <input id="np-adult" type="number" min="0" className={inputCls} value={form.adultPrice} onChange={set("adultPrice")} placeholder="1890" />
            </div>
            <div>
              <label className={labelCls} htmlFor="np-child">
                {t("Harga kanak-kanak (RM)", "Child price (RM)")}
              </label>
              <input id="np-child" type="number" min="0" className={inputCls} value={form.childPrice} onChange={set("childPrice")} />
            </div>
            <div>
              <label className={labelCls} htmlFor="np-infant">
                {t("Harga bayi (RM)", "Infant price (RM)")}
              </label>
              <input id="np-infant" type="number" min="0" className={inputCls} value={form.infantPrice} onChange={set("infantPrice")} />
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="np-desc">
              {t("Penerangan", "Description")}
            </label>
            <textarea id="np-desc" rows={2} className={inputCls} value={form.description} onChange={set("description")} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="np-highlights">
                {t("Tersohor (pisah dengan koma)", "Highlights (comma separated)")}
              </label>
              <textarea id="np-highlights" rows={2} className={inputCls} value={form.highlights} onChange={set("highlights")} placeholder="Island hopping, Sunset cruise" />
            </div>
            <div>
              <label className={labelCls} htmlFor="np-inc">
                {t("Termasuk (pisah dengan koma)", "Inclusions (comma separated)")}
              </label>
              <textarea id="np-inc" rows={2} className={inputCls} value={form.inclusions} onChange={set("inclusions")} placeholder="Hotel, Makan, Penerbangan" />
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="np-exc">
              {t("Tidak termasuk (pisah dengan koma)", "Exclusions (comma separated)")}
            </label>
            <textarea id="np-exc" rows={2} className={inputCls} value={form.exclusions} onChange={set("exclusions")} placeholder="Visa, Peribadi" />
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="m-0 text-[13px] font-semibold">{t("Itinerary hari demi hari", "Day-by-day itinerary")}</h3>
                <p className="m-0 mt-1 text-[11.5px] text-muted-foreground">{t("Susunan ini akan dipaparkan sama pada halaman pakej di website.", "This will appear on the public package detail page.")}</p>
              </div>
              <button type="button" onClick={() => setItinerary((days) => [...days, { day: days.length + 1, title: "", description: "" }])} className="inline-flex flex-none cursor-pointer items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-2.5 py-1.5 text-[12px] font-medium hover:bg-[var(--color-surface-muted)]">
                <Plus className="h-3.5 w-3.5" />{t("Tambah hari", "Add day")}
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {itinerary.map((day, index) => (
                <div key={index} className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <strong className="text-[12px]">{t("Hari", "Day")} {index + 1}</strong>
                    <button type="button" aria-label={`${t("Buang hari", "Remove day")} ${index + 1}`} onClick={() => setItinerary((days) => days.filter((_, i) => i !== index).map((item, i) => ({ ...item, day: i + 1 })))} className="cursor-pointer text-[var(--color-danger)]"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <input aria-label={`${t("Tajuk hari", "Day title")} ${index + 1}`} className={inputCls} value={day.title} onChange={(event) => setItinerary((days) => days.map((item, i) => i === index ? { ...item, title: event.target.value } : item))} placeholder={t("cth. Kuala Lumpur – Seoul", "e.g. Kuala Lumpur – Seoul")} />
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11.5px] text-muted-foreground">{t("Makan:", "Meals:")}</span>
                    {MEAL_OPTIONS.map((code) => {
                      const active = (day.meals ?? []).some((m) => m === code.id || m === code.label);
                      return (
                        <button key={code.id} type="button" aria-pressed={active} onClick={() => setItinerary((days) => days.map((item, i) => i === index ? { ...item, meals: active ? (item.meals ?? []).filter((m) => m !== code.id) : [...(item.meals ?? []), code.label] } : item))} className={`cursor-pointer rounded-full border px-2 py-0.5 text-[11px] font-medium ${active ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "border-[var(--color-border)] text-[var(--color-text-secondary)]"}`}>
                          {code.id}
                        </button>
                      );
                    })}
                  </div>
                  <textarea aria-label={`${t("Penerangan hari", "Day description")} ${index + 1}`} rows={4} className={`${inputCls} mt-2 resize-y`} value={day.description} onChange={(event) => setItinerary((days) => days.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} placeholder={t("Aktiviti, makan dan penginapan untuk hari ini…", "Activities, meals and accommodation for this day…")} />
                </div>
              ))}
              {itinerary.length === 0 ? <p className="m-0 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] p-4 text-center text-[12px] text-muted-foreground">{t("Belum ada itinerary. Klik Tambah hari untuk mula.", "No itinerary yet. Click Add day to start.")}</p> : null}
            </div>
          </div>

          {error ? (
            <p role="alert" className="m-0 text-[12.5px] font-medium text-[var(--color-danger)]">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] px-5 py-3.5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-4 py-2 text-[12.5px] font-medium hover:bg-[var(--color-surface-muted)]"
          >
            {t("Batal", "Cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="cursor-pointer rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 py-2 text-[12.5px] font-semibold text-[var(--color-on-primary)] hover:opacity-90 disabled:opacity-50"
          >
            {saving ? t("Menyimpan...", "Saving...") : t("Simpan Pakej", "Save Package")}
          </button>
        </div>
      </form>
    </div>
  );
}
