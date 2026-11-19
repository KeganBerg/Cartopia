import { Activity, memo, useEffect, useState, type ReactNode } from 'react'

// A hidden page isn't rebuilt when the page around it is: hidden pages still render in the
// background whenever their props change, and every tap gave each kept tab new props, so every
// hidden tab was rebuilt behind the one being shown. It catches up the moment it shows again.
const Pane = memo(
  function Pane({ on, render }: { on: boolean; render: () => ReactNode }) {
    return <Activity mode={on ? 'visible' : 'hidden'}>{render()}</Activity>
  },
  (a, b) => !a.on && !b.on,
)

// A tab's page is built the first time it's opened and then kept, hidden, while another tab
// shows: tapping back to it only shows it again. Rebuilding a page on every tap (its cards, its
// 3D thumbnails, laying it all out) froze a slow phone for a moment on each switch. A hidden page
// does no work: its effects stop (timers, thumbnails drawing) and start again when it shows.
// `tab` null: none showing (the Cars page in the crate depot).
export function KeepTabs<T extends string>({ tab, render }: { tab: T | null; render: (tab: T) => ReactNode }) {
  const [seen, setSeen] = useState<T[]>(tab ? [tab] : [])
  const all = tab && !seen.includes(tab) ? [...seen, tab] : seen
  if (all !== seen) setSeen(all)
  return (
    <>
      {all.map((t) => (
        <Pane key={t} on={t === tab} render={() => render(t)} />
      ))}
    </>
  )
}

// A whole menu kept the same way while the menus are up: switching between Shop, Cars, Social
// and Goals shows a menu already built instead of building it again on each tap. Back in town
// (`open` false) the kept ones go, one at a time a moment later, so closing stays a single
// quick step and nothing hidden keeps updating behind the town or a race.
export function Kept({ on, open, children }: { on: boolean; open: boolean; children: ReactNode }) {
  const [seen, setSeen] = useState(on)
  if (on && !seen) setSeen(true)
  useEffect(() => {
    if (open || !seen) return
    return dropLater(() => setSeen(false))
  }, [open, seen])
  return seen ? <Pane on={on} render={() => children} /> : null
}

// Back in town, the first kept menu goes after DROP_AFTER ms, then one each DROP_GAP ms.
const DROP_AFTER = 800
const DROP_GAP = 300
const drops: (() => void)[] = []
let timer = 0
function dropLater(drop: () => void) {
  drops.push(drop)
  if (!timer) timer = window.setTimeout(next, DROP_AFTER)
  return () => {
    const i = drops.indexOf(drop)
    if (i >= 0) drops.splice(i, 1)
  }
}
function next() {
  timer = 0
  drops.shift()?.()
  if (drops.length) timer = window.setTimeout(next, DROP_GAP)
}
