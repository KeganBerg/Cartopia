import { useGame, liveDeal, paintPrice, type OwnedCar } from '../game/store'
import { FINISHES, PAINTS, STRIPES, dealOffer, finishDef, paintJobCost, type PaintJob } from '../game/data'

export const jobOf = (car: OwnedCar): PaintJob => ({ color: car.color, finish: car.finish ?? 'gloss', stripe: car.stripe ?? null })

const same = (a: PaintJob, b: PaintJob) => a.color === b.color && a.finish === b.finish && a.stripe === b.stripe

// What a swatch looks like in each finish: a highlight for gloss, flat for matte, a metal sweep for chrome.
const SHEEN = {
  gloss: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,.75) 0 14%, transparent 34%)',
  matte: 'none',
  chrome: 'linear-gradient(135deg, rgba(255,255,255,.85) 0 18%, rgba(0,0,0,.25) 38%, rgba(255,255,255,.6) 55%, rgba(0,0,0,.3) 78%, rgba(255,255,255,.7))',
} as const

// Paint shop for one car: tap a colour, finish or stripe to try it on the preview, then buy the lot.
export function PaintShop({ car, job, setJob }: { car: OwnedCar; job: PaintJob; setJob: (j: PaintJob | null) => void }) {
  const level = useGame((s) => s.level)
  const paintCar = useGame((s) => s.paintCar)
  const deals = useGame((s) => s.deals)
  const now = jobOf(car)
  const changed = !same(job, now)
  const cost = paintPrice({ deals, level }, car, job)
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
          <button className={cost.bucks ? 'buy small premium' : 'buy small'} onClick={() => { if (paintCar(car.uid, job)) setJob(null) }}>{cost.deal && <span className="deal-tag">DEAL</span>}Buy · {cost.deal && <s>${full.coins.toLocaleString()}</s>} {price}</button>
        </div>
      )}
      <h4>Finish</h4>
      <div className="finishes">
        {FINISHES.map((f) => {
          const locked = level < f.unlockLevel && now.finish !== f.id
          return (
            <button
              key={f.id}
              className={`fin-opt${job.finish === f.id ? ' sel' : ''}${locked ? ' locked' : ''}`}
              disabled={locked}
              onClick={() => pick({ finish: f.id })}
            >
              <i className="finish-chip" style={{ backgroundColor: job.color, backgroundImage: SHEEN[f.id] }} />
              <b>{f.name}</b>
              <small>{locked ? `🔒 Level ${f.unlockLevel}` : now.finish === f.id ? 'Yours' : <FinishPrice id={f.id} coins={f.coins} level={level} deals={deals} />}</small>
            </button>
          )
        })}
      </div>
      <h4>Colour <small>$150 · neon and gold B1</small></h4>
      <div className="paints">
        {PAINTS.map((p) => (
          <button
            key={p.color}
            title={`${p.name}${p.bucks ? ' (1 gem)' : ''}`}
            aria-label={p.name}
            className={p.color === job.color ? 'dot big sel' : p.bucks ? 'dot big premium' : 'dot big'}
            style={{ backgroundColor: p.color, backgroundImage: SHEEN[job.finish] }}
            onClick={() => pick({ color: p.color })}
          />
        ))}
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
