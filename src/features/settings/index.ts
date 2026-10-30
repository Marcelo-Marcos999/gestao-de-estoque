/** Única porta de entrada da feature de aparência (ver CLAUDE.md). */
export { AppearanceProvider, useAppearance } from './AppearanceContext'
export { SettingsPage } from './pages/SettingsPage'
export { ACCENTS, THEME_MODES } from './theme'
export type { AccentName, ThemeMode } from './theme'
export { DEFAULT_PERIOD_DAYS } from './period'
export { usePeriodDays } from './usePeriodDays'
