import { useEffect, useState } from "react";
import type { TravelPackage } from "@/lib/types";
import InclusionsExclusionsEditor from "@/components/InclusionsExclusionsEditor";
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

interface PackageFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, the form edits this package; otherwise it creates a new one. */
  existing?: TravelPackage | null;
  onSubmit?: (values: Omit<TravelPackage, "id">) => void;
}

interface FormValues {
  name: string;
  destination: string;
  durationDays: number;
  adultPrice: number;
  childPrice: number;
  infantPrice: number;
  inclusions: string[];
  exclusions: string[];
}

const EMPTY: FormValues = {
  name: "",
  destination: "",
  durationDays: 1,
  adultPrice: 0,
  childPrice: 0,
  infantPrice: 0,
  inclusions: [],
  exclusions: [],
};

export default function PackageForm({
  open,
  onOpenChange,
  existing,
  onSubmit,
}: PackageFormProps) {
  const [values, setValues] = useState<FormValues>(EMPTY);

  useEffect(() => {
    if (open) {
      setValues(
        existing
          ? {
              name: existing.name,
              destination: existing.destination,
              durationDays: existing.durationDays,
              adultPrice: existing.adultPrice,
              childPrice: existing.childPrice,
              infantPrice: existing.infantPrice,
              inclusions: existing.inclusions,
              exclusions: existing.exclusions ?? [],
            }
          : EMPTY,
      );
    }
  }, [open, existing]);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const valid = values.name.trim() !== "" && values.destination.trim() !== "";

  function handleSubmit() {
    if (!valid) return;
    onSubmit?.({
      name: values.name.trim(),
      destination: values.destination.trim(),
      durationDays: Math.max(1, values.durationDays),
      adultPrice: Math.max(0, values.adultPrice),
      childPrice: Math.max(0, values.childPrice),
      infantPrice: Math.max(0, values.infantPrice),
      inclusions: values.inclusions,
      exclusions: values.exclusions,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit Package" : "New Package"}
          </DialogTitle>
          <DialogDescription>
            {existing
              ? "Update package details and pricing."
              : "Add a new travel package to the catalog."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="pkg-name">Package name</Label>
            <Input
              id="pkg-name"
              placeholder="e.g. Japan Sakura Tour"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="pkg-dest">Destination</Label>
            <Input
              id="pkg-dest"
              placeholder="e.g. Tokyo & Osaka, Japan"
              value={values.destination}
              onChange={(e) => set("destination", e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="pkg-duration">Duration (days)</Label>
            <Input
              id="pkg-duration"
              type="number"
              min={1}
              value={values.durationDays}
              onChange={(e) => set("durationDays", Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pkg-adult">Adult price</Label>
              <Input
                id="pkg-adult"
                type="number"
                min={0}
                value={values.adultPrice}
                onChange={(e) => set("adultPrice", Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pkg-child">Child price</Label>
              <Input
                id="pkg-child"
                type="number"
                min={0}
                value={values.childPrice}
                onChange={(e) => set("childPrice", Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pkg-infant">Infant price</Label>
              <Input
                id="pkg-infant"
                type="number"
                min={0}
                value={values.infantPrice}
                onChange={(e) => set("infantPrice", Number(e.target.value))}
              />
            </div>
          </div>

          <InclusionsExclusionsEditor
            inclusions={values.inclusions}
            exclusions={values.exclusions}
            onChange={(inclusions, exclusions) =>
              setValues((prev) => ({ ...prev, inclusions, exclusions }))
            }
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!valid}>
            {existing ? "Save Changes" : "Create Package"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
