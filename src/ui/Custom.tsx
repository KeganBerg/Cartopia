import { useState } from 'react'
import { useGame, type OwnedCar, gateLevel } from '../game/store'
import { earnHint, paintOpen, rivalForPaint } from '../game/paintRivals'
import { openPaintRival } from './PaintRivals'
import { openTunerTrial } from './TunerTrials'
import { tunerTrial } from '../game/tuner'
import { PAINTS, PANELS, PATTERNS, carDef, isBike, panelJobCost, tidyPanels, type PanelId, type Panels, type PatternDef } from '../game/data'
import { MASTERY_TIERS, masteryTier } from '../game/mastery'
import { roadOpen } from '../game/trophyRoad'
import { CustomColour } from './ColourPicker'

const same = (a?: Panels | null, b?: Panels | null) => JSON.stringify(tidyPanels(a) ?? {}) === JSON.stringify(tidyPanels(b) ?? {})

// A shade of a colour: towards black (t < 0) or white (t > 0).
function shade(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t)
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`
}

// Side view of a car with one part filled in, for the part picker.
function PartIcon({ part, color, body }: { part: PanelId; color: string; body: string }) {
  const fill = (p: PanelId) => (p === part || part === 'body' ? color : '#cfd8dc')
  return (
    <svg viewBox="0 0 64 30" className="part-icon" aria-hidden>
      <path d="M4 20 Q4 14 10 13 L22 12 L28 5 Q30 4 33 4 L44 4 Q47 4 49 7 L53 12 Q60 13 60 18 L60 21 Q60 22 59 22 L5 22 Q4 22 4 20 Z" fill={part === 'body' ? color : body} stroke="#546e7a" strokeWidth="1" />
      <path d="M53 12 Q60 13 60 18 L49 18 L47 12 Z" fill={fill('hood')} />
      <path d="M22 12 L28 5 Q30 4 33 4 L44 4 Q47 4 49 7 L53 12 Z" fill={part === 'roof' ? color : '#90a4ae'} />
      <path d="M27 11 L31 6 L38 6 L38 11 Z M40 11 L40 6 L45 6 Q46 6 47 8 L49 11 Z" fill="#b3e5fc" />
      <rect x="23" y="13" width="23" height="7" rx="1" fill={fill('doors')} stroke="#546e7a" strokeWidth=".6" />
      {[15, 50].map((x) => (
        <g key={x}>
          <circle cx={x} cy="22" r="6" fill="#263238" />
          <circle cx={x} cy="22" r="3.2" fill={part === 'rims' ? color : '#b0bec5'} />
        </g>
      ))}
    </svg>
  )
}

// A pattern drawn small in a colour, close to how the paint shader draws it.
function PatternSwatch({ id, color }: { id: string | null; color: string }) {
  const dk = shade(color, -0.45)
  const dd = shade(color, -0.74)
  const lt = shade(color, 0.4)
  const r = (i: number) => ((i * 9301 + 49297) % 233280) / 233280
  return (
    <svg viewBox="0 0 40 24" className="pattern-swatch" aria-hidden>
      <rect width="40" height="24" fill={id === 'carbon' ? '#1d1f22' : color} />
      {id === 'camo' && <>
        <path d="M-2 6 Q6 0 12 5 T24 3 Q30 8 24 12 T10 14 Q2 12 -2 6Z" fill={dk} />
        <path d="M18 14 Q26 10 32 15 T44 16 L44 26 L22 26 Q14 20 18 14Z" fill={dd} />
        <path d="M28 2 Q34 -1 38 4 Q36 8 31 7Z M4 18 Q8 15 12 19 Q9 23 4 21Z" fill={lt} />
      </>}
      {id === 'digicamo' && Array.from({ length: 60 }, (_, i) => {
        const v = r(i * 7 + 3)
        return v < 0.5 ? null : <rect key={i} x={(i % 10) * 4} y={Math.floor(i / 10) * 4} width="4" height="4" fill={v > 0.85 ? lt : v > 0.68 ? dd : dk} />
      })}
      {id === 'tiger' && [4, 13, 22, 31].map((x, i) => (
        <path key={x} d={`M${x} -1 Q${x + 5} 8 ${x + 1 + (i % 2) * 2} 13 Q${x + 4} 19 ${x + 2} 25 L${x + 5} 25 Q${x + 7} 16 ${x + 4} 12 Q${x + 8} 6 ${x + 4} -1Z`} fill={shade(color, -0.9)} />
      ))}
      {id === 'checker' && Array.from({ length: 15 }, (_, i) => <rect key={i} x={(i % 5) * 8 + (Math.floor(i / 5) % 2) * 4 - 4} y={Math.floor(i / 5) * 8} width="4" height="4" fill="#111" />)}
      {id === 'checker' && Array.from({ length: 15 }, (_, i) => <rect key={`b${i}`} x={(i % 5) * 8 + (Math.floor(i / 5) % 2) * 4} y={Math.floor(i / 5) * 8 + 4} width="4" height="4" fill="#111" />)}
      {id === 'carbon' && Array.from({ length: 40 }, (_, i) => {
        const x = (i % 8) * 5
        const y = Math.floor(i / 8) * 5
        const along = (i % 8 + Math.floor(i / 8)) % 2 === 0
        return <rect key={i} x={x + (along ? 0 : 1.5)} y={y + (along ? 1.5 : 0)} width={along ? 5 : 2} height={along ? 2 : 5} fill={shade(color, -0.6)} opacity=".8" />
      })}
      {id === 'hex' && Array.from({ length: 24 }, (_, i) => {
        const x = (i % 6) * 7 + (Math.floor(i / 6) % 2) * 3.5
        const y = Math.floor(i / 6) * 6 + 1
        return <path key={i} d={`M${x} ${y + 2} l3 -2 l3 2 v3 l-3 2 l-3 -2Z`} fill="none" stroke={dd} strokeWidth="1" />
      })}
      {id === 'splatter' && [[6, 6, 4], [20, 15, 5], [33, 5, 3], [12, 19, 2.5], [29, 20, 2], [26, 9, 1.5], [3, 14, 1.5]].map(([x, y, rr], i) => (
        <circle key={i} cx={x} cy={y} r={rr} fill={i % 2 ? lt : dd} />
      ))}
      {id === 'flames' && <>
        <path d="M-1 4 Q14 2 22 7 Q16 7 26 11 Q18 11 30 15 Q16 15 22 19 Q10 20 -1 20Z" fill="#ffb300" />
        <path d="M-1 8 Q10 7 15 10 Q11 11 18 14 Q8 14 12 17 Q4 17 -1 16Z" fill="#e53935" />
      </>}
      {id === 'signature' && <>
        <path d="M-1 16 L14 4 L26 4 L11 16Z M20 24 L35 12 L41 12 L41 16 L30 24Z" fill={dd} />
        <path d="M14 4 L26 4 M11 16 L-1 16 M35 12 L41 12" stroke="#ffc83d" strokeWidth="1" />
      </>}
      {id === 'pinstripe' && [3, 8, 13, 18, 23].map((y) => <rect key={y} x="0" y={y} width="40" height="0.8" fill={lt} />)}
      {id === 'polka' && Array.from({ length: 18 }, (_, i) => <circle key={i} cx={(i % 6) * 7 + 3.5} cy={Math.floor(i / 6) * 8 + 4} r="2" fill={lt} />)}
    </svg>
  )
}

// Custom paint for one car, part by part: pick a part, then a pattern and a colour to try
// on the preview, then buy the lot.
export function CustomShop({ car, panels, setPanels }: { car: OwnedCar; panels: Panels | undefined; setPanels: (p: Panels | null) => void }) {
  const gate = useGame(gateLevel)
  const paintPanels = useGame((s) => s.paintPanels)
  const rivalRow = useGame((s) => s.rivalRow)
  const oldPaints = useGame((s) => s.oldPaints)
  const bike = isBike(carDef(car.model).body)
  const parts = PANELS.filter((p) => !bike || !p.car)
  const [part, setPart] = useState<PanelId>('hood')
  const info = parts.find((p) => p.id === part) ?? parts[0]
  const now = tidyPanels(car.panels)
  const changed = !same(panels, now)
  const cost = panelJobCost(now, tidyPanels(panels))
  const mine = panels?.[info.id]
  const colour = (id: PanelId) => panels?.[id]?.color ?? car.color
  const pick = (p: { color?: string | null; pattern?: string | null }) => {
    const one = { ...mine }
    if (p.color !== undefined) one.color = p.color ?? undefined
    if (p.pattern !== undefined) one.pattern = p.pattern ?? undefined
    const next = tidyPanels({ ...panels, [info.id]: one })
    setPanels(same(next, now) ? null : next ?? {})
  }
  // A locked colour can be tried on; the bar then points at the rival who has it.
  const roadItems = useGame((s) => s.roadItems)
  const mastery = useGame((s) => s.mastery)
  const worldTour = useGame((s) => s.worldTour)
  const skins = useGame((s) => s.skins)
  const tier = useGame((s) => masteryTier(s.mastery, car.model))
  const open = (id: PanelId, c: string) => c === now?.[id]?.color || paintOpen({ rivalRow, oldPaints, roadItems, mastery, worldTour, skins }, c)
  // A mastery pattern needs that step in this car; a Trophy Road one, won at a mystery stop.
  const earned = (id: PanelId, pt: PatternDef) => now?.[id]?.pattern === pt.id
    || (pt.mastery ? tier >= pt.mastery : pt.road ? roadOpen(roadItems, pt.id) : true)
  // A pattern won in a Tuner Trial (game/tuner.ts) stays shut until that trial is won.
  const tuner = useGame((s) => s.tuner)
  const shut = (id: PanelId, pattern: string) => {
    const t = tunerTrial(PATTERNS.find((x) => x.id === pattern)?.trial ?? '')
    return t && !((tuner?.[t.id] ?? 0) > 0) && now?.[id]?.pattern !== pattern ? t : undefined
  }
  const trialFor = PANELS.map((p) => panels?.[p.id]?.pattern ? shut(p.id, panels[p.id]!.pattern!) : undefined).find(Boolean)
  const lockedBy = PANELS.map((p) => panels?.[p.id]?.color && !open(p.id, panels[p.id]!.color!) ? rivalForPaint(panels[p.id]!.color!) : undefined).find(Boolean)
  const price = [cost.coins && `$${cost.coins.toLocaleString()}`, cost.bucks && `💎 ${cost.bucks}`].filter(Boolean).join(' + ') || 'Free'
  return (
    <div className="custom-shop">
      {changed && (
        <div className="try-bar on">
          <span className="try-what">Trying <b>custom paint</b></span>
          <button className="try-cancel" onClick={() => setPanels(null)}>Undo</button>
          {trialFor ? (
            <button className="buy small paint-rival-go" onClick={() => openTunerTrial(trialFor.id)} title={`Win ${trialFor.name} to unlock`}>🏁 {trialFor.icon} {trialFor.name}</button>
          ) : lockedBy ? (
            <button className="buy small paint-rival-go" onClick={() => openPaintRival(lockedBy.id)} title={`Beat ${lockedBy.name} to unlock`}>🏁 {lockedBy.icon} {lockedBy.name.split(' ')[0]}</button>
          ) : (
            <button className={cost.bucks ? 'buy small premium' : 'buy small'} onClick={() => { if (paintPanels(car.uid, panels ?? {})) setPanels(null) }}>Buy · {price}</button>
          )}
        </div>
      )}
      <div className="mod-tabs" role="tablist">
        {parts.map((p) => (
          <button key={p.id} role="tab" aria-selected={p.id === info.id} className={p.id === info.id ? 'mod-tab sel' : 'mod-tab'} onClick={() => setPart(p.id)}>
            <PartIcon part={p.id} color={colour(p.id)} body={car.color} />
            <span>{p.name}</span>
            {panels?.[p.id] && <i className="mod-dot" />}
          </button>
        ))}
      </div>
      {info.pattern && <>
        <h4>Pattern</h4>
        <div className="patterns">
          {[null, ...PATTERNS].map((pt) => {
            const id = pt?.id ?? null
            const on = (mine?.pattern ?? null) === id
            const had = now?.[info.id]?.pattern === id
            const earn = pt && !earned(info.id, pt) ? (pt.mastery ? `🔒 ${MASTERY_TIERS[pt.mastery - 1].icon}` : '🔒 🛣️') : null
            const locked = (!!pt && gate < pt.unlockLevel && !had) || !!earn
            const trial = pt ? shut(info.id, pt.id) : undefined
            return (
              <button key={id ?? 'solid'} className={`pat-opt${on ? ' sel' : ''}${locked ? ' locked' : ''}`} disabled={locked} onClick={() => pick({ pattern: id })} title={pt?.name ?? 'Solid'}>
                <PatternSwatch id={id} color={colour(info.id)} />
                <b>{pt?.name ?? 'Solid'}</b>
                <small>{earn ?? (locked ? `🔒 Lv ${pt!.unlockLevel}` : trial ? `🏁 ${trial.icon}` : !pt || !pt.coins ? 'Free' : had ? '✔' : `$${pt.coins.toLocaleString()}`)}</small>
              </button>
            )
          })}
        </div>
      </>}
      {info.color && <>
        <h4>Colour</h4>
        <div className="paints">
          <button title="Match body" aria-label="Match body" className={!mine?.color ? 'dot big sel' : 'dot big'} style={{ background: info.id === 'rims' ? '#cfd8dc' : car.color }} onClick={() => pick({ color: null })}>∅</button>
          {PAINTS.map((p) => {
            const locked = !open(info.id, p.color)
            const r = locked ? rivalForPaint(p.color) : null
            return (
              <button
                key={p.color}
                title={`${p.name}${p.bucks ? ' (1 gem)' : r ? ` · beat ${r.name}` : locked && p.earn ? ` · ${earnHint(p.color)}` : ''}`}
                aria-label={locked ? `${p.name}, locked` : p.name}
                className={`dot big${mine?.color === p.color ? ' sel' : ''}${p.bucks ? ' premium' : ''}${locked ? ' locked' : ''}`}
                style={{ backgroundColor: p.color }}
                onClick={() => pick({ color: p.color })}
              >{locked && <span className="dot-lock" aria-hidden>🔒</span>}</button>
            )
          })}
          <CustomColour color={mine?.color ?? colour(info.id)} custom={!!mine?.color && !PAINTS.some((p) => p.color === mine.color)} onPick={(c) => pick({ color: c })} />
        </div>
      </>}
    </div>
  )
}
