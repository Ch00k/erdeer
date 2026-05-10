import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeState {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
}

const STORAGE_KEY = "erdeer_theme";

const ThemeContext = createContext<ThemeState | null>(null);

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

function readStoredPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return "system";
}

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemValue, setSystemValue] = useState<ResolvedTheme>(systemTheme);

  // Track OS preference changes; only used when preference === "system".
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemValue(mql.matches ? "dark" : "light");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: ResolvedTheme = preference === "system" ? systemValue : preference;

  // Reflect the choice on <html> and persist it.
  useEffect(() => {
    const root = document.documentElement;
    if (preference === "system") {
      root.removeAttribute("data-theme");
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    } else {
      root.setAttribute("data-theme", preference);
      try {
        localStorage.setItem(STORAGE_KEY, preference);
      } catch {}
    }
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
  }, []);

  const toggle = useCallback(() => {
    setPreferenceState((prev) => {
      const current = prev === "system" ? systemTheme() : prev;
      return current === "dark" ? "light" : "dark";
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
