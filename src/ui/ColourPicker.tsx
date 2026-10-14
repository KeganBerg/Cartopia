import { useEffect, useRef, useState } from 'react'
import { CUSTOM_PAINT, hasCustomPaint, isHexColor } from '../game/data'
import { useGame } from '../game/store'
import { hexToHsv, hsvToHex, type Hsv } from '../lib/hsv'
import './colour-picker.css'

// Drags a pointer over an element, calling `at` with where it is (0-1 across and down).
function useDrag(at: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null)
  const move = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    at(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)))
  }
  return {
    ref,
    onPointerDown: (e: React.PointerEvent) => { ref.current!.setPointerCapture(e.pointerId); move(e) },
    onPointerMove: (e: React.PointerEvent) => { if (ref.current!.hasPointerCapture(e.pointerId)) move(e) },
  }
}

// Custom Colour, at the end of a paint row: a rainbow dot that flies out a colour picker.
// Locked until won (a legendary Diamond Crate prize); then any colour goes. `color` is the one
// on try-on; `custom` says it's off the chart, so the dot shows it selected.
export function CustomColour({ color, custom, onPick }: { color: string; custom: boolean; onPick: (hex: string) => void }) {
  const owned = useGame((s) => hasCustomPaint(s))
  const [open, setOpen] = useState(owned && custom)
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(isHexColor(color) ? color : '#19ffb0'))
  // Follow a colour picked elsewhere (a chart dot), keeping the hue when it's a grey.
  useEffect(() => {
    if (!isHexColor(color) || hsvToHex(hsv) === color) return
    const next = hexToHsv(color)
    setHsv(next[1] ? next : [hsv[0], next[1], next[2]])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color])
  const frame = useRef(0)
  const set = (next: Hsv) => {
    setHsv(next)
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => onPick(hsvToHex(next)))
  }
  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  const sv = useDrag((x, y) => set([hsv[0], x, 1 - y]))
  const hue = useDrag((x) => set([x * 359.9, hsv[1] || 0.85, hsv[2] || 0.9]))
  return (
    <>
      <button
        className={`dot big cc-dot${owned && custom ? ' sel' : ''}${owned ? '' : ' locked'}${open ? ' open' : ''}`}
        style={{ background: owned && custom ? `radial-gradient(circle, ${color} 0 42%, transparent 46%), ${CUSTOM_PAINT.swatch}` : CUSTOM_PAINT.swatch }}
        title={owned ? CUSTOM_PAINT.name : `${CUSTOM_PAINT.name} · Legendary · Diamond Crate`}
        aria-label={owned ? CUSTOM_PAINT.name : `${CUSTOM_PAINT.name}, locked`}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open)
          if (!open && owned && !custom) onPick(hsvToHex(hsv))
        }}
      >{!owned && <span className="dot-lock" aria-hidden>🔒</span>}</button>
      {open && (owned ? (
        <div className="cc-fly" style={{ '--cc': color } as React.CSSProperties}>
          <div className="cc-sv" {...sv} style={{ backgroundColor: hsvToHex([hsv[0], 1, 1]) }}>
            <i style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%` }} />
          </div>
          <div className="cc-hue" {...hue}>
            <i style={{ left: `${(hsv[0] / 360) * 100}%` }} />
          </div>
          <div className="cc-now"><span style={{ background: color }} /><b>{color.toUpperCase()}</b></div>
        </div>
      ) : (
        <div className="cc-fly locked" title={CUSTOM_PAINT.blurb}>
          <span className="cc-big" style={{ background: CUSTOM_PAINT.swatch }}>🔒</span>
          <div className="cc-lock-text"><b>{CUSTOM_PAINT.name}</b><small>★ Legendary · 💎 Diamond</small></div>
          <button className="buy small premium" onClick={() => useGame.getState().openPanel('crates')}>📦 Crates</button>
        </div>
      ))}
    </>
  )
}
