import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n";

/**
 * Shared loading / empty / error surfaces for the Follow-Up CRM pages.
 *
 * Each page renders the same chrome in every state so the layout never
 * jumps: the title and toolbar stay put, only the body swaps. All copy is
 * English by default with a Bahasa Malaysia variant through useLang().
 */

export function FollowupLoading({ label }: { label?: string }) {
  const { t } = useLang();
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center"
    >
      <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" aria-hidden="true" />
      <p className="m-0 text-[13px] text-muted-foreground">
        {label ?? t("Memuatkan data...", "Loading data...")}
      </p>
    </div>
  );
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Optional call-to-action, e.g. an import button. */
  action?: ReactNode;
  /** Compact variant for small panels (queue sidebar, drawers). */
  compact?: boolean;
}

export function FollowupEmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={
        compact
          ? "flex flex-col items-center gap-2 px-4 py-8 text-center"
          : "flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-14 text-center"
      }
    >
      {Icon ? (
        <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] text-muted-foreground">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      ) : null}
      <div className="flex flex-col gap-1">
        <h3 className="m-0 font-display text-[15px] font-semibold text-[var(--color-text)]">{title}</h3>
        {description ? (
          <p className="m-0 max-w-[46ch] text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function FollowupErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useLang();
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] px-6 py-10 text-center"
    >
      <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-control)] bg-[var(--color-surface)] text-[var(--color-danger)]">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="m-0 font-display text-[15px] font-semibold text-[var(--color-text)]">
          {t("Tidak dapat memuatkan data", "Unable to load data")}
        </h3>
        <p className="m-0 max-w-[52ch] text-[13px] text-[var(--color-text-secondary)]">{message}</p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)]"
        >
          {t("Cuba semula", "Try again")}
        </button>
      ) : null}
    </div>
  );
}
