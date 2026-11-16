import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface InclusionsExclusionsEditorProps {
  inclusions: string[];
  exclusions: string[];
  onChange: (inclusions: string[], exclusions: string[]) => void;
}

function TagListEditor({
  label,
  items,
  onAdd,
  onRemove,
}: {
  label: string;
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function handleAdd() {
    const value = draft.trim();
    if (!value) return;
    onAdd(value);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs"
          >
            {item}
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="text-muted-foreground hover:text-destructive"
              title={`Remove ${item}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {items.length === 0 && (
          <span className="text-xs text-muted-foreground">None</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={`Add ${label.toLowerCase()}...`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleAdd}
          disabled={!draft.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function InclusionsExclusionsEditor({
  inclusions,
  exclusions,
  onChange,
}: InclusionsExclusionsEditorProps) {
  return (
    <div className="space-y-4">
      <TagListEditor
        label="Inclusions"
        items={inclusions}
        onAdd={(v) => {
          if (!inclusions.includes(v)) onChange([...inclusions, v], exclusions);
        }}
        onRemove={(v) =>
          onChange(
            inclusions.filter((i) => i !== v),
            exclusions,
          )
        }
      />
      <TagListEditor
        label="Exclusions"
        items={exclusions}
        onAdd={(v) => {
          if (!exclusions.includes(v)) onChange(inclusions, [...exclusions, v]);
        }}
        onRemove={(v) =>
          onChange(
            inclusions,
            exclusions.filter((e) => e !== v),
          )
        }
      />
    </div>
  );
}
