import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Languages, Lock, Plane, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { resetPassword } from "@/lib/auth";

/* --------------------------------------------------------------- styles */
const css = `
.au-shell { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: var(--space-6) var(--space-4); background: var(--color-background); }
.au-wrap { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: var(--space-5); }

.au-brand { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.au-brand__mark { display: grid; place-items: center; width: 48px; height: 48px; border-radius: var(--radius-card); background: var(--color-primary); color: var(--color-on-primary); }
.au-brand__name { margin: 0; font-family: var(--font-display); font-size: 24px; font-weight: 700; letter-spacing: -0.02em; color: var(--color-text); }
.au-brand__tag { margin: 0; font-size: 11.5px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text-muted); }

.au-panel { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-panel); padding: var(--space-6); box-shadow: 0 8px 28px color-mix(in srgb, var(--color-text) 8%, transparent); }
.au-panel form { display: flex; flex-direction: column; gap: var(--space-4); }

.au-title { margin: 0; font-family: var(--font-display); font-size: 18px; font-weight: 700; letter-spacing: -0.01em; color: var(--color-text); }
.au-sub { margin: 4px 0 0; font-size: 12.5px; color: var(--color-text-muted); }

.au-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.au-label { font-size: 12.5px; font-weight: 600; color: var(--color-text-secondary); }
.au-control { position: relative; }
.au-input { width: 100%; box-sizing: border-box; height: 40px; padding: 0 12px 0 36px; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); font: inherit; font-size: 13px; color: var(--color-text); min-width: 0; }
.au-input--peek { padding-right: 38px; }
.au-input::placeholder { color: var(--color-text-muted); }
.au-input:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 0; border-color: var(--color-primary); }
.au-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); pointer-events: none; }
.au-peek { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 6px; background: transparent; color: var(--color-text-muted); cursor: pointer; }
.au-peek:hover { background: var(--color-surface-muted); color: var(--color-text); }
.au-peek:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }

.au-error { display: flex; align-items: flex-start; gap: 7px; padding: 9px 12px; border-radius: var(--radius-control); background: var(--color-danger-soft); color: var(--color-danger); font-size: 12.5px; }
.au-warn { display: flex; align-items: flex-start; gap: 7px; padding: 9px 12px; border-radius: var(--radius-control); background: var(--color-warning-soft); color: var(--color-warning); font-size: 12.5px; }

.au-success { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
.au-success__icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: var(--radius-pill); background: var(--color-success-soft); color: var(--color-success); }

.au-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 40px; padding: 0 var(--space-4); border-radius: var(--radius-control); border: 1px solid var(--color-primary); background: var(--color-primary); color: var(--color-on-primary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 140ms ease, border-color 140ms ease; }
.au-btn:hover { background: var(--color-primary-hover); border-color: var(--color-primary-hover); }
.au-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
.au-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.au-back { display: flex; align-items: center; justify-content: center; gap: 6px; padding-top: var(--space-4); border-top: 1px solid var(--color-border); margin-top: var(--space-5); }
.au-back a { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; color: var(--color-text-secondary); text-decoration: none; }
.au-back a:hover { color: var(--color-text); text-decoration: underline; }
.au-back a:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; border-radius: 4px; }

.au-foot { display: flex; justify-content: center; }
.au-lang { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text-secondary); font: inherit; font-size: 11.5px; font-weight: 600; cursor: pointer; }
.au-lang:hover { background: var(--color-surface-muted); }
.au-lang:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }

@media (max-width: 480px) { .au-panel { padding: var(--space-5) var(--space-4); } }
@media (prefers-reduced-motion: reduce) { .au-btn { transition: none; } }
`;

function Ikon({ icon, size = 15, style }: { icon: LucideIcon; size?: number; style?: React.CSSProperties }) {
  const Icon = icon;
  return <Icon aria-hidden="true" style={{ fontSize: `${size}px`, width: size, height: size, flex: "none", ...style }} />;
}

export default function ResetPasswordPage() {
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(
        t(
          "Kata laluan dan pengesahan tidak sepadan.",
          "Password and confirmation do not match.",
        ),
      );
      return;
    }
    if (password.length < 8) {
      setError(
        t(
          "Kata laluan mesti sekurang-kurangnya 8 aksara.",
          "Password must be at least 8 characters.",
        ),
      );
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token ?? "", password);
      setDone(true);
    } catch {
      setError(
        t(
          "Pautan tidak sah atau telah tamat tempoh. Cuba minta semula.",
          "Invalid or expired link. Please request a new one.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="au-shell" data-node-id="auth.reset">
      <style>{css}</style>
      <div className="au-wrap">
        <div className="au-brand">
          <div className="au-brand__mark">
            <Ikon icon={Plane} size={24} />
          </div>
          <h1 className="au-brand__name">
            ZAQONE <span style={{ color: "var(--color-primary)" }}>TRAVEL</span>
          </h1>
          <p className="au-brand__tag">
            {t("Ruang Kerja Staf", "Staff Workspace")} · CRM
          </p>
        </div>

        <div className="au-panel">
          {done ? (
            <div className="au-success">
              <div className="au-success__icon">
                <Ikon icon={ShieldCheck} size={18} />
              </div>
              <h2 className="au-title">{t("Kata Laluan Dikemas Kini", "Password Updated")}</h2>
              <p className="au-sub">
                {t(
                  "Kata laluan anda berjaya ditetapkan semula. Sila log masuk semula.",
                  "Your password has been reset successfully. Please sign in again.",
                )}
              </p>
              <button type="button" className="au-btn" onClick={() => navigate("/login")}>
                {t("Pergi ke Log Masuk", "Go to Sign In")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div>
                <h2 className="au-title">{t("Tetapkan Kata Laluan Baru", "Set New Password")}</h2>
                <p className="au-sub">
                  {t("Pilih kata laluan yang kuat untuk akaun staf anda.", "Choose a strong password for your staff account.")}
                </p>
              </div>

              {!token ? (
                <div className="au-warn" role="status">
                  <Ikon icon={TriangleAlert} size={14} style={{ marginTop: 2 }} />
                  <span>
                    {t(
                      "Tiada token reset dalam URL — ini adalah pratonton borang sahaja.",
                      "No reset token in URL — this is a form preview only.",
                    )}
                  </span>
                </div>
              ) : null}

              <div className="au-field">
                <label className="au-label" htmlFor="password">{t("Kata Laluan Baru", "New Password")}</label>
                <div className="au-control">
                  <Ikon icon={Lock} size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", pointerEvents: "none" }} />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="au-input au-input--peek"
                  />
                  <button
                    type="button"
                    className="au-peek"
                    onClick={() => setShowPassword((s) => !s)}
                    tabIndex={-1}
                    aria-label={showPassword ? t("Sembunyi", "Hide") : t("Tunjuk", "Show")}
                  >
                    <Ikon icon={showPassword ? EyeOff : Eye} size={14} />
                  </button>
                </div>
              </div>

              <div className="au-field">
                <label className="au-label" htmlFor="confirm">{t("Sahkan Kata Laluan", "Confirm Password")}</label>
                <div className="au-control">
                  <Ikon icon={Lock} size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", pointerEvents: "none" }} />
                  <input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="au-input"
                  />
                </div>
              </div>

              {error ? (
                <div className="au-error" role="alert">{error}</div>
              ) : null}

              <button type="submit" className="au-btn" disabled={submitting}>
                <Ikon icon={ShieldCheck} size={15} />
                {submitting ? t("Sedang simpan…", "Saving…") : t("Simpan Kata Laluan", "Save Password")}
              </button>
            </form>
          )}

          <div className="au-back">
            <Link to="/login">
              <Ikon icon={ArrowLeft} size={13} />
              {t("Kembali ke Log Masuk", "Back to Sign In")}
            </Link>
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
    </div>
  );
}
