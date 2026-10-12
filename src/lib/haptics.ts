// Phone buzzes for big moments. Android vibrates; iPhones ignore it quietly.
// Patterns are milliseconds: buzz, pause, buzz...
export function buzz(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && !matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(pattern)
  } catch {
    /* not supported */
  }
}
