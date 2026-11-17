import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Languages, Lock, LogIn, Mail, Plane, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { loginMock, listDemoAccounts, type StaffRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<StaffRole, { ms: string; en: string }> = {
  super_admin: { ms: "Super Admin", en: "Super Admin" },
  management: { ms: "Pengurusan", en: "Management" },
  sales: { ms: "Jualan", en: "Sales" },
  finance: { ms: "Kewangan", en: "Finance" },
  operations: { ms: "Operasi", en: "Operations" },
};

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Mock auth — backend Better Auth menyusul pada task backend.
    window.setTimeout(() => {
      const session = loginMock(email, password);
      setSubmitting(false);
      if (!session) {
        setError(
          t(
            "Emel atau kata laluan tidak sah. Cuba akaun demo di bawah.",
            "Invalid email or password. Try a demo account below.",
          ),
        );
        return;
      }
      navigate(from);
    }, 400);
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("demo1234");
    setError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand */}
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

        {/* Login card */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                {t("Emel Staf", "Staff Email")}
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@zaqone.travel"
                  className="h-10 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                {t("Kata Laluan", "Password")}
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
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
                  aria-label={showPassword ? t("Sembunyi kata laluan", "Hide password") : t("Tunjuk kata laluan", "Show password")}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-primary hover:underline"
              >
                {t("Lupa kata laluan?", "Forgot password?")}
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <LogIn className="h-4 w-4" />
              {submitting ? t("Sedang log masuk…", "Signing in…") : t("Log Masuk", "Sign In")}
            </button>
          </form>

          {/* Demo accounts (mock auth sahaja) */}
          <div className="mt-5 border-t pt-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t(
                "Akaun demo (mock) — klik untuk isi. Kata laluan: demo1234",
                "Demo accounts (mock) — click to fill. Password: demo1234",
              )}
            </div>
            <div className="grid gap-1.5">
              {listDemoAccounts().map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => fillDemo(a.email)}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted/50",
                    email === a.email && "border-primary/50 bg-primary/5",
                  )}
                >
                  <span className="font-medium">{a.name}</span>
                  <span className="text-muted-foreground">
                    {t(ROLE_LABELS[a.role].ms, ROLE_LABELS[a.role].en)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setLang(lang === "ms" ? "en" : "ms")}
            className="inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50"
          >
            <Languages className="h-3.5 w-3.5" />
            {lang === "ms" ? "English" : "Bahasa Melayu"}
          </button>
          <p className="text-xs text-muted-foreground">
            {t("Laman awam", "Public website")} · /site
          </p>
        </div>
      </div>
    </div>
  );
}
