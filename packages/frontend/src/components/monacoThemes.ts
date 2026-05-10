import type * as Monaco from "monaco-editor";
import themelist from "monaco-themes-data/themelist.json";

export interface ThemeOption {
  id: string;
  label: string;
}

export const AUTO_THEME_ID = "auto";
export const DEFAULT_LIGHT_THEME_ID = "idle";
export const DEFAULT_DARK_THEME_ID = "github-dark";

export const COMMUNITY_THEMES: ThemeOption[] = Object.entries(themelist as Record<string, string>)
  .map(([id, label]) => ({ id, label }))
  .sort((a, b) => a.label.localeCompare(b.label));

const communityById = new Map(COMMUNITY_THEMES.map((t) => [t.id, t]));

export interface ThemeColors {
  background?: string;
  foreground?: string;
}

const registered = new Set<string>();
const inflight = new Map<string, Promise<void>>();
const colors = new Map<string, ThemeColors>();

const BUILTIN_COLORS: Record<string, ThemeColors> = {
  vs: { background: "#fffffe", foreground: "#000000" },
  "vs-dark": { background: "#1e1e1e", foreground: "#d4d4d4" },
  "hc-light": { background: "#ffffff", foreground: "#292929" },
  "hc-black": { background: "#000000", foreground: "#ffffff" },
};

export function getThemeColors(id: string): ThemeColors | undefined {
  return colors.get(id) ?? BUILTIN_COLORS[id];
}

export function isCommunityTheme(id: string): boolean {
  return communityById.has(id);
}

export function isKnownTheme(id: string): boolean {
  return id === AUTO_THEME_ID || isCommunityTheme(id);
}

export async function ensureCommunityThemeLoaded(monaco: typeof Monaco, id: string): Promise<void> {
  if (registered.has(id)) return;
  const option = communityById.get(id);
  if (!option) return;

  let promise = inflight.get(id);
  if (!promise) {
    promise = (async () => {
      const mod = await import(`monaco-themes-data/${option.label}.json`);
      const data = (mod.default ?? mod) as Monaco.editor.IStandaloneThemeData;
      monaco.editor.defineTheme(id, data);
      colors.set(id, {
        background: data.colors?.["editor.background"],
        foreground: data.colors?.["editor.foreground"],
      });
      registered.add(id);
    })();
    inflight.set(id, promise);
  }
  try {
    await promise;
  } finally {
    inflight.delete(id);
  }
}
