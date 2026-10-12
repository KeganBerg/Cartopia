import { useState } from 'react'
import { useGame, type OwnedCar } from '../game/store'
import { PAINTS, PANELS, PATTERNS, carDef, isBike, panelJobCost, tidyPanels, type PanelId, type Panels } from '../game/data'

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
    </svg>
  )
}

// Custom paint for one car, part by part: pick a part, then a pattern and a colour to try
// on the preview, then buy the lot.
export function CustomShop({ car, panels, setPanels }: { car: OwnedCar; panels: Panels | undefined; setPanels: (p: Panels | null) => void }) {
  const level = useGame((s) => s.level)
  const paintPanels = useGame((s) => s.paintPanels)
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
  const price = [cost.coins && `$${cost.coins.toLocaleString()}`, cost.bucks && `💎 ${cost.bucks}`].filter(Boolean).join(' + ') || 'Free'
  return (
    <div className="custom-shop">
      {changed && (
        <div className="try-bar on">
          <span className="try-what">Trying <b>custom paint</b></span>
          <button className="try-cancel" onClick={() => setPanels(null)}>Undo</button>
          <button className={cost.bucks ? 'buy small premium' : 'buy small'} onClick={() => { if (paintPanels(car.uid, panels ?? {})) setPanels(null) }}>Buy · {price}</button>
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
            const locked = !!pt && level < pt.unlockLevel && !had
            return (
              <button key={id ?? 'solid'} className={`pat-opt${on ? ' sel' : ''}${locked ? ' locked' : ''}`} disabled={locked} onClick={() => pick({ pattern: id })} title={pt?.name ?? 'Solid'}>
                <PatternSwatch id={id} color={colour(info.id)} />
                <b>{pt?.name ?? 'Solid'}</b>
                <small>{locked ? `🔒 Lv ${pt!.unlockLevel}` : !pt ? 'Free' : had ? '✔' : `$${pt.coins.toLocaleString()}`}</small>
              </button>
            )
          })}
        </div>
      </>}
      {info.color && <>
        <h4>Colour</h4>
        <div className="paints">
          <button title="Match body" aria-label="Match body" className={!mine?.color ? 'dot big sel' : 'dot big'} style={{ background: info.id === 'rims' ? '#cfd8dc' : car.color }} onClick={() => pick({ color: null })}>∅</button>
          {PAINTS.map((p) => (
            <button
              key={p.color}
              title={`${p.name}${p.bucks ? ' (1 gem)' : ''}`}
              aria-label={p.name}
              className={mine?.color === p.color ? 'dot big sel' : p.bucks ? 'dot big premium' : 'dot big'}
              style={{ backgroundColor: p.color }}
              onClick={() => pick({ color: p.color })}
            />
          ))}
        </div>
      </>}
    </div>
  )
}
