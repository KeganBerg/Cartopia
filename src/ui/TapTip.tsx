import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { SKILLS, buildingDef, DRIVER_BONUS, FAVORITE_BONUS, type SkillId } from '../game/data'
import { buildingIcon } from './buildingIcons'
import './taptip.css'

// Tap-to-explain. Phones never show `title=` tooltips, so every badge, chip and icon
// that carries a title explains itself in a small bubble when tapped:
// - a plain badge (not a button): one tap shows its title;
// - a badge inside a button, or marked `data-tap-tip`: tapping it explains instead of pressing;
// - a button: press and hold shows its title, a normal tap still presses it.
// Badges that need more than a line (a car's skill, the businesses it loves) open a rich
// bubble through showTip().

type Tip = { x: number; top: number; bottom: number; body: ReactNode; key: number }
const useTapTip = create<{ tip: Tip | null }>(() => ({ tip: null }))
let seq = 0

export function showTip(anchor: Element, body: ReactNode) {
  const r = anchor.getBoundingClientRect()
  useTapTip.setState({ tip: { x: r.left + r.width / 2, top: r.top, bottom: r.bottom, body, key: ++seq } })
}
// Runs on every tap and scroll, so it only touches the store when a bubble is up.
export const hideTip = () => { if (useTapTip.getState().tip) useTapTip.setState({ tip: null }) }

// What each skill does in a drag race, as two chips: the effect and when it kicks in.
// Numbers match skillBoost/skillDrag in game/data.ts (checked in TapTip.test.ts).
export const SKILL_CHIPS: Record<SkillId, [string, string]> = {
  launch: ['+20% speed', '⚙️ Gear 1'],
  nitro: ['+15% power', '⚙️ Top 2 gears'],
  slipstream: ['+8% speed', '💨 When behind'],
  smooth: ['Good = Perfect', '⚙️ Every shift'],
  oil: ['Rival −10% grip', '⏱ First 4 s'],
  torque: ['+10% power', '⚙️ Gears 1–2'],
  freeze: ['Rival −10% speed', '⚙️ Their gear 2'],
}

export function SkillTip({ sk }: { sk: SkillId }) {
  const s = SKILLS[sk]
  const [fx, when] = SKILL_CHIPS[sk]
  return (
    <>
      <b className="tt-head"><span aria-hidden>{s.icon}</span> {s.name}</b>
      <span className="tt-chips"><i className="tt-fx">{fx}</i><i>{when}</i><i>🏁 Drag races</i></span>
    </>
  )
}

const pct = (n: number) => `+${Math.round(n * 100)}%`
export function LovesTip({ likes }: { likes: string[] }) {
  return (
    <>
      <b className="tt-head"><span aria-hidden>❤️</span> Favorite Job</b>
      <span className="tt-loves">
        {likes.map((id) => <span key={id}><i aria-hidden>{buildingIcon(id)}</i>{buildingDef(id).name}</span>)}
      </span>
      <span className="tt-chips"><i className="tt-fx">{pct(FAVORITE_BONUS)} 🪙 a job</i><i>Others {pct(DRIVER_BONUS)}</i><i className="tt-off">🏁 No race effect</i></span>
    </>
  )
}

// A car's race skill as a small icon (rival rows, race cards). Tapping it explains the
// skill instead of pressing the row around it.
export function SkillIcon({ sk, className = 'rival-skill', named }: { sk: SkillId; className?: string; named?: boolean }) {
  return <span className={className} data-tap-tip data-skill={sk} title={`${SKILLS[sk].name}: ${SKILLS[sk].text}`}>{SKILLS[sk].icon}{named && ` ${SKILLS[sk].name}`}</span>
}

const INTERACTIVE = 'button, a, input, select, textarea, label, summary, [role=button], [role=tab], [role=option], [role=radio], [role=switch], [role=checkbox]'
const HOLD_MS = 450

// The element whose title explains a tap at `target`, and whether that tap would
// otherwise press something.
function tipTarget(target: EventTarget | null): { el: HTMLElement; text: string; pressable: boolean } | null {
  if (!(target instanceof Element) || target.closest('.tap-tip')) return null
  const el = target.closest<HTMLElement>('[title], [data-skill]')
  if (!el) return null
  const text = el.getAttribute('title') ?? ''
  if (!text && !el.dataset.skill) return null
  const press = el.closest(INTERACTIVE)
  // A clickable div or span (React onClick) shows a pointer: treat it as a button too.
  const pressable = !!press || (!el.hasAttribute('data-tap-tip') && getComputedStyle(el).cursor === 'pointer')
  return { el, text, pressable: pressable && !el.hasAttribute('data-tap-tip') }
}

function bodyFor(el: HTMLElement, text: string): ReactNode {
  const sk = el.dataset.skill as SkillId | undefined
  if (sk && SKILLS[sk]) return <SkillTip sk={sk} />
  // "Name: what it does" reads as a bold name over one line.
  const m = /^([^:.]{2,32}): (.+)$/.exec(text)
  return m ? <><b className="tt-head">{m[1]}</b><span>{m[2]}</span></> : <span>{text}</span>
}

// Mounted once (App). Listens for taps and holds anywhere and draws the bubble.
export function TapTips() {
  const tip = useTapTip((s) => s.tip)
  useEffect(() => {
    let hold: ReturnType<typeof setTimeout> | null = null
    let start: { x: number; y: number } | null = null
    let swallow = false
    const cancel = () => { if (hold) clearTimeout(hold); hold = null }
    const down = (e: PointerEvent) => {
      cancel()
      swallow = false
      if (!(e.target instanceof Element) || !e.target.closest('.tap-tip')) hideTip()
      const t = tipTarget(e.target)
      if (!t || !t.pressable || !t.text) return
      start = { x: e.clientX, y: e.clientY }
      hold = setTimeout(() => { swallow = true; showTip(t.el, bodyFor(t.el, t.text)) }, HOLD_MS)
    }
    const move = (e: PointerEvent) => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel()
    }
    const click = (e: MouseEvent) => {
      // A hold already explained the button: don't press it on release.
      if (swallow) { swallow = false; e.stopPropagation(); e.preventDefault(); return }
      const t = tipTarget(e.target)
      if (!t || t.pressable) return
      if (t.el.closest(INTERACTIVE) || t.el.hasAttribute('data-tap-tip')) { e.stopPropagation(); e.preventDefault() }
      showTip(t.el, bodyFor(t.el, t.text))
    }
    // Long-pressing a button on a phone opens the system menu; the bubble replaces it.
    const menu = (e: Event) => { if (swallow || hold) e.preventDefault() }
    const close = () => { cancel(); hideTip() }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointermove', move, true)
    document.addEventListener('pointerup', cancel, true)
    document.addEventListener('pointercancel', cancel, true)
    document.addEventListener('click', click, true)
    document.addEventListener('contextmenu', menu, true)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      cancel()
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointermove', move, true)
      document.removeEventListener('pointerup', cancel, true)
      document.removeEventListener('pointercancel', cancel, true)
      document.removeEventListener('click', click, true)
      document.removeEventListener('contextmenu', menu, true)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [])

  // Hide by itself after a while so a forgotten bubble never sits over the game.
  useEffect(() => {
    if (!tip) return
    const id = setTimeout(hideTip, 6000)
    return () => clearTimeout(id)
  }, [tip])

  return tip ? <Bubble key={tip.key} tip={tip} /> : null
}

const EDGE = 8
function Bubble({ tip }: { tip: Tip }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean; arrow: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const left = Math.min(vw - EDGE - w, Math.max(EDGE, tip.x - w / 2))
    // Above the badge when it fits, else below it.
    const below = tip.top - h - 12 < EDGE
    setPos({ left, top: below ? tip.bottom + 10 : tip.top - h - 10, below, arrow: Math.min(w - 14, Math.max(14, tip.x - left)) })
  }, [tip])
  return (
    <div ref={ref} role="tooltip" className={`tap-tip${pos?.below ? ' below' : ''}`} onClick={hideTip}
      style={pos ? { left: pos.left, top: pos.top, ['--arrow' as string]: `${pos.arrow}px` } : { left: 0, top: 0, visibility: 'hidden' }}>
      {tip.body}
    </div>
  )
}
