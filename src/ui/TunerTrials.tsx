import { useGame, type OwnedCar } from '../game/store'
import { CARS, MAX_UPGRADE, MODS, MOD_SLOTS, carDef, patternDef, type UpgradeSlot } from '../game/data'
import { DIST } from '../game/distance'
import { TUNER_TRIALS, buildChecks, hostMods, tunerPrize, tunerTrial, type BuildCheck, type TunerTrial } from '../game/tuner'
import { venue as venueById } from '../scene/venues'
import { CarThumb } from '../scene/BuildingPreview'
import { openGarageTab } from './Menus'
import { openRaceTab } from './Race'
import { artStyle } from './venueArt'
import { TileClip } from './TileClip'

// Tuner Trials screen (game/tuner.ts): each trial's host car built for it, the parts and
// tuning it asks for checked against your race car, and the prize. The race bar's button
// races the picked trial, or opens the Garage when the build isn't ready.

const flames = (t: TunerTrial) => '🔥'.repeat(t.tier)
const money = (n: number) => (n >= 10000 ? `$${Math.round(n / 1000)}k` : `$${n.toLocaleString()}`)
const TUNE: Record<UpgradeSlot, { icon: string; name: string }> = {
  engine: { icon: '⚡', name: 'Speed' }, turbo: { icon: '🌀', name: 'Boost' }, tires: { icon: '🧲', name: 'Grip' }, weight: { icon: '🪶', name: 'Weight' },
}
const modIcon = (slot: string) => MOD_SLOTS.find((m) => m.id === slot)!
// Tyres a trial asks for by name: shown by the surface they grip on.
const TREAD: Record<string, { icon: string; name: string }> = { snowstuds: { icon: '❄️', name: 'Snow tires' }, sandtires: { icon: '🏜️', name: 'Sand tires' }, raintires: { icon: '🌧️', name: 'Rain tires' } }
const won = (tuner: Record<string, number> | undefined, t: TunerTrial) => (tuner?.[t.id] ?? 0) > 0

let nextPick: string | null = null
export function firstTrialPick(tuner: Record<string, number> | undefined) {
  const asked = nextPick
  nextPick = null
  return asked ?? (TUNER_TRIALS.find((t) => !won(tuner, t)) ?? TUNER_TRIALS[0]).id
}
export function openTunerTrial(id: string) {
  nextPick = id
  openRaceTab('tuner')
}
export const trialPrizeOf = (t: TunerTrial, tuner: Record<string, number> | undefined) => tunerPrize(t, !won(tuner, t))
// Where to fix the first unmet line of a build: the parts shop or the tuning bench.
export const fixBuild = (car: OwnedCar, checks: BuildCheck[]) => {
  const miss = checks.find((c) => !c.ok)
  if (miss) openGarageTab(miss.kind === 'mod' ? 'mods' : 'tune', { car: car.uid })
}

function CheckRow({ c, onFix }: { c: BuildCheck; onFix: () => void }) {
  if (c.kind === 'mod') {
    const m = modIcon(c.slot)
    const tread = c.ids ? TREAD[c.ids[0]] : undefined
    const names = c.ids?.map((id) => MODS.find((x) => x.id === id)?.name).join(' / ')
    return (
      <button className={`tt-check${c.ok ? ' ok' : ''}`} onClick={onFix} disabled={c.ok} title={names ?? m.name}>
        <span className="tt-ico">{tread?.icon ?? m.icon}</span>
        <b>{tread?.name ?? m.name.replace(/s$/, '')}</b>
        <span className="tt-mark">{c.ok ? '✔' : '✗'}</span>
      </button>
    )
  }
  const u = TUNE[c.slot]
  return (
    <button className={`tt-check${c.ok ? ' ok' : ''}`} onClick={onFix} disabled={c.ok} title={`${u.name} ${c.have}/${c.need}`}>
      <span className="tt-ico">{u.icon}</span>
      <b>{u.name}</b>
      <span className="pips">{Array.from({ length: MAX_UPGRADE }, (_, i) => <i key={i} className={i < c.have ? 'on' : i < c.need ? 'need' : ''} />)}</span>
      <span className="tt-mark">{c.ok ? '✔' : '✗'}</span>
    </button>
  )
}

export function TunerTrials({ sel, setSel, car }: { sel: string; setSel: (id: string) => void; car: OwnedCar | undefined }) {
  const tuner = useGame((s) => s.tuner)
  const t = tunerTrial(sel) ?? TUNER_TRIALS[0]
  const beaten = won(tuner, t)
  const v = venueById(t.venue)
  const hc = carDef(t.car)
  const d = car ? carDef(car.model) : CARS[0]
  const checks = car ? buildChecks(t, car) : []
  const pat = t.pattern ? patternDef(t.pattern) : undefined
  return (
    <div className="rm-split rm-prow rm-tuner" style={{ '--pr': t.color } as React.CSSProperties}>
      <div className="rm-left">
        <div className={`rm-banner rm-photo${t.night ? ' rm-night' : ''}`} style={artStyle('tour', t.venue, t.night)}>
          <TileClip mode="tour" venue={t.venue} night={t.night} />
          <span className="rm-eyebrow">{v.icon} {v.name}{t.night && ' · 🌙'} · {DIST[t.dist].label}</span>
          <b className="rm-ttl">{t.icon} {t.name}</b>
          <span className="tt-host"><CarThumb size="sm" color={t.color} body={hc.body} model={hc.id} mods={hostMods(t)} /></span>
          <span className="rm-chips">
            <span>{flames(t)}</span>
            <span>PI {t.pi}</span>
            <span className={beaten ? 'got' : ''}>{beaten ? `✔ ×${tuner![t.id]}` : `🏁 ${money(trialPrizeOf(t, tuner))}`}</span>
          </span>
        </div>
        <div className="tt-build" role="list" aria-label="Build">
          {checks.map((c) => <CheckRow key={`${c.kind}-${c.slot}`} c={c} onFix={() => car && fixBuild(car, checks)} />)}
        </div>
      </div>
      <div className="rm-right">
        <div className="pr-grid tt-grid" role="listbox" aria-label="Tuner Trials">
          {TUNER_TRIALS.map((x) => {
            const xc = carDef(x.car)
            const ready = car ? buildChecks(x, car).every((c) => c.ok) : false
            return (
              <button key={x.id} role="option" aria-selected={x.id === t.id} aria-label={x.name} title={x.name}
                className={`pr-tile t${x.tier}${x.id === t.id ? ' sel' : ''}${won(tuner, x) ? ' done' : ''}`} style={{ '--pr': x.color } as React.CSSProperties}
                onClick={() => setSel(x.id)}>
                <CarThumb size="xs" color={x.color} body={xc.body} model={xc.id} mods={hostMods(x)} />
                <span className="pr-face" aria-hidden>{x.icon}</span>
                {won(tuner, x) ? <span className="pr-tick" aria-hidden>✔</span> : !ready && <span className="pr-tick tt-wrench" aria-hidden>🔧</span>}
                <small>{flames(x)}{x.pattern && ' 🎨'}</small>
                <b>PI {x.pi}</b>
              </button>
            )
          })}
        </div>
        {pat && (
          <div className={`ev-reward pr-reward tt-reward${beaten ? ' got' : ''}`}>
            <div className="ev-reward-car">
              <CarThumb size="lg" color={car?.color ?? t.color} finish={car?.finish} body={d.body} model={d.id} mods={car?.mods} panels={{ body: { pattern: pat.id } }} />
              <span className="ev-reward-state">{beaten ? '✔' : '🔒'}</span>
            </div>
            <div className="ev-reward-info">
              <b>{pat.name}</b>
              <span className="ev-reward-chips"><em>🖌️ Pattern</em></span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const trialChip = (tuner: Record<string, number> | undefined) => `🔧 ${TUNER_TRIALS.filter((t) => won(tuner, t)).length}/${TUNER_TRIALS.length}`

// After the first win in a trial that pays a pattern: the pattern on your car, and a button to paint it.
export function TunerPrizePopup() {
  const id = useGame((s) => s.tunerPrize)
  const close = useGame((s) => s.closeTunerPrize)
  const cars = useGame((s) => s.cars)
  const raceCar = useGame((s) => s.raceCar)
  const t = id ? tunerTrial(id) : null
  const pat = t?.pattern ? patternDef(t.pattern) : undefined
  if (!t || !pat) return null
  const car = cars.find((c) => c.uid === raceCar) ?? cars[0]
  const d = car ? carDef(car.model) : CARS[0]
  const paintIt = () => {
    close()
    if (car) openGarageTab('custom', { car: car.uid })
  }
  return (
    <div className="overlay prize-overlay">
      <div className="prize pr-prize" style={{ '--pr': t.color } as React.CSSProperties}>
        <h2>{t.icon} {t.name} won!</h2>
        <CarThumb size="lg" color={car?.color ?? t.color} finish={car?.finish} body={d.body} model={d.id} mods={car?.mods} panels={{ body: { pattern: pat.id } }} />
        <h3>🖌️ {pat.name} unlocked</h3>
        <div className="row">
          <button className="buy alt" onClick={close}>Nice!</button>
          {car && <button className="buy" onClick={paintIt}>🖌️ Paint it</button>}
        </div>
      </div>
    </div>
  )
}
