import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type Lang = "ms" | "en";

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** t("Melayu text", "English text") — returns the string for the active language. */
  t: (ms: string, en: string) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
  t: (_ms, en) => en,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  const t = (ms: string, en: string) => (lang === "ms" ? ms : en);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

export const LANG_LABELS: Record<Lang, string> = {
  ms: "BM",
  en: "EN",
};
