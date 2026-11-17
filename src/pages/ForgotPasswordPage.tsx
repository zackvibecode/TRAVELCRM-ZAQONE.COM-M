import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Languages, Mail, Plane, Send } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { requestPasswordReset } from "@/lib/auth";

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
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {t("Lupa Kata Laluan?", "Forgot Password?")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(
                    "Masukkan emel staf anda. Kami akan hantar pautan untuk menetapkan semula kata laluan.",
                    "Enter your staff email. We'll send a link to reset your password.",
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium">
                  {t("Emel Staf", "Staff Email")}
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@zaqone.travel"
                    className="h-10 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {submitting
                  ? t("Sedang hantar…", "Sending…")
                  : t("Hantar Pautan Reset", "Send Reset Link")}
              </button>
            </form>
          ) : (
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Mail className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold">
                {t("Semak Emel Anda", "Check Your Email")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t(
                  `Jika akaun wujud untuk ${email}, pautan reset telah dihantar.`,
                  `If an account exists for ${email}, a reset link has been sent.`,
                )}
              </p>
            </div>
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
