import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

export type Lang = "ms" | "en";

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** t("Melayu text", "English text") — returns the string for the active language. */
  t: (ms: string, en: string) => string;
  /** Build a locale-prefixed public path, e.g. localePath("/site/packages"). */
  localePath: (path: string, langOverride?: Lang) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
  t: (_ms, en) => en,
  localePath: (p) => p,
});

const STORAGE_KEY = "zaqone_lang";
const DEFAULT_LANG: Lang = "en";

function detectInitialLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  // 1. Persisted visitor choice wins.
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "ms" || saved === "en") return saved;
  } catch {
    // storage may be unavailable (private mode) — fall through.
  }
  // 2. Locale in the current URL (e.g. /site/ms/...).
  const match = window.location.pathname.match(/^\/site\/(ms|en)(\/|$)/);
  if (match) return match[1] as Lang;
  // 3. Browser preference.
  if (navigator.language.toLowerCase().startsWith("ms")) return "ms";
  return DEFAULT_LANG;
}

/** Strip a leading locale segment from a public path. */
function stripLocale(path: string): string {
  const match = path.match(/^\/site\/(ms|en)(\/.*)?$/);
  if (!match) return path;
  return `/site${match[2] || ""}` || "/site";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLangState] = useState<Lang>(detectInitialLang);

  const t = useCallback(
    (ms: string, en: string) => (lang === "ms" ? ms : en),
    [lang],
  );

  const localePath = useCallback(
    (path: string, langOverride?: Lang): string => {
      const code = langOverride ?? lang;
      const base = stripLocale(path);
      return base.replace(/^\/site/, `/site/${code}`) || `/site/${code}`;
    },
    [lang],
  );

  /**
   * Change language: persist the choice and, when on a public page, reflect
   * it in the URL so each locale has its own address.
   */
  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      document.documentElement.lang = next;

      if (location.pathname.startsWith("/site")) {
        const base = stripLocale(location.pathname);
        const nextPath =
          base.replace(/^\/site/, `/site/${next}`) + location.search;
        if (nextPath !== location.pathname + location.search) {
          navigate(nextPath, { replace: true });
        }
      }
    },
    [location.pathname, location.search, navigate],
  );

  // Sync language from the URL when visiting a locale-prefixed link directly.
  useEffect(() => {
    const match = location.pathname.match(/^\/site\/(ms|en)(\/|$)/);
    if (match && match[1] !== lang) {
      const next = match[1] as Lang;
      setLangState(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      document.documentElement.lang = next;
    }
  }, [location.pathname, lang]);

  // Keep <html lang> correct on first mount.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t, localePath }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

/**
 * Convenience hook for public pages: returns a function that prefixes
 * /site paths with the active locale so in-page links keep the visitor's
 * language. Non-/site paths are returned unchanged.
 */
export function useLocalePath() {
  const { localePath } = useLang();
  return localePath;
}

export const LANG_LABELS: Record<Lang, string> = {
  ms: "BM",
  en: "EN",
};
