import { createContext, useContext } from "react"

/** What the user picked. */
export type Theme = "light" | "dark" | "system"
/** What is actually shown once "system" is resolved. */
export type ResolvedTheme = "light" | "dark"

export const THEME_STORAGE_KEY = "nambede.theme"

export interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>")
  return context
}
