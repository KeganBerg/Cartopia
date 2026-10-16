import { useEffect, useState } from 'react'
import { useGame, type OwnedCar } from '../game/store'
import { carDef, performance } from '../game/data'
import { SHOWCASE_MAX, showcaseOf } from '../game/meet'
import { townToVisit } from '../lib/friends'
import { fetchMeet, likeDisplay, refreshLikes, useMeet, type Display } from '../lib/meet'
import { signedInUser } from '../lib/cloud'
import { CarThumb } from '../scene/BuildingPreview'
import { Panel } from './Menus'
import { SOCIAL_TITLE, SocialTabs } from './Social'
import { PlayerName } from './Username'
import { LoadingBand } from './Loading'
import { PlayerCardPopup } from './PlayerCard'
import { openPlayerCard } from '../lib/playerCard'

const Thumb = ({ car, size }: { car: OwnedCar; size?: 'sm' }) => {
  const d = carDef(car.model)
  return <CarThumb size={size} color={car.color} finish={car.finish} skin={car.skin} modSkin={car.modSkin} panels={car.panels} trim={car.trim} hat={car.hat} body={d.body} model={d.id} stripe={car.stripe} mods={car.mods} />
}

// A heart with the like count. Your own display just shows the count.
export function LikeButton({ owner, mine }: { owner: string; mine?: boolean }) {
  const l = useMeet((m) => m.likes[owner])
  const live = useMeet((m) => m.live)
  useEffect(() => {
    if (!useMeet.getState().likes[owner]) refreshLikes([owner]).catch(() => {})
  }, [owner])
  if (!l && !live) return null
  const n = l?.likes ?? 0
  if (mine) return <span className="meet-likes" title="Likes on your display">❤️ {n}</span>
  return (
    <button className={l?.liked ? 'buy small alt meet-like liked' : 'buy small meet-like'} disabled={l?.liked} onClick={() => likeDisplay(owner)} title={l?.liked ? 'Liked' : 'Like this town'}>
      {l?.liked ? '❤️' : '🤍'} {n}
    </button>
  )
}

// Garage toggle: put the car on show at the meet and on Main Street.
export function ShowcaseToggle({ car }: { car: string }) {
  const on = useGame((s) => (s.showcase ?? []).includes(car))
  const toggle = useGame((s) => s.toggleShowcase)
  return (
    <button className={on ? 'showcase-toggle on' : 'showcase-toggle'} onClick={() => toggle(car)} title="Cars on show cruise Main Street and line up at the Car Meet">
      {on ? '⭐ On show' : '☆ Show off'}
    </button>
  )
}

function MyDisplay() {
  const cars = useGame((s) => s.cars)
  const picks = useGame((s) => s.showcase)
  const toggle = useGame((s) => s.toggleShowcase)
  const [edit, setEdit] = useState(false)
  const shown = showcaseOf(cars, picks)
  const me = signedInUser()
  return (
    <div className="meet-mine">
      <div className="meet-head">
        <b>Your display</b>
        {me && <LikeButton owner={me} mine />}
        <button className="buy small alt" onClick={() => setEdit((e) => !e)}>{edit ? 'Done' : '✏️ Pick'}</button>
      </div>
      <div className="meet-lot">
        {shown.map((c) => (
          <div key={c.uid} className="meet-spot">
            <Thumb car={c} />
            <small>{carDef(c.model).name}</small>
          </div>
        ))}
        {Array.from({ length: SHOWCASE_MAX - shown.length }, (_, i) => (
          <button key={i} className="meet-spot empty" onClick={() => setEdit(true)} aria-label="Pick a car to show">＋</button>
        ))}
      </div>
      {edit && (
        <>
          <p className="hint">Pick up to {SHOWCASE_MAX}. {picks?.length ? '' : 'Showing your best cars for now.'}</p>
          <div className="meet-pick">
            {[...cars].sort((a, b) => performance(carDef(b.model), b.upgrades, b.mods) - performance(carDef(a.model), a.upgrades, a.mods)).map((c) => {
              const on = (picks ?? []).includes(c.uid)
              return (
                <button key={c.uid} className={on ? 'meet-chip on' : 'meet-chip'} onClick={() => toggle(c.uid)} aria-pressed={on} title={carDef(c.model).name}>
                  <Thumb car={c} size="sm" />
                  <span>{on ? '⭐' : '☆'}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function DisplayRow({ d }: { d: Display }) {
  const visit = useGame((s) => s.visit)
  const toast = useGame((s) => s.toast)
  const go = async () => {
    const town = await townToVisit(d.ownerId)
    if (town === 'stale') return
    if (!town) return toast("Couldn't load that town")
    visit(town)
  }
  return (
    <div className="meet-row">
      <button className="meet-who" onClick={() => openPlayerCard(d.ownerId, d.townName)} title="Profile">
        <b><PlayerName id={d.demo ? null : d.ownerId} town={d.townName} /></b>
        <div className="card-stat">⭐ {d.level}{d.demo ? ' · neighbour' : ''}</div>
      </button>
      <div className="meet-cars">
        {d.cars.map((c) => (
          <button key={c.uid} className="meet-car" onClick={() => openPlayerCard(d.ownerId, d.townName, c.uid)} aria-label={carDef(c.model).name}>
            <Thumb car={c} size="sm" />
          </button>
        ))}
      </div>
      <div className="leader-acts">
        <LikeButton owner={d.ownerId} />
        <button className="buy small" onClick={go}>Visit</button>
      </div>
    </div>
  )
}

export function MeetPanel() {
  const [rows, setRows] = useState<Display[] | null>(null)
  useEffect(() => {
    fetchMeet().then(setRows).catch(() => setRows([]))
  }, [])
  return (
    <>
      <Panel title={SOCIAL_TITLE} wide>
        <SocialTabs current="meet" />
        <MyDisplay />
        <div className="meet-list">
          {!rows && <LoadingBand label="Loading the car meet" />}
          {rows?.map((d) => <DisplayRow key={d.ownerId} d={d} />)}
        </div>
      </Panel>
      <PlayerCardPopup />
    </>
  )
}
