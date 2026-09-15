import { createContext, useContext, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import type { SaasLocale } from "./types";

function storedPreference(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

/**
 * The portal speaks Chinese, like the rest of the app.
 *
 * `text` still takes two arguments because every call site passes a pair — that is how
 * this module was written — and the English half is now dead weight rather than a
 * second language. It is left in the call sites rather than stripped: this is a
 * self-contained GPL-3.0 subtree, it is not reachable from the Android app at all
 * (`ApplicationEntry` sends a Tauri build straight to the admin panel, and the portal
 * only exists in the browser deployment), and rewriting all 298 call sites to prove a
 * point about a screen the phone cannot open is not a trade worth making. It can be
 * cleaned out on request.
 */
const LocaleContext = createContext({
  locale: "zh" as SaasLocale,
  text: (chinese: string, _english: string) => chinese,
});

export function SaasFrame({ children, embedded = false }: { children: ReactNode; embedded?: boolean }) {
  const [theme, setTheme] = useState(() => storedPreference("saas.theme") || (document.documentElement.classList.contains("dark") ? "dark" : "light"));
  function remember(key: string, value: string) { try { localStorage.setItem(key, value); } catch {} }
  function toggleTheme() { const next = theme === "light" ? "dark" : "light"; setTheme(next); remember("saas.theme", next); }
  return <LocaleContext.Provider value={{ locale: "zh", text: (chinese: string) => chinese }}>
    <div className={`saas-root${embedded ? " saas-embedded" : ""}`} data-theme={theme} lang="zh-CN">
      <div className="saas-preferences">
        <button type="button" className="saas-button saas-icon-button saas-quiet" onClick={toggleTheme} aria-label={theme === "light" ? "深色模式" : "浅色模式"}>{theme === "light" ? <Moon size={17} /> : <Sun size={17} />}</button>
      </div>
      {children}
    </div>
  </LocaleContext.Provider>;
}

export function useSaasLocale() { return useContext(LocaleContext); }
