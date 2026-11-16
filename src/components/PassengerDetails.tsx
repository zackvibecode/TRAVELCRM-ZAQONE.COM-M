import type { Passenger } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PassengerDetailsProps {
  passenger: Passenger | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeLabel: Record<Passenger["type"], string> = {
  adult: "Adult",
  child: "Child",
  infant: "Infant",
};

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value || "—"}</div>
    </div>
  );
}

export default function PassengerDetails({
  passenger,
  open,
  onOpenChange,
}: PassengerDetailsProps) {
  if (!passenger) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {passenger.fullName || "(Unnamed)"}
            <Badge variant="secondary">{typeLabel[passenger.type]}</Badge>
          </DialogTitle>
          <DialogDescription>Passenger details</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Date of birth" value={passenger.dateOfBirth && formatDate(passenger.dateOfBirth)} />
          <Field
            label="Gender"
            value={passenger.gender ? passenger.gender.charAt(0).toUpperCase() + passenger.gender.slice(1) : undefined}
          />
          <Field label="Nationality" value={passenger.nationality} />
          <Field label="Phone" value={passenger.phone} />
          <Field label="Passport number" value={passenger.passportNumber} />
          <Field
            label="Passport expiry"
            value={passenger.passportExpiry && formatDate(passenger.passportExpiry)}
          />
          <Field label="Room type" value={passenger.roomType} />
          <Field label="Flight info" value={passenger.flightInfo} />
          <div className="col-span-2">
            <Field label="Dietary note" value={passenger.dietaryNote} />
          </div>
          <div className="col-span-2">
            <Field label="Rooming note" value={passenger.roomingNote} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
