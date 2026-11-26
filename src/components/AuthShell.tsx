import type { ReactNode } from "react";
import { Languages } from "lucide-react";
import { useLang } from "@/lib/i18n";

/**
 * Shared split-screen shell for every auth page (login, signup, forgot, reset).
 * Left: large rounded blue brand panel. Right: white stage with the form
 * card wrapped in a 2px rotating conic-gradient border.
 *
 * Keeping the markup here means every auth page stays visually identical —
 * pages only provide their own form body and footer extras.
 */
export default function AuthShell({
  nodeId,
  children,
  footerExtra,
}: {
  nodeId: string;
  children: ReactNode;
  /** Optional extra node rendered beside the language toggle (e.g. a link). */
  footerExtra?: ReactNode;
}) {
  const { t, lang, setLang } = useLang();

  return (
    <div className="au-shell" data-node-id={nodeId}>
      {/* Left: large visual brand panel */}
      <aside className="au-brand">
        <div className="au-brand__geo" aria-hidden="true">
          <span className="au-geo au-geo--a" />
          <span className="au-geo au-geo--b" />
          <span className="au-geo au-geo--c" />
        </div>
        <img
          src="/brand/zaqone-logo-mono-white-1024.png"
          alt="ZAQONE Travel"
          className="au-brand__logo"
          decoding="async"
        />
        <div>
          <h1 className="au-brand__headline">
            {t(
              "Urus pakej, tempahan & keberangkatan semuanya di satu tempat.",
              "Manage packages, bookings & departures all in one place.",
            )}
          </h1>
          <p className="au-brand__copy">
            {t(
              "Platform CRM untuk pasukan operasi travel — leads, invoice, manifest trip dan laman web awam, semuanya bersinkron masa nyata.",
              "The CRM platform for travel operations teams — leads, invoices, trip manifests and the public website, all synced in real time.",
            )}
          </p>
        </div>
        <p className="au-brand__tag">
          {t("Ruang Kerja Staf", "Staff Workspace")} · CRM
        </p>
      </aside>

      {/* Right: white stage, form vertically centred with animated border */}
      <main className="au-stage">
        <div className="au-card">
          <div className="au-panel">{children}</div>
        </div>

        <div className="au-foot au-foot--split">
          <button
            type="button"
            className="au-lang"
            onClick={() => setLang(lang === "ms" ? "en" : "ms")}
          >
            <Languages size={13} />
            {lang === "ms" ? "English" : "Bahasa Melayu"}
          </button>
          {footerExtra}
        </div>
      </main>
    </div>
  );
}
