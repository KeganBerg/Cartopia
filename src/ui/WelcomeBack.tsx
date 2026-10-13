import { useEffect, useState } from 'react'
import { useGame, hasRusty, readyRewards, fuelCap, today } from '../game/store'
import { buildingDef, carDef } from '../game/data'
import { BuildingThumb } from '../scene/BuildingPreview'
import { Panel } from './Menus'

// When this browser last had the game open, kept fresh while the tab is visible.
const SEEN_KEY = 'cartopia-last-seen'
const HEARTBEAT_MS = 15_000
// Shorter breaks (a quick tab switch) don't earn a welcome.
const AWAY_MS = 5 * 60_000

function readSeen() {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0
  } catch {
    return 0
  }
}
function writeSeen(t = Date.now()) {
  try {
    localStorage.setItem(SEEN_KEY, String(t))
  } catch {
    // Private mode: no welcome back after a reload.
  }
}

function awayText(ms: number) {
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`
  const d = Math.floor(h / 24)
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`
}

// Something waiting is what makes a welcome worth showing.
function hasNews(s: ReturnType<typeof useGame.getState>, now: number) {
  const r = readyRewards(s, now)
  return r.collected + r.cleared + r.filled > 0 || (!!s.restoring && now >= s.restoring.endsAt) || (!!s.restoring2 && now >= s.restoring2.endsAt)
}

let awayFor = 0

function tryOpen(ms: number) {
  const s = useGame.getState()
  // Not over another menu, a level-up, a friend's town, or a brand new player's tutorial.
  if (s.panel || s.levelUp || s.visiting || s.mode !== 'play' || !hasRusty(s) || !hasNews(s, Date.now())) return
  awayFor = ms
  s.openPanel('welcome')
}

// Watches for the player coming back (a fresh load or a tab that sat hidden)
// and shows what finished while they were gone.
export function WelcomeBack() {
  const panel = useGame((s) => s.panel)
  useEffect(() => {
    const comeBack = (delay: number) => {
      const since = readSeen()
      writeSeen()
      const ms = Date.now() - since
      // No record means a first visit on this browser: nothing to welcome back to.
      if (since && ms >= AWAY_MS) setTimeout(() => tryOpen(ms), delay)
    }
    // Opened before the daily bonus check, which then waits for this to close.
    comeBack(600)
    const beat = setInterval(() => document.visibilityState === 'visible' && writeSeen(), HEARTBEAT_MS)
    const onVis = () => (document.visibilityState === 'visible' ? comeBack(400) : writeSeen())
    const onHide = () => writeSeen()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onHide)
    return () => {
      clearInterval(beat)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onHide)
    }
  }, [])
  return panel === 'welcome' ? <WelcomePanel away={awayFor} /> : null
}

function WelcomePanel({ away }: { away: number }) {
  const buildings = useGame((s) => s.buildings)
  const cars = useGame((s) => s.cars)
  const level = useGame((s) => s.level)
  const restoring = useGame((s) => s.restoring)
  const tankFull = useGame((s) => s.fuel >= fuelCap(s))
  const collectAll = useGame((s) => s.collectAll)
  const openPanel = useGame((s) => s.openPanel)
  const [now] = useState(() => Date.now())
  const r = readyRewards({ buildings, cars, level }, now)
  const restored = restoring && now >= restoring.endsAt ? carDef(restoring.model) : null
  const empty = r.collected + r.cleared + r.filled === 0 && !restored

  // Closing hands over to the daily bonus if it hasn't been claimed yet.
  const close = () => {
    const s = useGame.getState()
    if (s.panel === 'welcome') s.openPanel(s.lastDaily !== today() ? 'daily' : null)
  }
  // A cloud save can load with nothing waiting: step aside instead of showing an empty welcome.
  useEffect(() => { if (empty) close() }, [empty])
  if (empty) return null

  const collect = () => {
    if (r.collected + r.cleared + r.filled > 0) collectAll(true)
    // A car Rusty finished still needs its plate, so go there next.
    if (restored) openPanel('rescue')
    else close()
  }

  return (
    <Panel title="Welcome back!" onClose={close}>
      <p className="hint welcome-sub">⏱ Away {awayText(away)}</p>
      {(r.coins > 0 || r.parts > 0 || r.xp > 0) && (
        <div className="lvl-rewards welcome-rewards">
          {r.coins > 0 && <span className="lvl-chip"><span className="ico coin-ico">$</span>+{r.coins.toLocaleString()}</span>}
          {r.parts > 0 && <span className="lvl-chip">⚙ +{r.parts}</span>}
          {r.xp > 0 && <span className="lvl-chip">⭐ +{r.xp} XP</span>}
        </div>
      )}
      <div className="cards rows welcome-list">
        {r.jobs.map((j) => {
          const d = buildingDef(j.def)
          return (
            <div key={j.def} className="card">
              <BuildingThumb def={d} />
              <div className="card-text">
                <div className="card-name">{d.name}</div>
                <div className="card-stat">{j.n} job{j.n > 1 ? 's' : ''} finished</div>
              </div>
              <span className="price">$ {j.coins.toLocaleString()}</span>
            </div>
          )
        })}
        {r.cleared > 0 && <Row icon="🪓" name={`${r.cleared} obstacle${r.cleared > 1 ? 's' : ''} cleared`} stat="More room to build" />}
        {r.filled > 0 && <Row icon="⛽" name={`${r.filled} car${r.filled > 1 ? 's' : ''} out of gas`} stat="Your Gas Station fills them up" />}
        {restored && <Row icon="🔧" name={`Rusty restored your ${restored.name}`} stat="Give it a plate to drive it" />}
        {tankFull && <Row icon="⛽" name="Fuel tank refilled" stat="Ready for more jobs" />}
      </div>
      <div className="welcome-actions">
        <button className="buy welcome-collect" onClick={collect}>{r.collected + r.cleared + r.filled > 0 ? 'Collect all' : "Go to Rusty's"}</button>
      </div>
    </Panel>
  )
}

function Row({ icon, name, stat }: { icon: string; name: string; stat: string }) {
  return (
    <div className="card">
      <div className="welcome-ico" aria-hidden>{icon}</div>
      <div className="card-text">
        <div className="card-name">{name}</div>
        <div className="card-stat">{stat}</div>
      </div>
    </div>
  )
}
