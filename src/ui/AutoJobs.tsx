import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGame } from '../game/store'
import { applyAutoJobs, autoJobs, autoJobsChange, roundPay } from '../game/autoJobs'
import { buildingDef, buildingLevel, carDef } from '../game/data'
import { BuildingThumb, CarThumb } from '../scene/BuildingPreview'
import { CoinIcon } from './Icon'
import { sfx } from '../lib/sound'
import './flash.css'
import './confirm.css'

// The Cars menu's Auto jobs button: shows the best car for every business
// (biggest job first), then puts them all to work in one tap.
export function AutoJobsButton() {
  const [open, setOpen] = useState(false)
  const has = useGame((s) => s.cars.length > 0 && s.buildings.some((b) => buildingDef(b.def).jobSeconds && buildingDef(b.def).kind !== 'obstacle'))
  if (!has) return null
  return (
    <>
      <button className="auto-jobs-btn" onClick={() => { sfx.click(); setOpen(true) }} title="Auto jobs: best car on every business, ❤️ loves first" aria-label="Auto jobs">
        <span aria-hidden>🧑‍✈️</span>Auto
      </button>
      {open && <AutoJobsSheet onClose={() => setOpen(false)} />}
    </>
  )
}

function AutoJobsSheet({ onClose }: { onClose: () => void }) {
  const buildings = useGame((s) => s.buildings)
  const cars = useGame((s) => s.cars)
  const assign = useGame((s) => s.autoAssign)
  const plan = useMemo(() => autoJobs(buildings, cars), [buildings, cars])
  const changes = autoJobsChange(plan)
  const now = useMemo(() => roundPay(buildings, cars), [buildings, cars])
  const after = useMemo(() => roundPay(applyAutoJobs(buildings, plan), cars), [buildings, plan, cars])
  const hearts = plan.filter((p) => p.loves).length
  // A real modal like Confirm: the game underneath can't be tapped.
  useEffect(() => {
    const root = document.getElementById('root')
    if (root) root.inert = true
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', key)
    return () => {
      if (root) root.inert = false
      removeEventListener('keydown', key)
    }
  }, [onClose])
  const go = () => {
    assign()
    onClose()
  }
  return createPortal(
    <div className="flash-warn cf-modal aj-modal" role="dialog" aria-modal="true" aria-labelledby="aj-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fw-card cf-card aj-card">
        <div className="fw-head"><span className="fw-bolt" aria-hidden>🧑‍✈️</span><h2 id="aj-title">Auto jobs</h2></div>
        <div className="aj-sum">
          <span className="aj-chip" title="Cars at a business they love: +25% coins">❤️ {hearts}</span>
          <span className="aj-chip" title="Coins one job at every business pays">
            <CoinIcon size={18} />{now.toLocaleString()}{after > now && <> → <b>{after.toLocaleString()}</b></>}
          </span>
        </div>
        <ol className="aj-list">
          {plan.map((p) => {
            const b = buildings.find((o) => o.uid === p.building)!
            const c = cars.find((o) => o.uid === p.car)!
            const d = buildingDef(b.def)
            const cd = carDef(c.model)
            const moved = p.car !== p.was
            return (
              <li key={p.building} className={moved ? 'aj-row new' : 'aj-row'}>
                <span className="aj-bldg" title={d.name}><BuildingThumb def={d} level={buildingLevel(b)} /></span>
                <span className="aj-car" title={cd.name}><CarThumb size="sm" color={c.color} finish={c.finish} skin={c.skin} modSkin={c.modSkin} panels={c.panels} trim={c.trim} hat={c.hat} body={cd.body} model={cd.id} stripe={c.stripe} mods={c.mods} /></span>
                <b className={p.loves ? 'aj-bonus love' : 'aj-bonus'}>{p.loves ? '❤️ +25%' : '+10%'}</b>
                <span className="aj-pay"><CoinIcon size={16} />{p.pay.toLocaleString()}</span>
                {moved && <i className="aj-new" title="New driver here" aria-label="New driver">●</i>}
              </li>
            )
          })}
        </ol>
        <div className="cf-actions">
          <button className="cf-no" onClick={onClose}>{changes ? 'Cancel' : 'OK'}</button>
          {changes ? <button className="cf-yes aj-go" onClick={go} autoFocus>Assign all</button> : <span className="aj-done" title="Every business already has its best car">✔ Best</span>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
