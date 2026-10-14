import { useEffect } from 'react'
import { useGame } from '../game/store'
import { BUILDINGS, CARS, GP_SERIES, type BuildingDef } from '../game/data'
import { BuildingThumb, CarThumb } from '../scene/BuildingPreview'
import { heroArt } from './venueArt'
import { TUTORIAL_STEPS } from './Tutorial'
import './goal.css'

type Game = ReturnType<typeof useGame.getState>

// The dream car at the top of the ladder: the Legends Series prize.
const DREAM = CARS.find((c) => c.id === 'lambo') ?? CARS[CARS.length - 1]
// Every car a player can own for keeps (season prizes come and go).
const COLLECTABLE = CARS.filter((c) => !c.season)
const bldg = (id: string) => BUILDINGS.find((b) => b.id === id) as BuildingDef

// What there is to do, each shown as the real thing: the building it lives in or a shot of the race.
const FEATURES: { id: string; name: string; level: number; art: () => React.ReactNode }[] = [
  { id: 'rescue', name: 'Find cars', level: 1, art: () => <BuildingThumb def={bldg('rescue')} /> },
  { id: 'race', name: 'Race', level: 1, art: () => <div className="goal-shot" style={{ backgroundImage: `url(${heroArt('tour')})` }} /> },
  { id: 'garage', name: 'Upgrade', level: 1, art: () => <BuildingThumb def={bldg('garage')} /> },
  { id: 'gp', name: 'Grand Prix', level: GP_SERIES[0].unlockLevel, art: () => <div className="goal-shot" style={{ backgroundImage: `url(${heroArt('gp')})` }} /> },
  { id: 'crew', name: 'Crews', level: bldg('crew').unlockLevel, art: () => <BuildingThumb def={bldg('crew')} /> },
  { id: 'arcade', name: 'Arcade', level: bldg('arcade').unlockLevel, art: () => <BuildingThumb def={bldg('arcade')} /> },
]

// Shows once, right after the tutorial's last step, over the plain town.
// It waits for the level-up splash (the tutorial's last steps often level you up), so the two never stack.
const due = (s: Game) => s.tutorial === TUTORIAL_STEPS && !s.levelUp && !s.panel && !s.visiting && s.mode === 'play'

// The end of the tutorial: what you're playing for, and what there is to do.
export function GoalSplash() {
  const show = useGame(due)
  const level = useGame((s) => s.level)
  const owned = useGame((s) => new Set(s.cars.map((c) => c.model)).size)
  const cups = useGame((s) => GP_SERIES.filter((g) => (s.gp[g.id]?.clears ?? 0) > 0).length)
  const finish = useGame((s) => s.setTutorial)
  const close = () => finish(99)

  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish(99)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show, finish])

  if (!show) return null
  return (
    <div className="overlay lvl-overlay goal-overlay">
      <div className="lvl-rays" aria-hidden />
      <div className="lvl goal" role="dialog" aria-label="Chase the dream">
        <div className="goal-hero" aria-hidden>
          <CarThumb body={DREAM.body} model={DREAM.id} color={DREAM.colors[0]} />
        </div>
        <div className="goal-text">
          <h2 className="lvl-title">Chase the dream</h2>
          <p className="lvl-sub">Collect every car. Become a racing Legend.</p>
          <div className="lvl-rewards">
            <span className="lvl-chip" title="Cars collected">🚗 {owned} / {COLLECTABLE.length}</span>
            <span className="lvl-chip" title="Grand Prix cups won">🏆 {cups} / {GP_SERIES.length}</span>
          </div>
        </div>
        <div className="lvl-items goal-items">
          {FEATURES.map((f, i) => (
            <div key={f.id} className={`card lvl-item goal-item${level < f.level ? ' locked' : ''}`} style={{ '--i': i } as React.CSSProperties}>
              {f.art()}
              <div className="card-name">{f.name}</div>
              {level < f.level && <span className="goal-lock" title={`Unlocks at level ${f.level}`}>🔒 {f.level}</span>}
            </div>
          ))}
        </div>
        <button className="buy lvl-continue" onClick={close}>Let's go!</button>
      </div>
    </div>
  )
}
