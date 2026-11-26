import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Lock, LogIn, Mail, Eye, EyeOff, ShieldCheck, type LucideIcon } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { login, verifyTurnstile } from "@/lib/auth";
import TurnstileWidget, { getTurnstileSiteKey } from "@/components/TurnstileWidget";
import AuthShell from "@/components/AuthShell";


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

export default function LoginPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const turnstileEnabled = !!getTurnstileSiteKey();

    if (turnstileEnabled && !turnstileToken) {
      setError(t("Sila sahkan anda bukan robot.", "Please complete the security check."));
      return;
    }

    setSubmitting(true);
    try {
      if (turnstileEnabled) {
        const ok = await verifyTurnstile(turnstileToken, "login");
        if (!ok) {
          setTurnstileReset((n) => n + 1);
          setError(t("Pengesahan keselamatan gagal. Cuba lagi.", "Security check failed. Try again."));
          return;
        }
      }
      const result = await login(email, password);
      if (!result.ok) {
        setTurnstileReset((n) => n + 1);
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
    <AuthShell
      nodeId="auth.login"
      footerExtra={
        <p className="au-note">
          {t("Laman awam", "Public website")} · /site
        </p>
      }
    >
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
            <Ikon icon={Mail} size={15} className="au-ic--field" />
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
            <Ikon icon={Lock} size={15} className="au-ic--field" />
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

        <TurnstileWidget
          action="login"
          onToken={setTurnstileToken}
          resetKey={turnstileReset}
        />
        {!getTurnstileSiteKey() && (
          <p className="au-sub" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldCheck size={13} style={{ flex: "none" }} />
            {t(
              "Keselamatan Cloudflare Turnstile belum diaktifkan — aktifkan di dashboard Cloudflare.",
              "Cloudflare Turnstile security is not active yet — enable it in the Cloudflare dashboard.",
            )}
          </p>
        )}

        <div className="flex items-center justify-between">
          <Link to="/forgot-password" className="au-link">
            {t("Lupa kata laluan?", "Forgot password?")}
          </Link>
          <Link to="/signup" className="au-link">
            {t("Daftar akaun", "Create account")}
          </Link>
        </div>

        <button type="submit" className="au-btn" disabled={submitting}>
          <Ikon icon={LogIn} size={15} />
          {submitting ? t("Sedang log masuk…", "Signing in…") : t("Log Masuk", "Sign In")}
        </button>
      </form>
    </AuthShell>
  );
}
