import { useGame, type OwnedCar } from '../game/store'
import { CAR_SETS, SKINS, SKIN_TIERS, ownedSkins, skinDef, type SkinDef } from '../game/data'

// Where a locked skin comes from, as a short tag.
export function skinSource(d: SkinDef) {
  const u = d.unlock
  if ('level' in u) return `🔒 Lv ${u.level}`
  if ('set' in u) return `📘 ${CAR_SETS.find((s) => s.id === u.set)?.name ?? 'Set'}`
  if ('season' in u) return `🏁 Tier ${u.season}`
  if ('bucks' in u) return `💎 ${u.bucks}`
  return '🎁 Crates'
}

// Skins row in the Garage's Paint tab. Tapping one tries it on in the preview; owned
// skins go on free, gem skins are bought from the try-on bar.
export function SkinPicker({ car, trying, setTrying }: { car: OwnedCar; trying: string | null | undefined; setTrying: (id: string | null | undefined) => void }) {
  const level = useGame((s) => s.level)
  const claimedSets = useGame((s) => s.claimedSets)
  const skins = useGame((s) => s.skins)
  const skinCar = useGame((s) => s.skinCar)
  const owned = ownedSkins({ level, claimedSets, skins })
  const now = car.skin ?? null
  const pick = trying === undefined ? now : trying
  const d = skinDef(trying)
  const changed = trying !== undefined && trying !== now
  const free = !d || owned.includes(d.id)
  const forSale = d && 'bucks' in d.unlock ? d.unlock.bucks : 0
  const go = () => { if (skinCar(car.uid, trying ?? null)) setTrying(undefined) }
  return (
    <div className="skin-pick">
      <h4>Skins <small>{owned.length}/{SKINS.length} unlocked · free on any car</small></h4>
      <div className="skin-row">
        <button className={`skin-opt${pick === null ? ' sel' : ''}`} onClick={() => setTrying(now === null ? undefined : null)}>
          <i className="skin-chip none">∅</i>
          <b>None</b>
          <small>{now === null ? 'On' : 'Plain'}</small>
        </button>
        {SKINS.map((s) => {
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
              <b>{s.name}</b>
              <small>{now === s.id ? 'On' : has ? SKIN_TIERS[s.tier].name : skinSource(s)}</small>
            </button>
          )
        })}
      </div>
      {changed && (
        <div className="try-bar on skin-try">
          <span className="try-what">
            {d ? <><b>{d.name}</b> <span className="skin-tier" style={{ color: SKIN_TIERS[d.tier].color }}>{SKIN_TIERS[d.tier].name}</span><span className="skin-blurb"> · {d.blurb}</span></> : <>Back to plain paint</>}
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
