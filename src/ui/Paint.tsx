import { useGame, liveDeal, paintPrice, type OwnedCar } from '../game/store'
import { FINISHES, PAINTS, STRIPES, dealOffer, finishDef, paintJobCost, type Finish, type PaintJob } from '../game/data'
import { CLASS_TIERS, carClassTier } from '../game/mastery'
import { PAINTS_TO_COLLECT, earnHint, paintOpen, paintsOpen, rivalForPaint } from '../game/paintRivals'
import { openPaintRival } from './PaintRivals'

export const jobOf = (car: OwnedCar): PaintJob => ({ color: car.color, finish: car.finish ?? 'gloss', stripe: car.stripe ?? null })

const same = (a: PaintJob, b: PaintJob) => a.color === b.color && a.finish === b.finish && a.stripe === b.stripe

// What a swatch looks like in each finish: a highlight for gloss, flat for matte, a metal sweep for chrome.
const SHEEN = {
  gloss: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,.75) 0 14%, transparent 34%)',
  matte: 'none',
  chrome: 'linear-gradient(135deg, rgba(255,255,255,.85) 0 18%, rgba(0,0,0,.25) 38%, rgba(255,255,255,.6) 55%, rgba(0,0,0,.3) 78%, rgba(255,255,255,.7))',
  gold: 'linear-gradient(135deg, rgba(255,240,170,.8) 0 18%, rgba(170,120,10,.55) 45%, rgba(255,240,170,.55) 70%, rgba(170,120,10,.5))',
  diamond: 'linear-gradient(135deg, rgba(255,255,255,.9) 0 15%, rgba(150,220,255,.5) 35%, rgba(255,255,255,.75) 50%, rgba(120,190,255,.5) 70%, rgba(255,255,255,.85))',
  galaxy: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,.9) 0 3%, transparent 4%), radial-gradient(circle at 70% 60%, rgba(255,255,255,.8) 0 2%, transparent 3%), linear-gradient(135deg, rgba(60,20,140,.7), rgba(200,60,200,.45) 50%, rgba(20,30,110,.7))',
} as const satisfies Record<Finish, string>

// Paint shop for one car: tap a colour, finish or stripe to try it on the preview, then buy the lot.
export function PaintShop({ car, job, setJob }: { car: OwnedCar; job: PaintJob; setJob: (j: PaintJob | null) => void }) {
  const level = useGame((s) => s.level)
  const paintCar = useGame((s) => s.paintCar)
  const deals = useGame((s) => s.deals)
  const rivalRow = useGame((s) => s.rivalRow)
  const oldPaints = useGame((s) => s.oldPaints)
  const roadItems = useGame((s) => s.roadItems)
  const mastery = useGame((s) => s.mastery)
  const worldTour = useGame((s) => s.worldTour)
  const tier = carClassTier(mastery, car.model)
  const now = jobOf(car)
  const open = (color: string) => color === now.color || paintOpen({ rivalRow, oldPaints, roadItems, mastery, worldTour }, color)
  // A locked colour can be tried on; the bar then points at the rival who has it.
  const lockedBy = open(job.color) ? null : rivalForPaint(job.color)
  const changed = !same(job, now)
  const freePaint = useGame((s) => s.freePaint)
  const cost = paintPrice({ deals, level, freePaint }, car, job)
  const full = paintJobCost(car, job)
  const pick = (p: Partial<PaintJob>) => {
    const next = { ...job, ...p }
    setJob(same(next, now) ? null : next)
  }
  const label = [
    job.finish !== now.finish && finishDef(job.finish).name,
    job.color !== now.color && (PAINTS.find((p) => p.color === job.color)?.name ?? 'New colour'),
    job.stripe !== now.stripe && (job.stripe ? 'stripes' : 'no stripes'),
  ].filter(Boolean).join(' · ')
  const price = [cost.coins && `$${cost.coins.toLocaleString()}`, cost.bucks && `💎 ${cost.bucks}`].filter(Boolean).join(' + ') || 'Free'
  return (
    <div className="paint-shop">
      {changed && (
        <div className="try-bar on">
          <span className="try-what">Trying <b>{label}</b></span>
          <button className="try-cancel" onClick={() => setJob(null)}>Undo</button>
          {lockedBy ? (
            <button className="buy small paint-rival-go" onClick={() => openPaintRival(lockedBy.id)} title={`Beat ${lockedBy.name} to unlock`}>🏁 {lockedBy.icon} {lockedBy.name.split(' ')[0]}</button>
          ) : (
            <button className={cost.bucks ? 'buy small premium' : 'buy small'} onClick={() => { if (paintCar(car.uid, job)) setJob(null) }}>{cost.deal && <span className="deal-tag">DEAL</span>}{cost.free && '🎁 '}Buy · {cost.deal && <s>${full.coins.toLocaleString()}</s>} {price}</button>
          )}
        </div>
      )}
      <h4>Finish</h4>
      <div className="finishes">
        {FINISHES.map((f) => {
          const earn = f.mastery ? CLASS_TIERS[f.mastery - 1] : undefined
          const shut = !!earn && tier < f.mastery! && now.finish !== f.id
          const locked = (level < f.unlockLevel && now.finish !== f.id) || shut
          return (
            <button
              key={f.id}
              className={`fin-opt${job.finish === f.id ? ' sel' : ''}${locked ? ' locked' : ''}`}
              disabled={locked}
              onClick={() => pick({ finish: f.id })}
            >
              <i className="finish-chip" style={{ backgroundColor: job.color, backgroundImage: SHEEN[f.id] }} />
              <b>{f.name}</b>
              <small title={earn ? f.blurb : undefined}>{shut ? `🔒 ${earn!.icon}` : locked ? `🔒 Level ${f.unlockLevel}` : now.finish === f.id ? 'Yours' : earn ? `${earn.icon} Free` : <FinishPrice id={f.id} coins={f.coins} level={level} deals={deals} />}</small>
            </button>
          )
        })}
      </div>
      <h4>Colour <small title="Beat paint rivals in the Race menu to win more colours">🎨 {paintsOpen({ rivalRow, oldPaints })}/{PAINTS_TO_COLLECT}</small></h4>
      <div className="paints">
        {PAINTS.map((p) => {
          const locked = !open(p.color)
          const r = locked ? rivalForPaint(p.color) : null
          return (
            <button
              key={p.color}
              title={`${p.name}${p.bucks ? ' (1 gem)' : r ? ` · beat ${r.name}` : locked && p.earn ? ` · ${earnHint(p.color)}` : ''}`}
              aria-label={locked ? `${p.name}, locked` : p.name}
              className={`dot big${p.color === job.color ? ' sel' : ''}${p.bucks ? ' premium' : ''}${locked ? ' locked' : ''}`}
              style={{ backgroundColor: p.color, backgroundImage: SHEEN[job.finish] }}
              onClick={() => pick({ color: p.color })}
            >{locked && <span className="dot-lock" aria-hidden>🔒</span>}</button>
          )
        })}
      </div>
      <h4>Racing stripes <small>$100</small></h4>
      <div className="paints">
        {STRIPES.map((st) => (
          <button
            key={st ?? 'none'}
            title={st ? 'Stripe' : 'No stripe'}
            aria-label={st ? 'Stripe' : 'No stripe'}
            className={job.stripe === st ? 'dot big sel' : 'dot big'}
            style={{ background: st ? `linear-gradient(90deg, ${job.color} 0 35%, ${st} 35% 45%, ${job.color} 45% 55%, ${st} 55% 65%, ${job.color} 65%)` : job.color }}
            onClick={() => pick({ stripe: st })}
          >{st ? '' : '∅'}</button>
        ))}
      </div>
    </div>
  )
}

// A finish's price, crossed out with today's deal price when it's on sale.
function FinishPrice({ id, coins, level, deals }: { id: PaintJob['finish']; coins: number; level: number; deals: Parameters<typeof liveDeal>[0]['deals'] }) {
  const deal = liveDeal({ deals, level }, 'paint', id)
  if (!deal) return <>${coins.toLocaleString()}</>
  return <><s>${coins.toLocaleString()}</s> <b className="deal-price">${dealOffer(deal).now.coins.toLocaleString()}</b></>
}
