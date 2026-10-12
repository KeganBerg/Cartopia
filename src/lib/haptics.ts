import { reduceMotionOn, usePrefs } from './prefs'
// Phone buzzes for big moments. Android vibrates; iPhones ignore it quietly.
// Patterns are milliseconds: buzz, pause, buzz...
export function buzz(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && usePrefs.getState().vibration && !reduceMotionOn()) navigator.vibrate?.(pattern)
  } catch {
    /* not supported */
  }
}
