import { Compass } from "lucide-react";
import { getSession } from "@/lib/auth";
import { canAccess } from "@/lib/roles";
import { useLang } from "@/lib/i18n";
import { useTour } from "./TourContext";

/**
 * "Panduan" button in the top bar. Only renders for roles that can reach the
 * first tour page (Import Lead), so the tour never starts into a 403.
 */
export default function TourLaunchButton() {
  const { t } = useLang();
  const { start, active } = useTour();
  const session = getSession();

  if (!session || !canAccess("/lead-import", session.role)) return null;

  return (
    <button
      type="button"
      onClick={start}
      disabled={active}
      className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12.5px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] focus-ring disabled:opacity-50"
      title={t("Mula panduan aliran lead", "Start the lead-flow tour")}
    >
      <Compass className="h-4 w-4" />
      <span className="hidden sm:inline">{t("Panduan", "Tour")}</span>
    </button>
  );
}
