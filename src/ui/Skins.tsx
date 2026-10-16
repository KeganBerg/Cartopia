import { useGame, type OwnedCar } from '../game/store'
import { CAR_SETS, MOD_SKINS, SKINS, SKIN_TIERS, TRACK_SKINS, ownedModSkins, ownedSkins, ownedTrackSkins, type SkinDef, type SkinnedSlot } from '../game/data'

// Where a locked skin comes from, as a short tag.
export function skinSource(d: SkinDef) {
  const u = d.unlock
  if ('level' in u) return `🔒 Lv ${u.level}`
  if ('set' in u) return `📘 ${CAR_SETS.find((s) => s.id === u.set)?.name ?? 'Set'}`
  if ('season' in u) return `🏁 Tier ${u.season}`
  if ('bucks' in u) return `💎 ${u.bucks}`
  if ('event' in u) return '📅 Event'
  return '🎁 Crates'
}

type Trying = string | null | undefined

// A wrapping grid of skin chips with a try-on bar: tapping one tries it on in the preview
// (undefined: not trying; null: trying none). Owned skins go on free, gem skins are
// bought from the bar. Shared by body skins and mod skins.
function SkinChooser({ title, defs, owned, now, trying, setTrying, apply }: {
  title: React.ReactNode; defs: SkinDef[]; owned: string[]; now: string | null
  trying: Trying; setTrying: (id: Trying) => void; apply: (id: string | null) => boolean
}) {
  const pick = trying === undefined ? now : trying
  const d = defs.find((x) => x.id === trying)
  const changed = trying !== undefined && trying !== now
  const free = !d || owned.includes(d.id)
  const forSale = d && 'bucks' in d.unlock ? d.unlock.bucks : 0
  const go = () => { if (apply(trying ?? null)) setTrying(undefined) }
  return (
    <div className="skin-pick">
      <h4>{title}</h4>
      <div className="skin-row">
        <button className={`skin-opt${pick === null ? ' sel' : ''}`} onClick={() => setTrying(now === null ? undefined : null)}>
          <i className="skin-chip none">∅</i>
          <b>None</b>
        </button>
        {defs.map((s) => {
          const has = owned.includes(s.id)
          return (
            <button
              key={s.id}
              className={`skin-opt${pick === s.id ? ' sel' : ''}${has ? '' : ' locked'}`}
              style={{ '--tier': SKIN_TIERS[s.tier].color } as React.CSSProperties}
              title={s.blurb}
              onClick={() => setTrying(s.id === now ? undefined : s.id)}
            >
              <i className="skin-chip" style={{ background: s.swatch }} />
              {!has && <span className="skin-lock">🔒</span>}
              <b>{s.name}</b>
            </button>
          )
        })}
      </div>
      {changed && (
        <div className="try-bar on skin-try">
          <span className="try-what">
            {d ? <><b>{d.name}</b> <span className="skin-tier" style={{ color: SKIN_TIERS[d.tier].color }}>{SKIN_TIERS[d.tier].name}</span></> : <>Back to plain</>}
          </span>
          <button className="try-cancel" onClick={() => setTrying(undefined)}>Undo</button>
          {free ? (
            <button className="buy small" onClick={go}>{d ? 'Put on' : 'Take off'}</button>
          ) : forSale ? (
            <button className="buy small premium" onClick={go}>Buy · 💎 {forSale}</button>
          ) : (
            <span className="skin-how">{skinSource(d!)}</span>
          )}
        </div>
      )}
    </div>
  )
}

// Body skins, in the Garage's Paint tab.
export function SkinPicker({ car, trying, setTrying }: { car: OwnedCar; trying: Trying; setTrying: (id: Trying) => void }) {
  const level = useGame((s) => s.level)
  const claimedSets = useGame((s) => s.claimedSets)
  const skins = useGame((s) => s.skins)
  const skinCar = useGame((s) => s.skinCar)
  const owned = ownedSkins({ level, claimedSets, skins })
  return (
    <SkinChooser title={<>Skins <small>{owned.length}/{SKINS.length}</small></>} defs={SKINS} owned={owned}
      now={car.skin ?? null} trying={trying} setTrying={setTrying} apply={(id) => skinCar(car.uid, id)} />
  )
}

// Mod skins for the part fitted in one slot, in the Garage's Mods tab.
export function ModSkinPicker({ car, slot, trying, setTrying }: { car: OwnedCar; slot: SkinnedSlot; trying: Trying; setTrying: (id: Trying) => void }) {
  const level = useGame((s) => s.level)
  const claimedSets = useGame((s) => s.claimedSets)
  const modSkins = useGame((s) => s.modSkins)
  const skinMod = useGame((s) => s.skinMod)
  const owned = ownedModSkins({ level, claimedSets, modSkins })
  return (
    <SkinChooser title={<>Mod skin <small>{owned.length}/{MOD_SKINS.length}</small></>} defs={MOD_SKINS} owned={owned}
      now={car.modSkin?.[slot] ?? null} trying={trying} setTrying={setTrying} apply={(id) => skinMod(car.uid, slot, id)} />
  )
}

// Track skins for a tracked car (the Tomahawk): free by level, kept in the car's modSkin.tracks.
export function TrackSkinPicker({ car, trying, setTrying }: { car: OwnedCar; trying: Trying; setTrying: (id: Trying) => void }) {
  const level = useGame((s) => s.level)
  const skinTracks = useGame((s) => s.skinTracks)
  const owned = ownedTrackSkins(level)
  return (
    <SkinChooser title={<>Track skin <small>{owned.length}/{TRACK_SKINS.length}</small></>} defs={TRACK_SKINS} owned={owned}
      now={car.modSkin?.tracks ?? null} trying={trying} setTrying={setTrying} apply={(id) => skinTracks(car.uid, id)} />
  )
}
