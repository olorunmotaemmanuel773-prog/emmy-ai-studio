import * as React from "react";

export type ThemePreference = "dark" | "light" | "system";

interface ThemeContextValue {
  theme: ThemePreference;
  resolved: "dark" | "light";
  setTheme: (t: ThemePreference) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = "emmyai-theme";

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(resolved: "dark" | "light") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#070A14" : "#F5F6FB");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemePreference>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    return stored === "light" || stored === "system" || stored === "dark" ? stored : "dark";
  });
  const [resolved, setResolved] = React.useState<"dark" | "light">(() =>
    theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme,
  );

  React.useEffect(() => {
    const compute = () => (theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme);
    const next = compute();
    setResolved(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, theme);

    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      const r = compute();
      setResolved(r);
      applyTheme(r);
    };
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme: setThemeState }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
