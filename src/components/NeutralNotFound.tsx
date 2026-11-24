import { Link } from "react-router-dom";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useLang } from "@/lib/i18n";

interface NeutralNotFoundProps {
  /** Where the "back" link points to. */
  backTo?: string;
  backLabel?: string;
}

/**
 * Neutral 404 — one identical response whether the record does not exist or
 * belongs to someone else, so data existence never leaks. This mirrors the
 * backend `requireOwnedLead()` guard contract (404, never 403).
 */
export default function NeutralNotFound({
  backTo = "/lead-management",
}: NeutralNotFoundProps) {
  const { t } = useLang();
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-20 text-center">
      <FileQuestion className="h-10 w-10 text-muted-foreground" />
      <h1 className="m-0 font-display text-[22px] font-bold tracking-tight">404</h1>
      <p className="m-0 max-w-[420px] text-[13px] text-muted-foreground">
        {t(
          "Halaman ini tidak dijumpai — ia mungkin tidak wujud, telah dipindahkan, atau bukan milik anda.",
          "This page was not found — it may not exist, may have been moved, or may not be yours.",
        )}
      </p>
      <Link
        to={backTo}
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold hover:bg-[var(--color-surface-muted)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("Kembali ke senarai lead", "Back to lead list")}
      </Link>
    </div>
  );
}
