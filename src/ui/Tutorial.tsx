import { useEffect } from 'react'
import { useGame } from '../game/store'

type Game = ReturnType<typeof useGame.getState>
// What the current step points at: it pulses so the player knows where to tap.
export type TutTarget = 'pizza' | 'shop' | 'rescue' | 'done' | 'race'

const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const editing = (s: Game) => s.mode !== 'play'

// Steps either wait for the player to do something (`done`) or for a tap on Next.
// One short line each; the pulsing target does the rest of the explaining.
const STEPS: { icon: string; text: (s: Game) => string; target?: (s: Game) => TutTarget | null; done?: (s: Game) => boolean }[] = [
  { icon: '👋', text: () => "Welcome to Cartopia! Let's earn your first coins." },
  {
    icon: '⛽', text: () => 'Tap a pulsing ⛽ bubble to send a car on a pizza job.',
    target: () => 'pizza', done: (s) => s.buildings.some((b) => b.jobEndsAt !== null) || s.stats.jobs > 0,
  },
  { icon: '💰', text: () => 'When the gold $ pops up, tap it to collect.', target: () => 'pizza', done: (s) => s.stats.jobs > 0 },
  {
    icon: '🔧',
    text: (s) => s.mode === 'place' ? (TOUCH ? "Tap an empty spot, then tap again to build Rusty's." : "Click an empty spot to build Rusty's.") : "Build Rusty's Rescue: tap SHOP, then START HERE.",
    target: (s) => (editing(s) ? null : 'shop'), done: (s) => s.buildings.some((b) => b.def === 'rescue'),
  },
  {
    icon: '🔍', text: (s) => editing(s) ? 'Built! Tap Done, then 🔍 Find cars over Rusty’s.' : 'Tap 🔍 Find cars over Rusty’s to hunt for old cars.',
    target: (s) => (editing(s) ? 'done' : 'rescue'), done: (s) => (s.stats.searches ?? 0) > 0,
  },
  {
    icon: '🛠', text: () => 'Restore a find in Rusty’s bay. Fixed-up cars drive around town.',
    target: () => 'rescue',
    // A search that turned up no cars has nothing to restore: move on rather than stall.
    done: (s) => !!s.restoring || (s.stats.rescued ?? 0) > 0 || (!s.search && s.junkyard.length === 0),
  },
  { icon: '🏁', text: () => 'While Rusty works, tap RACE for your first race!', target: () => 'race', done: (s) => s.panel === 'race' || (s.stats.races ?? 0) > 0 },
]

// The thing to pulse right now, or null when the tutorial isn't pointing anywhere.
export function tutTarget(s: Game): TutTarget | null {
  const st = STEPS[s.tutorial]
  if (!st?.target || s.visiting || s.panel) return null
  return st.target(s)
}

export function Tutorial() {
  const step = useGame((s) => s.tutorial)
  const setStep = useGame((s) => s.setTutorial)
  const text = useGame((s) => STEPS[s.tutorial]?.text(s))
  const hidden = useGame((s) => !!s.panel || !!s.visiting)
  const cur = STEPS[step]

  // Auto-advance steps that wait on an action.
  useEffect(() => {
    if (!cur?.done) return
    const check = () => {
      const s = useGame.getState()
      if (s.tutorial === step && cur.done!(s)) setStep(step + 1)
    }
    check()
    return useGame.subscribe(check)
  }, [cur, step, setStep])

  // Menus carry their own pointers (START HERE, Rusty's coach), so the card waits behind them.
  if (!cur || hidden) return null
  return (
    <div className="tutorial" key={step}>
      <span className="tut-icon" aria-hidden>{cur.icon}</span>
      <div className="tut-body">
        <p>{text}</p>
        <div className="tut-dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => <i key={i} className={i < step ? 'on' : i === step ? 'cur' : ''} />)}
        </div>
      </div>
      <div className="tut-actions">
        {!cur.done && <button className="buy small" onClick={() => setStep(step + 1)}>Next</button>}
        <button className="tut-skip" onClick={() => setStep(99)}>Skip</button>
      </div>
    </div>
  )
}
