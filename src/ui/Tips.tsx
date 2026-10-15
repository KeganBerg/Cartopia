import { useEffect } from 'react'
import { create } from 'zustand'
import { useGame } from '../game/store'
import { FEATURES } from '../game/data'

type Game = ReturnType<typeof useGame.getState>
// What a tip points at; the matching button pulses while the tip is up.
export type TipTarget = 'gems' | 'goals' | 'cars' | 'shop' | 'fuel'

// One-time tips after the tutorial: the first time a feature matters, one short line
// and a pulse on the thing itself. Seen tips stay seen on this device.
type Tip = { id: string; icon: string; text: string; target: TipTarget; when: (s: Game) => boolean; go?: (s: Game) => void }
const owns = (s: Game, def: string) => s.buildings.some((b) => b.def === def)
const build = (def: string) => (s: Game) => s.openShop(def)

const TIPS: Tip[] = [
  { id: 'gems', icon: '💎', text: 'Gems are rare. Use them to skip waits, refill fuel and open Gold crates.', target: 'gems', when: () => true },
  { id: 'goals', icon: '📋', text: 'Not sure what to do next? Goals show the way and pay coins.', target: 'goals', when: (s) => (s.stats.jobs ?? 0) >= 8 },
  { id: 'garage', icon: '🔧', text: 'Upgrade your car under CARS to win more races.', target: 'cars', when: (s) => (s.stats.races ?? 0) >= 1 && (s.stats.upgrades ?? 0) === 0, go: (s) => s.openPanel('garage') },
  { id: 'taptip', icon: '👆', text: 'Tap any badge or icon to see what it does.', target: 'cars', when: (s) => (s.stats.races ?? 0) >= 1, go: (s) => s.openPanel('garage') },
  { id: 'fuel', icon: '⛽', text: 'Jobs burn fuel. It refills by itself over time.', target: 'fuel', when: (s) => s.fuel <= 3 },
  { id: 'tires', icon: '🛞', text: `Build a Tire Shop: ${FEATURES.tires}.`, target: 'shop', when: (s) => s.level >= 2 && !owns(s, 'tires'), go: build('tires') },
  { id: 'crates', icon: '📦', text: 'Crates under CARS hold cars, parts and skins.', target: 'cars', when: () => true, go: (s) => s.openPanel('crates') },
  { id: 'crew', icon: '👥', text: `Build a Crew House: ${FEATURES.crew}.`, target: 'shop', when: (s) => s.level >= 3 && !owns(s, 'crew'), go: build('crew') },
  { id: 'arcade', icon: '🕹️', text: `Build the Arcade: ${FEATURES.arcade}.`, target: 'shop', when: (s) => s.level >= 5 && !owns(s, 'arcade'), go: build('arcade') },
]

const KEY = 'cartopia.tips'
function loadSeen(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}
const seen = new Set(loadSeen())
function markSeen(id: string) {
  seen.add(id)
  try { localStorage.setItem(KEY, JSON.stringify([...seen])) } catch { /* private mode: tips may repeat */ }
}

// A tip only shows over the plain town, never over a menu, the tutorial or a friend's town.
const calm = (s: Game) => s.tutorial >= 99 && !s.panel && !s.visiting && s.mode === 'play'
function nextTip(s: Game): Tip | null {
  if (!calm(s)) return null
  return TIPS.find((t) => !seen.has(t.id) && t.when(s)) ?? null
}

// Tips wait a little after the last one so they never stack up.
const GAP_MS = 40000
let lastShown = 0
const useTip = create<{ tip: Tip | null }>(() => ({ tip: null }))

// The button the current tip points at, while the town is calm enough to show it.
export function useTipTarget(): TipTarget | null {
  const tip = useTip((t) => t.tip)
  const show = useGame(calm)
  return tip && show ? tip.target : null
}

export function Tips() {
  const tip = useTip((t) => t.tip)
  const show = useGame(calm)

  useEffect(() => {
    const pick = () => {
      if (useTip.getState().tip) return
      const t = nextTip(useGame.getState())
      if (!t || Date.now() - lastShown < GAP_MS) return
      lastShown = Date.now()
      useTip.setState({ tip: t })
    }
    // A breath after the town settles (and after the tutorial's last step).
    const id = setInterval(pick, 4000)
    return () => clearInterval(id)
  }, [])

  if (!tip || !show) return null
  const close = () => {
    markSeen(tip.id)
    lastShown = Date.now()
    useTip.setState({ tip: null })
  }
  return (
    <div className="tutorial tip" key={tip.id}>
      <span className="tut-icon" aria-hidden>{tip.icon}</span>
      <div className="tut-body"><p>{tip.text}</p></div>
      <div className="tut-actions">
        {tip.go && <button className="buy small" onClick={() => { const go = tip.go!; close(); go(useGame.getState()) }}>Show me</button>}
        <button className={tip.go ? 'tut-skip' : 'buy small'} onClick={close}>{tip.go ? 'Later' : 'Got it'}</button>
      </div>
    </div>
  )
}
