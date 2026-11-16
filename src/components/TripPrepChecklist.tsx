import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  label: string;
  category: string;
}

const DEFAULT_ITEMS: ChecklistItem[] = [
  { id: "flights", label: "Flight tickets issued", category: "Transport" },
  { id: "hotels", label: "Hotel confirmations received", category: "Accommodation" },
  { id: "rooming", label: "Rooming list finalized", category: "Accommodation" },
  { id: "visa", label: "Visa documents prepared", category: "Documents" },
  { id: "insurance", label: "Travel insurance issued", category: "Documents" },
  { id: "manifest", label: "Final manifest confirmed", category: "Operations" },
  { id: "leader_brief", label: "Tour leader briefing done", category: "Operations" },
  { id: "transfers", label: "Airport transfers arranged", category: "Transport" },
  { id: "meals", label: "Meal / dietary requirements sent", category: "Operations" },
];

export default function TripPrepChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const done = DEFAULT_ITEMS.filter((i) => checked[i.id]).length;
  const total = DEFAULT_ITEMS.length;
  const pct = Math.round((done / total) * 100);

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardCheck className="h-4 w-4" />
          Trip Preparation Checklist
        </h3>
        <span className="text-xs font-medium text-muted-foreground">
          {done}/{total} done
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid gap-1.5">
        {DEFAULT_ITEMS.map((item) => (
          <label
            key={item.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-md border p-2.5 transition-colors hover:bg-muted/50",
              checked[item.id] && "bg-muted/40",
            )}
          >
            <input
              type="checkbox"
              checked={!!checked[item.id]}
              onChange={() => toggle(item.id)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <span
              className={cn(
                "flex-1 text-sm",
                checked[item.id] && "text-muted-foreground line-through",
              )}
            >
              {item.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {item.category}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
