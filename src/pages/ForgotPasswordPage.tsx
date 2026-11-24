import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Languages, Mail, Send, type LucideIcon } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { requestPasswordReset } from "@/lib/auth";

/* --------------------------------------------------------------- styles */
const css = `
.au-shell { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-6) var(--space-4); background: linear-gradient(160deg, #f6f7f9 0%, #eceff3 100%); }

.au-card { width: 100%; max-width: 960px; display: grid; grid-template-columns: 1.15fr 1fr; border-radius: var(--radius-panel); overflow: hidden; box-shadow: 0 24px 60px color-mix(in srgb, var(--color-text) 14%, transparent); border: 1px solid var(--color-border); }

.au-brand { position: relative; display: flex; flex-direction: column; justify-content: space-between; gap: var(--space-5); padding: var(--space-7); color: #fff; background: linear-gradient(150deg, #b3121f 0%, #e61828 55%, #ff4d55 100%); }
.au-brand::before { content: ""; position: absolute; inset: 0; background: radial-gradient(700px 320px at 85% -10%, rgba(255,255,255,0.18), transparent 60%); pointer-events: none; }
.au-brand__logo { display: block; width: 100%; height: auto; }
.au-brand__headline { margin: 0; font-family: var(--font-display); font-size: 22px; font-weight: 800; line-height: 1.35; letter-spacing: -0.01em; }
.au-brand__copy { margin: 8px 0 0; font-size: 13px; line-height: 1.6; color: rgba(255,255,255,0.88); max-width: 38ch; }
.au-brand__tag { margin: 0; font-size: 10.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.75); }

.au-panel { background: var(--color-surface); padding: var(--space-7) var(--space-6); display: flex; flex-direction: column; justify-content: center; }
.au-panel form { display: flex; flex-direction: column; gap: var(--space-4); }

.au-title { margin: 0; font-family: var(--font-display); font-size: 19px; font-weight: 700; letter-spacing: -0.01em; color: var(--color-text); }
.au-sub { margin: 4px 0 0; font-size: 12.5px; color: var(--color-text-muted); }

.au-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.au-label { font-size: 12.5px; font-weight: 600; color: var(--color-text-secondary); }
.au-control { position: relative; }
.au-input { width: 100%; box-sizing: border-box; height: 42px; padding: 0 12px 0 36px; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); font: inherit; font-size: 13px; color: var(--color-text); min-width: 0; }
.au-input::placeholder { color: var(--color-text-muted); }
.au-input:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 0; border-color: var(--color-primary); }
.au-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); pointer-events: none; }

.au-success { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
.au-success__icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: var(--radius-pill); background: var(--color-success-soft); color: var(--color-success); }

.au-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 42px; padding: 0 var(--space-4); border-radius: var(--radius-control); border: 1px solid var(--color-primary); background: var(--color-primary); color: var(--color-on-primary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 140ms ease, border-color 140ms ease; }
.au-btn:hover { background: var(--color-primary-hover); border-color: var(--color-primary-hover); }
.au-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
.au-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.au-back { display: flex; align-items: center; justify-content: center; gap: 6px; padding-top: var(--space-4); border-top: 1px solid var(--color-border); margin-top: var(--space-5); }
.au-back a { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; color: var(--color-text-secondary); text-decoration: none; }
.au-back a:hover { color: var(--color-text); text-decoration: underline; }
.au-back a:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; border-radius: 4px; }

.au-foot { display: flex; justify-content: center; max-width: 960px; width: 100%; margin-top: var(--space-4); }
.au-lang { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text-secondary); font: inherit; font-size: 11.5px; font-weight: 600; cursor: pointer; }
.au-lang:hover { background: var(--color-surface-muted); }
.au-lang:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }

@media (max-width: 860px) { .au-card { grid-template-columns: 1fr; max-width: 440px; } .au-brand { display: none; } }
@media (max-width: 480px) { .au-panel { padding: var(--space-5) var(--space-4); } }
@media (prefers-reduced-motion: reduce) { .au-btn { transition: none; } }
`;

function Ikon({ icon, size = 15, style }: { icon: LucideIcon; size?: number; style?: React.CSSProperties }) {
  const Icon = icon;
  return <Icon aria-hidden="true" style={{ fontSize: `${size}px`, width: size, height: size, flex: "none", ...style }} />;
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
      <style>{css}</style>
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
                  <Ikon icon={Mail} size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", pointerEvents: "none" }} />
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
