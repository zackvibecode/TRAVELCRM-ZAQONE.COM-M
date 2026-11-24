import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Languages, Lock, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { resetPassword } from "@/lib/auth";


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
                  <Ikon icon={TriangleAlert} size={14} className="au-warn__icon" />
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
                  <Ikon icon={Lock} size={15} className="au-ic--field" />
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
                  <Ikon icon={Lock} size={15} className="au-ic--field" />
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
