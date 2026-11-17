import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Languages, Lock, Plane, ShieldCheck } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { resetPassword } from "@/lib/auth";

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
            <Plane className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            ZAQONE <span className="text-primary">TRAVEL</span>
          </h1>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("Ruang Kerja Staf", "Staff Workspace")} · CRM
          </p>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          {done ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold">
                {t("Kata Laluan Dikemas Kini", "Password Updated")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t(
                  "Kata laluan anda berjaya ditetapkan semula. Sila log masuk semula.",
                  "Your password has been reset successfully. Please sign in again.",
                )}
              </p>
              <button
                onClick={() => navigate("/login")}
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
              >
                {t("Pergi ke Log Masuk", "Go to Sign In")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {t("Tetapkan Kata Laluan Baru", "Set New Password")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(
                    "Pilih kata laluan yang kuat untuk akaun staf anda.",
                    "Choose a strong password for your staff account.",
                  )}
                </p>
              </div>

              {!token && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {t(
                    "Tiada token reset dalam URL — ini adalah pratonton borang sahaja.",
                    "No reset token in URL — this is a form preview only.",
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                  {t("Kata Laluan Baru", "New Password")}
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 w-full rounded-md border border-input bg-transparent pl-9 pr-10 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showPassword ? t("Sembunyi", "Hide") : t("Tunjuk", "Show")}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirm" className="text-sm font-medium">
                  {t("Sahkan Kata Laluan", "Confirm Password")}
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                {submitting
                  ? t("Sedang simpan…", "Saving…")
                  : t("Simpan Kata Laluan", "Save Password")}
              </button>
            </form>
          )}

          <div className="mt-5 border-t pt-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("Kembali ke Log Masuk", "Back to Sign In")}
            </Link>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setLang(lang === "ms" ? "en" : "ms")}
            className="inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50"
          >
            <Languages className="h-3.5 w-3.5" />
            {lang === "ms" ? "English" : "Bahasa Melayu"}
          </button>
        </div>
      </div>
    </div>
  );
}
