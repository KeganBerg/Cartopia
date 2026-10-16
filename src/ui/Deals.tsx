import { Icon } from './Icon'
import { useGame, dealUsed, openDeals, today } from '../game/store'
import { DEAL_SLOTS, GEM_BUILD_COINS, buildingDef, carDef, dealOffer, dealsFor, modDef, msToNextDay, type DealDef } from '../game/data'
import { useNow } from '../scene/useNow'
import { BuildingThumb, CarThumb } from '../scene/BuildingPreview'
import { Panel, openGarageTab } from './Menus'
import { openModSlot } from './Mods'

const left = (ms: number) => {
  const m = Math.max(1, Math.ceil(ms / 60000))
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

const cost = (c: { coins: number; bucks: number }, parts = 0) =>
  [c.coins && `$${c.coins.toLocaleString()}`, c.bucks && `💎 ${c.bucks}`, parts && `${parts}⚙`].filter(Boolean).join(' + ') || 'Free'

// HUD button: a price tag with the number of deals still open today.
export function DealsButton() {
  const open = useGame(openDeals)
  return (
    <button className="goals-btn deals-btn" onClick={() => useGame.getState().openPanel('deals')} title="Daily deals" aria-label="Daily deals">
      <Icon name="tag" />{open > 0 && <span className="goal-badge deal-badge">{open}</span>}
    </button>
  )
}

function DealArt({ deal }: { deal: DealDef }) {
  const car = useGame((s) => s.cars[0])
  if (deal.kind === 'decor') return <BuildingThumb def={buildingDef(deal.item ?? '')} />
  if (deal.kind === 'mod' || deal.kind === 'paint') {
    const body = car ? carDef(car.model).body : 'compact'
    return (
      <CarThumb
        size="sm" body={body} color={car?.color ?? '#e53935'}
        finish={deal.kind === 'paint' ? (deal.item as 'matte' | 'chrome') : car?.finish}
        mods={deal.kind === 'mod' ? [deal.item ?? ''] : car?.mods}
      />
    )
  }
  return <span className="deal-icon">{dealOffer(deal).icon}</span>
}

function DealCard({ deal, slot }: { deal: DealDef; slot: string }) {
  const s = useGame()
  const o = dealOffer(deal)
  const used = dealUsed(s, deal.id)
  const locked = s.level < o.unlockLevel
  const pct = Math.round((1 - (o.now.coins + o.now.bucks * GEM_BUILD_COINS) / (o.was.coins + o.was.bucks * GEM_BUILD_COINS)) * 100)
  const go = () => {
    if (deal.kind === 'parts' || deal.kind === 'fuel') return s.buyDeal(deal.id)
    if (deal.kind === 'decor') {
      if (s.coins < o.now.coins) return s.showNeed('coins', o.now.coins - s.coins, o.name)
      if (s.bucks < o.now.bucks) return s.showNeed('bucks', o.now.bucks - s.bucks, o.name)
      return s.setMode('place', deal.item ?? null)
    }
    if (!s.cars.length) return s.toast('Get a car first')
    const slot = deal.kind === 'mod' ? modDef(deal.item ?? '')?.slot : undefined
    if (slot) openModSlot(slot)
    openGarageTab(deal.kind === 'mod' ? 'mods' : 'paint')
    s.toast(deal.kind === 'mod' ? `Pick a car, then the ${o.name} is on sale in Mods` : `Pick a car, then ${o.name} is on sale in Paint`)
  }
  const label = deal.kind === 'parts' || deal.kind === 'fuel' ? 'Buy' : deal.kind === 'decor' ? 'Place' : 'Use'
  return (
    <div className={`deal${used ? ' used' : ''}${locked ? ' locked' : ''}`}>
      <span className="deal-slot">{slot}</span>
      {!used && <span className="deal-off">-{pct}%</span>}
      <div className="deal-art"><DealArt deal={deal} /></div>
      <b className="deal-name">{o.name}</b>
      <div className="deal-cost"><s>{cost(o.was, o.parts)}</s> <b>{cost(o.now, o.parts)}</b></div>
      {used ? (
        <button className="buy small owned" disabled>✔ Got it</button>
      ) : locked ? (
        <button className="price locked-btn" onClick={() => s.showNeed('level', o.unlockLevel, o.name)}>🔒 Level {o.unlockLevel}</button>
      ) : (
        <button className={o.now.bucks ? 'buy small premium' : 'buy small'} onClick={go}>{label}</button>
      )}
    </div>
  )
}

// Three discounted items a day, the same for every player. Each can be used once.
export function DealsPanel() {
  const now = useNow(30000)
  const day = today()
  return (
    <Panel title="🏷️ Daily Deals">
      <div className="deals">
        {dealsFor(day).map((d, i) => <DealCard key={d.id} deal={d} slot={DEAL_SLOTS[i].name} />)}
      </div>
      <p className="deals-foot">⏱ New deals in {left(msToNextDay(now))}</p>
    </Panel>
  )
}
