import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Languages, Lock, Mail, User, UserPlus, CheckCircle2, type LucideIcon } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { signUp, verifyTurnstile } from "@/lib/auth";
import TurnstileWidget, { getTurnstileSiteKey } from "@/components/TurnstileWidget";


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

export default function SignupPage() {
  const { t, lang, setLang } = useLang();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        const ok = await verifyTurnstile(turnstileToken, "signup");
        if (!ok) {
          setTurnstileReset((n) => n + 1);
          setError(t("Pengesahan keselamatan gagal. Cuba lagi.", "Security check failed. Try again."));
          return;
        }
      }
      const result = await signUp(name, email, password);
      if (!result.ok) {
        setTurnstileReset((n) => n + 1);
        setError(
          result.error === "User already exists"
            ? t("Emel ini sudah didaftarkan.", "This email is already registered.")
            : result.error === "Password too short"
              ? t("Kata laluan mesti sekurang-kurangnya 8 aksara.", "Password must be at least 8 characters.")
              : t("Tidak dapat mendaftar. Cuba lagi.", "Could not register. Try again."),
        );
        return;
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="au-shell" data-node-id="auth.signup">
      {/* Page */}
      <div className="au-card">
        {/* Brand panel */}
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

        {/* Signup form panel */}
        <div className="au-panel">
          {!done ? (
            <form onSubmit={handleSubmit}>
              <div>
                <h2 className="au-title">{t("Daftar Akaun", "Create Account")}</h2>
                <p className="au-sub">
                  {t(
                    "Daftar akaun staf. Akaun anda memerlukan kelulusan admin sebelum boleh log masuk.",
                    "Register a staff account. Your account needs admin approval before you can sign in.",
                  )}
                </p>
              </div>

              <div className="au-field">
                <label className="au-label" htmlFor="name">{t("Nama Penuh", "Full Name")}</label>
                <div className="au-control">
                  <Ikon icon={User} size={15} className="au-ic--field" />
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ahmad bin Ali"
                    className="au-input"
                  />
                </div>
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
                    placeholder="ahmad@zaqone.travel"
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
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="au-input"
                  />
                </div>
              </div>

              {error ? (
                <div className="au-error" role="alert">{error}</div>
              ) : null}

              <TurnstileWidget
                action="signup"
                onToken={setTurnstileToken}
                resetKey={turnstileReset}
              />

              <button type="submit" className="au-btn" disabled={submitting}>
                <Ikon icon={UserPlus} size={15} />
                {submitting ? t("Sedang mendaftar…", "Creating account…") : t("Daftar", "Register")}
              </button>
            </form>
          ) : (
            <div className="au-success">
              <div className="au-success__icon">
                <Ikon icon={CheckCircle2} size={18} />
              </div>
              <h2 className="au-title">{t("Akaun Menunggu Kelulusan", "Account Pending Approval")}</h2>
              <p className="au-sub">
                {t(
                  "Akaun anda telah dihantar untuk kelulusan. Admin akan menyemak dan memberi anda akses tidak lama lagi.",
                  "Your account has been submitted for approval. An admin will review it and grant you access shortly.",
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
