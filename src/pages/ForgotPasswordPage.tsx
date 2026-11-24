import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Languages, Mail, Send, type LucideIcon } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { requestPasswordReset } from "@/lib/auth";


function Ikon({
  icon, size = 15, style, className,
}: { icon: LucideIcon; size?: number; style?: React.CSSProperties; className?: string }) {
  const Icon = icon;
  return (
    <Icon
      aria-hidden="true"
      className={className ? `au-ic ${className}` : "au-ic"}
      style={{ "--size": `${size}px`, ...style } as React.CSSProperties}
    />
  );
}

export default function ForgotPasswordPage() {
  const { t, lang, setLang } = useLang();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
    } catch {
      // Better Auth returns success even for unknown emails; ignore errors.
    }
    setSubmitting(false);
    setSent(true);
  };

  return (
    <div className="au-shell" data-node-id="auth.forgot">
      {/* Page */}
      <div className="au-card">
        <div className="au-brand">
          <div>
            <img
              src="/brand/zaqone-logo-mono-white-1024.png"
              alt="ZAQONE Travel"
              className="au-brand__logo"
              decoding="async"
            />
          </div>
          <div>
            <h1 className="au-brand__headline">
              {t("Urus pakej, tempahan & keberangkatan semuanya di satu tempat.", "Manage packages, bookings & departures all in one place.")}
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
        </div>

        <div className="au-panel">
          {!sent ? (
            <form onSubmit={handleSubmit}>
              <div>
                <h2 className="au-title">{t("Lupa Kata Laluan?", "Forgot Password?")}</h2>
                <p className="au-sub">
                  {t(
                    "Masukkan emel staf anda. Kami akan hantar pautan untuk menetapkan semula kata laluan.",
                    "Enter your staff email. We'll send a link to reset your password.",
                  )}
                </p>
              </div>
              <div className="au-field">
                <label className="au-label" htmlFor="email">{t("Emel Staf", "Staff Email")}</label>
                <div className="au-control">
                  <Ikon icon={Mail} size={15} className="au-ic--field" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@zaqone.travel"
                    className="au-input"
                  />
                </div>
              </div>
              <button type="submit" className="au-btn" disabled={submitting}>
                <Ikon icon={Send} size={15} />
                {submitting ? t("Sedang hantar…", "Sending…") : t("Hantar Pautan Reset", "Send Reset Link")}
              </button>
            </form>
          ) : (
            <div className="au-success">
              <div className="au-success__icon">
                <Ikon icon={Mail} size={18} />
              </div>
              <h2 className="au-title">{t("Semak Emel Anda", "Check Your Email")}</h2>
              <p className="au-sub">
                {t(
                  `Jika akaun wujud untuk ${email}, pautan reset telah dihantar.`,
                  `If an account exists for ${email}, a reset link has been sent.`,
                )}
              </p>
            </div>
          )}

          <div className="au-back">
            <Link to="/login">
              <Ikon icon={ArrowLeft} size={13} />
              {t("Kembali ke Log Masuk", "Back to Sign In")}
            </Link>
          </div>
        </div>
      </div>

      <div className="au-foot">
        <button
          type="button"
          className="au-lang"
          onClick={() => setLang(lang === "ms" ? "en" : "ms")}
        >
          <Ikon icon={Languages} size={13} />
          {lang === "ms" ? "English" : "Bahasa Melayu"}
        </button>
      </div>
    </div>
  );
}
