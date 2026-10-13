import { useGame, type OwnedCar } from '../game/store'
import { carDef, type Finish } from '../game/data'
import { DIST } from '../game/distance'
import { CAR_CLASSES, carClass, classOf, classesOf, type CarClassId } from '../game/classes'
import { CUP_CRATE, CUP_RACES, cupFits, cupPrize, cupRace, cupRacesOf, cupWon, type CupRace } from '../game/cups'
import { crateDef } from '../game/crates'
import { CLASS_TIERS, MASTERY_TIERS, classNeed, classTier, emptyMastery, firstPaint, galaxy, masteredIn, masteryBadge, needProgress } from '../game/mastery'
import { venue as venueById } from '../scene/venues'
import { CarThumb } from '../scene/BuildingPreview'
import { openRaceTab } from './raceNav'
import { artStyle } from './venueArt'
import { TileClip } from './TileClip'

// Class Cups screen (game/cups.ts): pick a class, then one of its three races. Only a car of
// that class can race; the bar's button races the picked one. The left side shows the race,
// how far the car you race with is along its mastery ladder (game/mastery.ts) and its classes'
// Gold and Diamond; the right side the race's first-win prize, a free crate.

const money = (n: number) => (n >= 10000 ? `$${Math.round(n / 1000)}k` : `$${n.toLocaleString()}`)
const won = (cups: Record<string, number> | undefined, r: CupRace) => (cups?.[r.id] ?? 0) > 0

let nextPick: string | null = null
export function firstCupPick(cups: Record<string, number> | undefined, car: OwnedCar | undefined) {
  const asked = nextPick
  nextPick = null
  const mine = car ? classOf(car.model).id : null
  return asked ?? (CUP_RACES.find((r) => r.cls === mine && !won(cups, r)) ?? CUP_RACES.find((r) => r.cls === mine) ?? CUP_RACES[0]).id
}
export function openCup(id: string) {
  nextPick = id
  openRaceTab('cups')
}
export const cupPrizeOf = (r: CupRace, cups: Record<string, number> | undefined) => cupPrize(r, !won(cups, r))
export const cupChip = (cups: Record<string, number> | undefined) => `🏆 ${CAR_CLASSES.filter((c) => cupWon(cups, c.id)).length}/${CAR_CLASSES.length}`

// The four mastery tiers of one car: each tier's medal, lit once reached, with the
// count it needs while it's the next one.
export function MasteryLadder({ model }: { model: string }) {
  const m = useGame((s) => s.mastery?.[model]) ?? emptyMastery()
  return (
    <div className="ms-ladder" role="list" aria-label={`${carDef(model).name} mastery`}>
      {MASTERY_TIERS.map((t, i) => {
        const got = m.tier > i
        const next = m.tier === i
        const [have, of] = needProgress(m, t)[0]
        return (
          <span key={t.id} role="listitem" className={`ms-tier${got ? ' got' : ''}${next ? ' next' : ''}`} title={`${t.name}: ${Object.entries(t.need).map(([k, v]) => `${v} ${k}`).join(', ')} · 💎 ${t.bucks}`}>
            <i>{t.icon}</i>
            <b>{t.name}</b>
            <small>{got ? '✔' : next ? `${have}/${of}` : '🔒'}</small>
          </span>
        )
      })}
    </div>
  )
}

// The car's top mastery medal, for car cards.
export function MasteryMedal({ model }: { model: string }) {
  const b = masteryBadge(useGame((s) => s.mastery?.[model]?.tier ?? 0))
  return b ? <span className="ms-medal" title={`${b.name} mastery`}>{b.icon}</span> : null
}

// Class mastery for a car's classes: cars mastered towards Gold and Diamond, and Galaxy.
export function ClassTiers({ model }: { model: string }) {
  const all = useGame((s) => s.mastery)
  const sky = galaxy(all)
  return (
    <div className="ms-classes" role="list" aria-label="Class mastery">
      {classesOf(model).map((c) => {
        const tier = classTier(all, c.id)
        const need = classNeed(c.id)
        const goal = tier >= 1 ? need.diamond : need.gold
        const t = CLASS_TIERS[Math.min(tier, 1)]
        return (
          <span key={c.id} role="listitem" className={`ms-class${tier >= 2 ? ' got' : ''}`} title={`${c.name}: ${CLASS_TIERS[0].name} at ${need.gold} cars mastered, ${CLASS_TIERS[1].name} at ${need.diamond}`}>
            <i>{c.icon}</i><b>{c.name}</b>
            <small>{tier >= 2 ? `${CLASS_TIERS[1].icon} ✔` : `${t.icon} ${masteredIn(all, c.id)}/${goal}`}</small>
          </span>
        )
      })}
      <span role="listitem" className={`ms-class${sky ? ' got' : ''}`} title="Galaxy: Diamond in every class">
        <i>{CLASS_TIERS[2].icon}</i><b>{CLASS_TIERS[2].name}</b>
        <small>{sky ? '✔' : `${CAR_CLASSES.filter((c) => classTier(all, c.id) >= 2).length}/${CAR_CLASSES.length}`}</small>
      </span>
    </div>
  )
}

export function ClassCups({ sel, setSel, car }: { sel: string; setSel: (id: string) => void; car: OwnedCar | undefined }) {
  const cups = useGame((s) => s.cups)
  const r = cupRace(sel) ?? CUP_RACES[0]
  const cls = carClass(r.cls)
  const v = venueById(r.venue)
  const hc = carDef(r.car)
  const fits = car ? cupFits(r, car.model) : false
  const crate = crateDef(CUP_CRATE)!
  const got = won(cups, r)
  const pickClass = (id: CarClassId) => setSel((cupRacesOf(id).find((x) => !won(cups, x)) ?? cupRacesOf(id)[0]).id)
  return (
    <div className="rm-split rm-prow rm-tuner rm-cups" style={{ '--pr': r.color } as React.CSSProperties}>
      <div className="rm-left">
        <div className={`rm-banner rm-photo${r.night ? ' rm-night' : ''}`} style={artStyle('tour', r.venue, r.night)}>
          <TileClip mode="tour" venue={r.venue} night={r.night} />
          <span className="rm-eyebrow">{v.icon} {v.name}{r.night && ' · 🌙'} · {DIST[r.dist].label}</span>
          <b className="rm-ttl">{cls.icon} {cls.name} Cup</b>
          <span className="tt-host"><CarThumb size="sm" color={r.color} body={hc.body} model={hc.id} /></span>
          <span className="rm-chips">
            <span>{'🏆'.repeat(r.tier)}</span>
            <span>PI {r.pi}</span>
            <span className={won(cups, r) ? 'got' : ''}>{won(cups, r) ? `✔ ×${cups![r.id]}` : `🏁 ${money(cupPrizeOf(r, cups))}`}</span>
            {car && !fits && <span className="cup-need">{cls.icon} only</span>}
          </span>
        </div>
        {car && <MasteryLadder model={car.model} />}
        {car && <ClassTiers model={car.model} />}
      </div>
      <div className="rm-right">
        <div className="cup-classes" role="tablist" aria-label="Classes">
          {CAR_CLASSES.map((c) => (
            <button key={c.id} role="tab" aria-selected={c.id === r.cls} title={c.blurb} className={`cup-class${c.id === r.cls ? ' sel' : ''}${cupWon(cups, c.id) ? ' done' : ''}`} onClick={() => pickClass(c.id)}>
              <i>{c.icon}</i><b>{c.name}</b>{cupWon(cups, c.id) && <span className="pr-tick" aria-hidden>✔</span>}
            </button>
          ))}
        </div>
        <div className="pr-grid cup-grid" role="listbox" aria-label={`${cls.name} Cup`}>
          {cupRacesOf(r.cls).map((x) => {
            const xc = carDef(x.car)
            return (
              <button key={x.id} role="option" aria-selected={x.id === r.id} aria-label={xc.name} title={xc.name}
                className={`pr-tile t${x.tier}${x.id === r.id ? ' sel' : ''}${won(cups, x) ? ' done' : ''}`} style={{ '--pr': x.color } as React.CSSProperties}
                onClick={() => setSel(x.id)}>
                <CarThumb size="xs" color={x.color} body={xc.body} model={xc.id} />
                {won(cups, x) && <span className="pr-tick" aria-hidden>✔</span>}
                <small>{'🏆'.repeat(x.tier)}</small>
                <b>PI {x.pi}</b>
              </button>
            )
          })}
        </div>
        <div className={`ev-reward pr-reward tt-reward cup-reward${got ? ' got' : ''}`}>
          <div className="ev-reward-car">
            <span className="cup-crate" aria-hidden>📦</span>
            <span className="ev-reward-state">{got ? '✔' : '🎁'}</span>
          </div>
          <div className="ev-reward-info">
            <b>{crate.name}</b>
            <span className="ev-reward-chips"><em>🎁 First win</em></span>
          </div>
        </div>
      </div>
    </div>
  )
}

// A cup race's first win: its free crate, and a button to go open it.
export function CupPrizePopup() {
  const id = useGame((s) => s.cupPrize)
  const close = useGame((s) => s.closeCupPrize)
  const r = id ? cupRace(id) : undefined
  if (!r) return null
  const cls = carClass(r.cls)
  const open = () => {
    close()
    useGame.getState().openPanel('crates')
  }
  return (
    <div className="overlay prize-overlay">
      <div className="prize pr-prize" style={{ '--pr': r.color } as React.CSSProperties}>
        <h2>{cls.icon} {cls.name} Cup {'🏆'.repeat(r.tier)} won!</h2>
        <span className="cup-crate big" aria-hidden>📦</span>
        <h3>🎁 Free {crateDef(CUP_CRATE)!.name}</h3>
        <div className="row">
          <button onClick={close}>Later</button>
          <button className="buy" onClick={open}>Open it</button>
        </div>
      </div>
    </div>
  )
}

// What a finished race unlocked in mastery: a car's step (and its gems), a class's Gold or
// Diamond, Galaxy, or a class colour from a first win. The car shows the best new look.
export function MasteryPrizePopup() {
  const p = useGame((s) => s.masteryPrize)
  const close = useGame((s) => s.closeMasteryPrize)
  const cars = useGame((s) => s.cars)
  if (!p) return null
  const t = p.tier > 0 ? MASTERY_TIERS[Math.min(p.tier, MASTERY_TIERS.length) - 1] : null
  const top = p.classes.reduce<{ cls: CarClassId; tier: number } | null>((a, c) => (!a || c.tier > a.tier ? c : a), null)
  const d = carDef(p.model)
  const car = cars.find((c) => c.model === p.model)
  const color = p.first.length ? firstPaint(p.first[0]) : car?.color ?? d.colors[0]
  const finish: Finish | undefined = p.galaxy ? 'galaxy' : top ? (top.tier >= 2 ? 'diamond' : 'gold') : undefined
  const look = finish ? { finish } : t?.id === 'signature' ? { panels: { body: { pattern: 'signature' } } } : {}
  const title = p.galaxy ? `${CLASS_TIERS[2].icon} ${CLASS_TIERS[2].name}!`
    : top ? `${CLASS_TIERS[top.tier - 1].icon} ${carClass(top.cls).name} ${CLASS_TIERS[top.tier - 1].name}!`
    : t ? `${t.icon} ${t.name} mastery!` : '🎨 New colour!'
  return (
    <div className="overlay prize-overlay">
      <div className="prize pr-prize ms-prize">
        <h2>{title}</h2>
        <CarThumb size="lg" color={color} body={d.body} model={d.id} mods={car?.mods} {...look} />
        {t && <h3>{d.name} · 💎 +{t.bucks}{t.trophies ? ` · 🏆 +${t.trophies}` : ''}</h3>}
        {p.first.map((c) => <h3 key={c}>🎨 {carClass(c).name} colour unlocked</h3>)}
        {t && <MasteryLadder model={p.model} />}
        <div className="row"><button className="buy" onClick={close}>Nice!</button></div>
      </div>
    </div>
  )
}
