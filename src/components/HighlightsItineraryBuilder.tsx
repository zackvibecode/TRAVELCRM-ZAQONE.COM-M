import { useState } from "react";
import { Plus, X, Sparkles } from "lucide-react";
import type { ItineraryDay } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HighlightsItineraryBuilderProps {
  highlights: string[];
  itinerary: ItineraryDay[];
  onChange: (highlights: string[], itinerary: ItineraryDay[]) => void;
}

export default function HighlightsItineraryBuilder({
  highlights,
  itinerary,
  onChange,
}: HighlightsItineraryBuilderProps) {
  const [highlightDraft, setHighlightDraft] = useState("");

  function addHighlight() {
    const v = highlightDraft.trim();
    if (!v || highlights.includes(v)) return;
    onChange([...highlights, v], itinerary);
    setHighlightDraft("");
  }

  function removeHighlight(v: string) {
    onChange(
      highlights.filter((h) => h !== v),
      itinerary,
    );
  }

  function updateDay(
    index: number,
    field: keyof ItineraryDay,
    value: string | number,
  ) {
    onChange(
      highlights,
      itinerary.map((d, i) =>
        i === index ? { ...d, [field]: value } : d,
      ),
    );
  }

  function addDay() {
    const nextDay = itinerary.length + 1;
    onChange(highlights, [
      ...itinerary,
      { day: nextDay, title: "", description: "" },
    ]);
  }

  function removeDay(index: number) {
    const next = itinerary
      .filter((_, i) => i !== index)
      .map((d, i) => ({ ...d, day: i + 1 }));
    onChange(highlights, next);
  }

  return (
    <div className="space-y-4">
      {/* Highlights */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          Highlights
        </div>
        <div className="flex flex-wrap gap-1.5">
          {highlights.map((h) => (
            <span
              key={h}
              className="flex items-center gap-1 rounded-full border bg-primary/5 px-2.5 py-0.5 text-xs text-primary"
            >
              {h}
              <button
                type="button"
                onClick={() => removeHighlight(h)}
                className="text-primary/60 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {highlights.length === 0 && (
            <span className="text-xs text-muted-foreground">
              No highlights yet
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add a highlight..."
            value={highlightDraft}
            onChange={(e) => setHighlightDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addHighlight();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={addHighlight}
            disabled={!highlightDraft.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Itinerary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Itinerary</div>
          <Button type="button" variant="outline" size="sm" onClick={addDay}>
            <Plus className="h-3.5 w-3.5" />
            Add day
          </Button>
        </div>

        {itinerary.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            No itinerary days yet.
          </p>
        ) : (
          <div className="space-y-2">
            {itinerary.map((day, i) => (
              <div key={i} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                    Day {day.day}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeDay(i)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid gap-2">
                  <Input
                    placeholder="Day title"
                    value={day.title}
                    onChange={(e) => updateDay(i, "title", e.target.value)}
                  />
                  <Input
                    placeholder="Description"
                    value={day.description}
                    onChange={(e) =>
                      updateDay(i, "description", e.target.value)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
