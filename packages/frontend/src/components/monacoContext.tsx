import { monaco as amlMonaco } from "@azimutt/aml";
import { loader } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useTheme } from "../theme.js";
import {
  AUTO_THEME_ID,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  ensureCommunityThemeLoaded,
  isKnownTheme,
} from "./monacoThemes.js";

export const AML_LANGUAGE_ID = "aml";
const THEME_STORAGE_KEY = "erdeer_monaco_theme";

interface MonacoState {
  monaco: typeof Monaco | null;
  appliedTheme: string;
  selection: string;
  setSelection: (next: string) => void;
}

const MonacoContext = createContext<MonacoState | null>(null);

export function useMonaco(): MonacoState {
  const ctx = useContext(MonacoContext);
  if (!ctx) throw new Error("useMonaco must be used inside MonacoProvider");
  return ctx;
}

function readStoredSelection(): string {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && isKnownTheme(saved)) return saved;
  } catch {}
  return AUTO_THEME_ID;
}

function registerAmlLanguage(monaco: typeof Monaco) {
  if (monaco.languages.getLanguages().some((l) => l.id === AML_LANGUAGE_ID)) return;
  monaco.languages.register({ id: AML_LANGUAGE_ID });
  monaco.languages.setMonarchTokensProvider(AML_LANGUAGE_ID, amlMonaco.language() as any);
  monaco.languages.registerCompletionItemProvider(AML_LANGUAGE_ID, amlMonaco.completion() as any);
}

export function MonacoProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [monaco, setMonaco] = useState<typeof Monaco | null>(null);
  const [selection, setSelectionState] = useState<string>(readStoredSelection);
  const [appliedTheme, setAppliedTheme] = useState<string>(() =>
    resolvedTheme === "dark" ? "vs-dark" : "vs",
  );

  useEffect(() => {
    let cancelled = false;
    loader.init().then((m) => {
      if (cancelled) return;
      registerAmlLanguage(m);
      setMonaco(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!monaco) return;
    let cancelled = false;
    const apply = async () => {
      const target =
        selection === AUTO_THEME_ID
          ? resolvedTheme === "dark"
            ? DEFAULT_DARK_THEME_ID
            : DEFAULT_LIGHT_THEME_ID
          : selection;
      await ensureCommunityThemeLoaded(monaco, target);
      if (cancelled) return;
      monaco.editor.setTheme(target);
      setAppliedTheme(target);
    };
    apply();
    return () => {
      cancelled = true;
    };
  }, [monaco, selection, resolvedTheme]);

  const setSelection = useCallback((next: string) => {
    setSelectionState(next);
    try {
      if (next === AUTO_THEME_ID) {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      }
    } catch {}
  }, []);

  return (
    <MonacoContext.Provider value={{ monaco, appliedTheme, selection, setSelection }}>
      {children}
    </MonacoContext.Provider>
  );
}
