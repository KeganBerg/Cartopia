import { useEffect, useState } from 'react'
import { useGame, fuelCap } from '../game/store'
import { FUEL_REGEN_SECONDS, PAINTS, RACE_FUEL, STARTER_PAINTS, buildingDef, carDef, upgradeFuelCap } from '../game/data'
import { raceCarOf } from '../game/raceCar'
import { CarThumb } from '../scene/BuildingPreview'

type Game = ReturnType<typeof useGame.getState>
// What the current step points at: it pulses so the player knows where to tap.
export type TutTarget = 'pizza' | 'shop' | 'rescue' | 'done' | 'race'

const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const editing = (s: Game) => s.mode !== 'play'

// Steps either wait for the player to do something (`done`) or for a tap on Next.
// One short line each; the pulsing target does the rest of the explaining.
// pick: the step is the paint and rims picker. gas: the step shows the gas numbers.
// Saves keep the step number, so new steps go in before the race prompt: a save part way
// through lands on a step that moves on by itself or by a tap, and 99 (done) never changes.
type Step = { icon: string; text: (s: Game) => string; target?: (s: Game) => TutTarget | null; done?: (s: Game) => boolean; pick?: true; gas?: true }
const STEPS: Step[] = [
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
  { icon: '🎨', text: () => 'Make it yours: one paint, one set of rims.', pick: true },
  { icon: '⛽', text: () => 'Races use gas. It refills, and Gas Stations hold more.', gas: true },
  { icon: '🏁', text: () => 'While Rusty works, tap RACE for your first race!', target: () => 'race', done: (s) => s.panel === 'race' || (s.stats.races ?? 0) > 0 },
]

// After the last step the goal screen shows (GoalSplash), then the tutorial is done (99).
export const TUTORIAL_STEPS = STEPS.length

// The thing to pulse right now, or null when the tutorial isn't pointing anywhere.
export function tutTarget(s: Game): TutTarget | null {
  const st = STEPS[s.tutorial]
  if (!st?.target || s.visiting || s.panel) return null
  return st.target(s)
}

// Is the tutorial card on screen? Other hints stay quiet so one instruction shows at a time.
export const tutorialShowing = (s: Game) => !!STEPS[s.tutorial] && !s.panel && !s.visiting

// Skipping at or before this step keeps the free paint pick for the Paint Shop.
const PICK_STEP = STEPS.findIndex((s) => s.pick)

// The make-it-yours step offers the colours every new town has, for the body and the rims.
const paintName = (c: string) => PAINTS.find((p) => p.color === c)?.name ?? c
// What a Gas Station adds to the tank.
const GAS_CAP = upgradeFuelCap(buildingDef('gas'), 1)

// The gas step: what a race costs, how fast it comes back, the tank, and what a station adds.
function GasFacts() {
  const fuel = useGame((s) => Math.floor(s.fuel))
  const cap = useGame(fuelCap)
  return (
    <div className="tut-chips">
      <span title="Each race">🏁 −{RACE_FUEL}⛽</span>
      <span title="Refills over time">⏱ +1⛽/{FUEL_REGEN_SECONDS / 60}m</span>
      <span title="Your tank">⛽ {fuel}/{cap}</span>
      <span title="Each Gas Station adds">⛽🏪 +{GAS_CAP}</span>
    </div>
  )
}

function Swatches({ icon, label, value, onPick }: { icon: string; label: string; value: string | null; onPick: (c: string) => void }) {
  return (
    <div className="tut-swatches" role="radiogroup" aria-label={label}>
      <span aria-hidden>{icon}</span>
      {STARTER_PAINTS.map((c) => (
        <button key={c} role="radio" aria-checked={value === c} title={paintName(c)} aria-label={paintName(c)} className={value === c ? 'dot sel' : 'dot'} style={{ background: c }} onClick={() => onPick(c)} />
      ))}
    </div>
  )
}

export function Tutorial() {
  const step = useGame((s) => s.tutorial)
  const setStep = useGame((s) => s.setTutorial)
  const text = useGame((s) => STEPS[s.tutorial]?.text(s))
  const hidden = useGame((s) => !!s.panel || !!s.visiting)
  const car = useGame((s) => raceCarOf(s.cars, s.raceCar))
  const [paint, setPaint] = useState<string | null>(null)
  const [rim, setRim] = useState<string | null>(null)
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
  // The picker needs a car; with none it's a plain Next step.
  const pick = cur.pick && car
  const apply = () => {
    if (car && paint && rim && useGame.getState().tutorialStyle(car.uid, paint, rim)) setStep(step + 1)
  }
  return (
    <div className="tutorial" key={step}>
      {pick ? (
        <div className="tut-car" aria-hidden>
          <CarThumb size="xs" body={carDef(car.model).body} model={car.model} color={paint ?? car.color} finish={car.finish} stripe={car.stripe} mods={car.mods}
            panels={{ ...car.panels, ...(rim ? { rims: { color: rim } } : {}) }} />
        </div>
      ) : <span className="tut-icon" aria-hidden>{cur.icon}</span>}
      <div className="tut-body">
        <p>{text}</p>
        {cur.gas && <GasFacts />}
        {pick && (
          <>
            <Swatches icon="🎨" label="Paint" value={paint} onPick={setPaint} />
            <Swatches icon="🛞" label="Rims" value={rim} onPick={setRim} />
          </>
        )}
        <div className="tut-dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => <i key={i} className={i < step ? 'on' : i === step ? 'cur' : ''} />)}
        </div>
      </div>
      <div className="tut-actions">
        {pick ? <button className="buy small" disabled={!paint || !rim} onClick={apply}>Done</button>
          : !cur.done && <button className="buy small" onClick={() => setStep(step + 1)}>Next</button>}
        <button className="tut-skip" onClick={() => useGame.getState().skipTutorial(PICK_STEP)}>Skip</button>
      </div>
    </div>
  )
}
