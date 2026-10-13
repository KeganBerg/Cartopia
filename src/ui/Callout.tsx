// A short call that pops over a race (Perfect shift!, Near miss!): it grows in, holds a moment and
// floats off. Only something to see and feel: it pays nothing. useCallout() pops one.

export type Call = { text: string; n: number }

export function Callout({ call }: { call: Call | null }) {
  return call ? <div key={call.n} className="callout" aria-live="polite">{call.text}</div> : null
}
