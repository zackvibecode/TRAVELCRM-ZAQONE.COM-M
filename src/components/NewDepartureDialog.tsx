import { useState } from "react";
import { Plane } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { fetchPackages } from "@/lib/live-data";
import type { Departure } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NewDepartureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (departure: Departure) => void;
}

interface FormState {
  packageId: string;
  departureDate: string;
  returnDate: string;
  seatCapacity: string;
  adultPrice: string;
  childPrice: string;
  tourLeader: string;
  notes: string;
}

function nextMonthDate(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export default function NewDepartureDialog({
  open,
  onOpenChange,
  onCreate,
}: NewDepartureDialogProps) {
  const { t } = useLang();

  const [packages, setPackages] = useState<Awaited<ReturnType<typeof fetchPackages>>["packages"]>([]);
  const [saving, setSaving] = useState(false);

  // Live packages from D1 (falls back to mock inside the loader).
  useEffect(() => {
    (async () => {
      const res = await fetchPackages();
      setPackages(res.packages);
    })();
  }, []);

  const firstPackage = packages[0]?.id ?? "";
  const [form, setForm] = useState<FormState>({
    packageId: "",
    departureDate: nextMonthDate(30),
    returnDate: nextMonthDate(37),
    seatCapacity: "40",
    adultPrice: "",
    childPrice: "",
    tourLeader: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  // Isi packageId lalai bila packages dah dimuatkan.
  useEffect(() => {
    setForm((prev) => (prev.packageId ? prev : { ...prev, packageId: firstPackage }));
  }, [firstPackage]);

  const set = (patch: Partial<FormState>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const selectedPackage = packages.find((p) => p.id === form.packageId);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      // Reset form each time the dialog opens.
      setForm({
        packageId: packages[0]?.id ?? "",
        departureDate: nextMonthDate(30),
        returnDate: nextMonthDate(37),
        seatCapacity: "40",
        adultPrice: "",
        childPrice: "",
        tourLeader: "",
        notes: "",
      });
      setError(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = () => {
    // Validation
    if (!form.packageId) {
      setError(t("Pilih pakej terlebih dahulu.", "Select a package first."));
      return;
    }
    if (!form.departureDate) {
      setError(t("Tarikh keberangkatan diperlukan.", "Departure date is required."));
      return;
    }
    if (!form.returnDate) {
      setError(t("Tarikh pulang diperlukan.", "Return date is required."));
      return;
    }
    if (form.returnDate <= form.departureDate) {
      setError(
        t(
          "Tarikh pulang mesti selepas tarikh keberangkatan.",
          "Return date must be after the departure date.",
        ),
      );
      return;
    }
    const capacity = Number(form.seatCapacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
      setError(t("Kapasiti kerusi mesti 1-500.", "Seat capacity must be 1-500."));
      return;
    }
    const adultPrice = Number(form.adultPrice);
    if (!Number.isFinite(adultPrice) || adultPrice <= 0) {
      setError(
        t("Harga dewasa mesti lebih daripada sifar.", "Adult price must be greater than zero."),
      );
      return;
    }
    const childPrice = form.childPrice ? Number(form.childPrice) : 0;
    if (!Number.isFinite(childPrice) || childPrice < 0) {
      setError(t("Harga kanak-kanak tidak sah.", "Child price is invalid."));
      return;
    }

    const payload = {
      packageId: form.packageId,
      departureDate: form.departureDate,
      returnDate: form.returnDate,
      seatCapacity: capacity,
      adultPrice,
      childPrice,
      tourLeader: form.tourLeader.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    setSaving(true);
    (async () => {
      try {
        // Simpan ke D1 melalui API; gagal → masih serahkan objek tempatan
        // supaya jadual tempatan kekal berfungsi (best-effort).
        const res = await apiFetch<{ success: boolean; data?: Departure }>(
          "/departures",
          { method: "POST", body: JSON.stringify(payload) },
        );
        if (res.success && res.data) {
          onCreate(res.data);
        } else {
          onCreate(localDeparture(form.packageId, form.departureDate, form.returnDate, capacity, adultPrice, childPrice, form.tourLeader, form.notes));
        }
      } catch {
        onCreate(localDeparture(form.packageId, form.departureDate, form.returnDate, capacity, adultPrice, childPrice, form.tourLeader, form.notes));
      } finally {
        setSaving(false);
        onOpenChange(false);
      }
    })();
  };

  function localDeparture(
    packageId: string,
    departureDate: string,
    returnDate: string,
    capacity: number,
    adultPrice: number,
    childPrice: number,
    tourLeader: string,
    notes: string,
  ): Departure {
    return {
      id: `d_${Date.now()}`,
      packageId,
      departureDate,
      returnDate,
      seatCapacity: capacity,
      seatsBooked: 0,
      seatsHeld: 0,
      adultPrice,
      childPrice,
      status: "open",
      tourLeader: tourLeader.trim() || undefined,
      notes: notes.trim() || undefined,
    };
  }

  const fieldCls =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-primary" />
            {t("Keberangkatan Baharu", "New Departure")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Jadualkan keberangkatan baharu untuk satu pakej.",
              "Schedule a new departure for a package.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Package */}
          <div className="space-y-1.5">
            <Label>{t("Pakej", "Package")}</Label>
            <select
              className={fieldCls}
              value={form.packageId}
              onChange={(e) => {
                const pkg = packages.find((p) => p.id === e.target.value);
                set({
                  packageId: e.target.value,
                  // Pre-fill prices from the selected package.
                  adultPrice: pkg ? String(pkg.adultPrice) : "",
                  childPrice: pkg ? String(pkg.childPrice) : "",
                });
              }}
            >
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.destination}
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("Tarikh Keberangkatan", "Departure Date")}</Label>
              <Input
                type="date"
                value={form.departureDate}
                onChange={(e) => set({ departureDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Tarikh Pulang", "Return Date")}</Label>
              <Input
                type="date"
                value={form.returnDate}
                onChange={(e) => set({ returnDate: e.target.value })}
              />
            </div>
          </div>

          {/* Capacity & prices */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{t("Kapasiti Kerusi", "Seat Capacity")}</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={form.seatCapacity}
                onChange={(e) => set({ seatCapacity: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Harga Dewasa", "Adult Price")}</Label>
              <Input
                type="number"
                min={0}
                placeholder={selectedPackage ? String(selectedPackage.adultPrice) : "0"}
                value={form.adultPrice}
                onChange={(e) => set({ adultPrice: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Harga Kanak-Kanak", "Child Price")}</Label>
              <Input
                type="number"
                min={0}
                placeholder={selectedPackage ? String(selectedPackage.childPrice) : "0"}
                value={form.childPrice}
                onChange={(e) => set({ childPrice: e.target.value })}
              />
            </div>
          </div>

          {/* Tour leader & notes */}
          <div className="space-y-1.5">
            <Label>{t("Ketua Tour", "Tour Leader")}</Label>
            <Input
              placeholder={t("Nama ketua tour (pilihan)", "Tour leader name (optional)")}
              value={form.tourLeader}
              onChange={(e) => set({ tourLeader: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("Nota", "Notes")}</Label>
            <Input
              placeholder={t("Nota trip (pilihan)", "Trip notes (optional)")}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Batal", "Cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            <Plane className="h-4 w-4" />
            {saving
              ? t("Menyimpan…", "Saving…")
              : t("Cipta Keberangkatan", "Create Departure")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
