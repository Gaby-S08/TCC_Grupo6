export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "help-theme";

export function parseStoredTheme(value: string | null | undefined): ThemeMode | null {
  if (value === "dark" || value === "light") return value;
  return null;
}

export function resolveInitialTheme(
  storedValue: string | null | undefined,
  prefersDark: boolean,
): ThemeMode {
  const parsed = parseStoredTheme(storedValue);
  if (parsed) return parsed;
  return prefersDark ? "dark" : "light";
}

export function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;