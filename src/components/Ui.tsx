import { useEffect, useId, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import { useLang } from "@/lib/i18n";

/**
 * Empty state — satu permukaan jemputan untuk bertindak.
 * Dipakai oleh semua halaman CRM supaya halaman kosong tidak kelihatan rosak.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Variant padat untuk panel kecil (editor kosong, drawer). */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center" role="status">
        {Icon ? (
          <span className="tv-empty__icon" aria-hidden="true">
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <h3 className="tv-empty__title text-[14px]">{title}</h3>
        {description ? <p className="tv-empty__text text-[12.5px]">{description}</p> : null}
      </div>
    );
  }
  return (
    <div className="tv-empty" role="status">
      {Icon ? (
        <span className="tv-empty__icon" aria-hidden="true">
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <div className="flex flex-col gap-1">
        <h3 className="tv-empty__title">{title}</h3>
        {description ? <p className="tv-empty__text">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/**
 * Dialog asas — overlay + kad + butang tutup + Escape untuk tutup.
 * Semua dialog CRM memakai ini supaya animasi, warna dan tingkah laku seragam.
 */
export function Dialog({
  title,
  description,
  onClose,
  children,
  footer,
  role = "dialog",
  maxWidth = 460,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  role?: "dialog" | "alertdialog";
  maxWidth?: number;
}) {
  const { t } = useLang();
  const titleId = useId();

  // Tutup dengan Escape — jangan paksa pengguna mencari butang X.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="tv-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className="tv-dialog"
        style={{ maxWidth }}
      >
        <div className="tv-dialog__head">
          <div className="min-w-0">
            <h2 id={titleId} className="tv-dialog__title">
              {title}
            </h2>
            {description ? <p className="tv-dialog__desc">{description}</p> : null}
          </div>
          <button
            type="button"
            aria-label={t("Tutup", "Close")}
            onClick={onClose}
            className="tv-dialog__close focus-ring"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {children ? <div className="tv-dialog__body">{children}</div> : null}
        {footer ? <div className="tv-dialog__foot">{footer}</div> : null}
      </div>
    </div>
  );
}
