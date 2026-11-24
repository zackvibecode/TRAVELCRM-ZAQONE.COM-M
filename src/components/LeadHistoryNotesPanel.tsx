import { useState } from "react";
import { History, Plus, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import {
  FOLLOWUP_HISTORY_ICONS,
  initialsOf,
  type FollowupHistoryIcon,
} from "@/components/FollowupTaskRow";

/** One activity entry in the follow-up history. */
export interface LeadHistoryEntry {
  icon: FollowupHistoryIcon;
  text: string;
  time: string;
}

interface LeadHistoryNotesPanelProps {
  leadName: string;
  notes: string;
  history: LeadHistoryEntry[];
  /** Adds a new customer note (mock-level only in this phase). */
  onAddNote?: (note: string) => void;
}

/**
 * Lead History & Notes — displays follow-up activity history and customer
 * notes for the currently open lead, with an inline composer so sales can
 * append a note without leaving the panel.
 */
export default function LeadHistoryNotesPanel({
  leadName,
  notes,
  history,
  onAddNote,
}: LeadHistoryNotesPanelProps) {
  const { t } = useLang();
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);

  const visibleHistory = expanded ? history : history.slice(0, 5);

  function submitNote(e: React.FormEvent) {
    e.preventDefault();
    const value = draft.trim();
    if (!value || !onAddNote) return;
    onAddNote(value);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Customer notes */}
      <div className="flex flex-col gap-1.5">
        <p className="m-0 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
          <StickyNote className="h-3.5 w-3.5" />
          {t("Nota Pelanggan", "Customer Notes")}
        </p>
        <p className="m-0 whitespace-pre-line text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          {notes || t("Tiada nota lagi untuk lead ini.", "No notes for this lead yet.")}
        </p>
        {onAddNote && (
          <form onSubmit={submitNote} className="mt-1 flex flex-col gap-1.5">
            <textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t(
                "Tambah nota untuk lead ini…",
                "Add a note for this lead…",
              )}
              aria-label={t("Nota baharu", "New note")}
              className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-border-strong)]"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!draft.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-on-primary)] transition-opacity hover:bg-[var(--color-primary-hover)] disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("Simpan Nota", "Save Note")}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Follow-up activity history */}
      <div className="flex flex-col gap-2">
        <p className="m-0 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          {t("Sejarah Susulan", "Follow-Up History")}
        </p>
        {history.length === 0 ? (
          <p className="m-0 text-[12.5px] text-muted-foreground">
            {t(
              `Belum ada aktiviti untuk ${leadName}.`,
              `No activity recorded for ${leadName} yet.`,
            )}
          </p>
        ) : (
          <>
            <ul className="m-0 flex flex-col gap-3 p-0">
              {visibleHistory.map((entry, i) => {
                const Icon = FOLLOWUP_HISTORY_ICONS[entry.icon];
                return (
                  <li
                    key={`${entry.text}-${i}`}
                    className="flex gap-2.5 text-[12.5px] text-[var(--color-text-secondary)]"
                  >
                    <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-[var(--color-surface-muted)]">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                    </span>
                    <div>
                      <span>{entry.text}</span>
                      <time className="mt-0.5 block text-[11px] text-muted-foreground">
                        {entry.time}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ul>
            {history.length > 5 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="self-start rounded-lg px-2 py-1 text-[12px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
              >
                {expanded
                  ? t("Tunjuk kurang", "Show less")
                  : t(
                      `Lihat semua ${history.length} aktiviti`,
                      `View all ${history.length} activities`,
                    )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Small avatar chip reused by detail headers. */
export function LeadAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-11 w-11 flex-none place-items-center rounded-full bg-[var(--color-surface-muted)] text-[14px] font-bold text-[var(--color-primary)]",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
