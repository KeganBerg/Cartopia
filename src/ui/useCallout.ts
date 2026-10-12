import { useCallback, useEffect, useRef, useState } from 'react'
import type { Call } from './Callout'

// Pops a call (ui/Callout.tsx) and takes it down after `ms`.
export function useCallout(ms = 900) {
  const [call, setCall] = useState<Call | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const pop = useCallback((text: string) => {
    // A fresh n restarts the animation when the same call comes twice in a row.
    setCall((c) => ({ text, n: (c?.n ?? 0) + 1 }))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCall(null), ms)
  }, [ms])
  return [call, pop] as const
}
