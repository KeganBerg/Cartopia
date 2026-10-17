// New players start with a nearly empty screen: coins and their level. Each button
// and counter arrives when the game first needs it, so the first ten minutes teach
// one thing at a time. Players past the tutorial and at level 3 see everything.
//
// Built only from the save (tutorial step, level, stats), so nothing new is stored and
// an old save shows exactly what it showed before.
import { useEffect, useRef, useState } from 'react'
import { useGame } from './store'
import { sfx } from '../lib/sound'
import { canBuyPacks } from './payGate'

type Game = ReturnType<typeof useGame.getState>

// Tutorial steps (src/ui/Tutorial.tsx): 1 first job, 3 build Rusty's, 4 find cars,
// 5 restore, 6 paint, 8 race; 99 is done.
const DONE = 99
export const UNLOCKS = {
  fuel: (s: Game) => s.tutorial >= 1,
  shop: (s: Game) => s.tutorial >= 3,
  edit: (s: Game) => s.tutorial >= 4,
  parts: (s: Game) => s.tutorial >= 5,
  cars: (s: Game) => s.tutorial >= 6,
  race: (s: Game) => s.tutorial >= 8,
  gems: (s: Game) => s.tutorial >= DONE,
  trophies: (s: Game) => s.tutorial >= DONE || (s.stats.races ?? 0) > 0,
  social: (s: Game) => s.tutorial >= DONE && s.level >= 2,
  season: (s: Game) => s.tutorial >= DONE && s.level >= 3,
  // The Bank and Car Packs (real money) wait for the town's own Crew House, even while visiting.
  bank: (s: Game) => s.tutorial >= DONE && canBuyPacks(s),
} satisfies Record<string, (s: Game) => boolean>
export type Unlock = keyof typeof UNLOCKS

export const unlocked = (s: Game, id: Unlock) => (id !== 'bank' && !!s.visiting) || UNLOCKS[id](s)

// True once `id` is unlocked. `fresh` is true for a few seconds when it unlocks while the
// player watches, so the button can pop in with a NEW tag; on load it's just there.
export function useUnlock(id: Unlock): { on: boolean; fresh: boolean } {
  const on = useGame((s) => unlocked(s, id))
  const was = useRef(on)
  const [fresh, setFresh] = useState(false)
  useEffect(() => {
    if (on === was.current) return
    was.current = on
    if (!on) return
    if (!useGame.getState().visiting) sfx.unlock()
    setFresh(true)
    const t = window.setTimeout(() => setFresh(false), 4000)
    return () => window.clearTimeout(t)
  }, [on])
  return { on, fresh }
}

// The class a newly arrived button wears: it pops in and shows a NEW tag.
export const freshClass = (fresh: boolean) => (fresh ? ' just-unlocked' : '')
