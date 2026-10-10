import { useEffect } from 'react'
import { useGame } from '../game/store'

// Steps either wait for the player to do something (`done`) or for a tap on Next.
const STEPS: { text: string; done?: (s: ReturnType<typeof useGame.getState>) => boolean }[] = [
  { text: "Welcome to Cartopia! Build your town, collect cars and race. Let's earn some coins." },
  { text: 'Tap the ⛽ bubble above a Pizza Place to send a car on a job.', done: (s) => s.buildings.some((b) => b.jobEndsAt !== null) || s.stats.jobs > 0 },
  { text: 'Jobs take a little while. When the gold $ bubble pops up, tap it to collect.', done: (s) => s.stats.jobs > 0 },
  { text: 'Nice! Every car you own drives around your roads. Visit the Showroom to buy more.' },
  { text: 'Upgrade cars in the Garage, then hit RACE to win coins and trophies. Have fun!' },
]

export function Tutorial() {
  const step = useGame((s) => s.tutorial)
  const setStep = useGame((s) => s.setTutorial)
  const panel = useGame((s) => s.panel)
  const visiting = useGame((s) => !!s.visiting)
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

  if (!cur || panel === 'daily' || visiting) return null
  return (
    <div className="tutorial">
      <span className="tut-step">{step + 1}/{STEPS.length}</span>
      <p>{cur.text}</p>
      <div className="row">
        {!cur.done && <button className="buy small" onClick={() => setStep(step + 1)}>{step === STEPS.length - 1 ? "Let's go!" : 'Next'}</button>}
        <button className="tut-skip" onClick={() => setStep(99)}>Skip tutorial</button>
      </div>
    </div>
  )
}
