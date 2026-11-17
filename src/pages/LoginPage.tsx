import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Languages, Lock, LogIn, Mail, Plane, Eye, EyeOff, type LucideIcon } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { login } from "@/lib/auth";

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

.au-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 40px; padding: 0 var(--space-4); border-radius: var(--radius-control); border: 1px solid var(--color-primary); background: var(--color-primary); color: var(--color-on-primary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 140ms ease, border-color 140ms ease; }
.au-btn:hover { background: var(--color-primary-hover); border-color: var(--color-primary-hover); }
.au-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
.au-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.au-link { align-self: flex-end; font-size: 11.5px; font-weight: 600; color: var(--color-primary); text-decoration: none; }
.au-link:hover { text-decoration: underline; }
.au-link:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; border-radius: 4px; }

.au-back { display: flex; align-items: center; justify-content: center; gap: 6px; padding-top: var(--space-4); border-top: 1px solid var(--color-border); margin-top: var(--space-5); }
.au-back a { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; color: var(--color-text-secondary); text-decoration: none; }
.au-back a:hover { color: var(--color-text); text-decoration: underline; }
.au-back a:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; border-radius: 4px; }

.au-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.au-lang { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text-secondary); font: inherit; font-size: 11.5px; font-weight: 600; cursor: pointer; }
.au-lang:hover { background: var(--color-surface-muted); }
.au-lang:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
.au-note { font-size: 11.5px; color: var(--color-text-muted); }

@media (max-width: 480px) { .au-panel { padding: var(--space-5) var(--space-4); } .au-foot { flex-direction: column; gap: var(--space-2); } }
@media (prefers-reduced-motion: reduce) { .au-btn { transition: none; } }
`;

function Ikon({ icon, size = 15, style }: { icon: LucideIcon; size?: number; style?: React.CSSProperties }) {
  const Icon = icon;
  return <Icon aria-hidden="true" style={{ fontSize: `${size}px`, width: size, height: size, flex: "none", ...style }} />;
}

export default function LoginPage() {
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (!result.ok) {
        setError(
          result.error === "Invalid email or password"
            ? t("Emel atau kata laluan tidak sah.", "Invalid email or password.")
            : t("Tidak dapat berhubung dengan pelayan. Cuba lagi.", "Could not reach the server. Try again."),
        );
        return;
      }
      navigate(from);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="au-shell" data-node-id="auth.login">
      <style>{css}</style>
      <div className="au-wrap">
        {/* Brand */}
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

        {/* Login panel */}
        <div className="au-panel">
          <form onSubmit={handleSubmit}>
            <div>
              <h2 className="au-title">{t("Log Masuk", "Sign In")}</h2>
              <p className="au-sub">
                {t("Masukkan kredensial staf anda untuk meneruskan.", "Enter your staff credentials to continue.")}
              </p>
            </div>

            <div className="au-field">
              <label className="au-label" htmlFor="email">{t("Emel Staf", "Staff Email")}</label>
              <div className="au-control">
                <Ikon icon={Mail} size={15} style={{ left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", position: "absolute", pointerEvents: "none" }} />
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@zaqone.travel"
                  className="au-input"
                />
              </div>
            </div>

            <div className="au-field">
              <label className="au-label" htmlFor="password">{t("Kata Laluan", "Password")}</label>
              <div className="au-control">
                <Ikon icon={Lock} size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", pointerEvents: "none" }} />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
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
                  aria-label={showPassword ? t("Sembunyi kata laluan", "Hide password") : t("Tunjuk kata laluan", "Show password")}
                >
                  <Ikon icon={showPassword ? EyeOff : Eye} size={14} />
                </button>
              </div>
            </div>

            {error ? (
              <div className="au-error" role="alert">{error}</div>
            ) : null}

            <Link to="/forgot-password" className="au-link">
              {t("Lupa kata laluan?", "Forgot password?")}
            </Link>

            <button type="submit" className="au-btn" disabled={submitting}>
              <Ikon icon={LogIn} size={15} />
              {submitting ? t("Sedang log masuk…", "Signing in…") : t("Log Masuk", "Sign In")}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="au-foot">
          <button
            type="button"
            className="au-lang"
            onClick={() => setLang(lang === "ms" ? "en" : "ms")}
          >
            <Ikon icon={Languages} size={13} />
            {lang === "ms" ? "English" : "Bahasa Melayu"}
          </button>
          <p className="au-note">
            {t("Laman awam", "Public website")} · /site
          </p>
        </div>
      </div>
    </div>
  );
}
