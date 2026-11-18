import { useEffect, useRef, useState } from 'react'
import { onFx, reducedMotion } from '../game/fx'
import { anchorCenter, anchorEls } from '../scene/anchors'

// Coins, parts and XP burst out of a building and fly into their HUD counters.
// Plain DOM driven by the Web Animations API: nothing re-renders while they fly.

type Res = 'coins' | 'parts' | 'xp' | 'bucks'
const TARGET: Record<Res, string> = { coins: '[data-fly=coins]', parts: '[data-fly=parts]', xp: '.speedo', bucks: '[data-fly=bucks]' }
const FACE: Record<Res, string> = { coins: '$', parts: '⚙', xp: '★', bucks: '💎' }
// When the coins land, so counters can wait for them before rolling up.
export const FLIGHT_MS = 900

// The HUD has a desktop and a phone layout; aim at whichever is on screen.
// Icons inside panels (reward chips) aren't counters.
const counters = (res: Res) => [...document.querySelectorAll<HTMLElement>(TARGET[res])].filter((el) => !el.closest('.overlay'))

// The counter a resource flies to, and where it is. Read before anything is added to the page:
// reading positions after adding the flying coins made the browser lay the whole page out again
// for each kind of reward (four times on a collect), a stall on every tap in a big town.
// The HUD hardly moves, so a quick run of taps reuses the last look for a moment.
type Aim = { el: HTMLElement; to: DOMRect }
const AIM_MS = 1000
const aimed = new Map<Res, { at: number; aim: Aim | null }>()
function aim(res: Res): Aim | null {
  const now = performance.now()
  const was = aimed.get(res)
  if (was && now - was.at < AIM_MS && (!was.aim || was.aim.el.isConnected)) return was.aim
  let found: Aim | null = null
  for (const el of counters(res)) {
    const to = el.getBoundingClientRect()
    if (to.width > 0 && to.height > 0) {
      found = { el, to }
      break
    }
  }
  aimed.set(res, { at: now, aim: found })
  return found
}

// The counter it landed on gives a little bounce. It was on screen when the coins set off, so
// it isn't measured again (that laid the page out once more as each kind landed).
function bump(res: Res, el: HTMLElement) {
  const host = (res === 'xp' ? el : el.parentElement) as HTMLElement | null
  host?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' })
}

function source(uid: string): [number, number] | null {
  const p = anchorCenter(uid)
  if (!p) return null
  // A badge half off the edge still bursts where you can see it.
  const m = 30
  return [Math.min(window.innerWidth - m, Math.max(m, p[0])), Math.min(window.innerHeight - m, Math.max(m, p[1]))]
}

function launch(layer: HTMLElement, from: [number, number], res: Res, n: number, delay: number, at: Aim | null) {
  if (!at) return
  const { to } = at
  const tx = to.left + to.width / 2
  const ty = to.top + to.height / 2
  let landed = false
  for (let i = 0; i < n; i++) {
    const el = document.createElement('span')
    el.className = `fly fly-${res}`
    el.textContent = FACE[res]
    layer.appendChild(el)
    // Pop out in a little fountain, hang for a beat, then whoosh to the counter.
    const a = Math.PI * (0.15 + 0.7 * Math.random()) + Math.PI
    const spread = 30 + Math.random() * 34
    const bx = from[0] + Math.cos(a) * spread
    const by = from[1] + Math.sin(a) * spread * 0.9
    const start = delay + i * 45
    const anim = el.animate(
      [
        { transform: `translate(${from[0]}px, ${from[1]}px) scale(.3)`, opacity: 0 },
        { transform: `translate(${bx}px, ${by}px) scale(1.15)`, opacity: 1, offset: 0.3, easing: 'ease-in-out' },
        { transform: `translate(${bx}px, ${by + 6}px) scale(1)`, opacity: 1, offset: 0.45, easing: 'cubic-bezier(.55,0,.85,.4)' },
        { transform: `translate(${tx}px, ${ty}px) scale(.55)`, opacity: 1 },
      ],
      { duration: FLIGHT_MS, delay: start, fill: 'both' },
    )
    anim.onfinish = () => {
      el.remove()
      if (!landed) {
        landed = true
        bump(res, at.el)
      }
    }
  }
}

// "+120" floating up from the building.
function label(layer: HTMLElement, from: [number, number], text: string) {
  const el = document.createElement('span')
  el.className = 'fly-label'
  el.textContent = text
  layer.appendChild(el)
  el.animate(
    [
      { transform: `translate(${from[0]}px, ${from[1]}px) translate(-50%, 0) scale(.6)`, opacity: 0 },
      { transform: `translate(${from[0]}px, ${from[1] - 28}px) translate(-50%, 0) scale(1.1)`, opacity: 1, offset: 0.2 },
      { transform: `translate(${from[0]}px, ${from[1] - 46}px) translate(-50%, 0) scale(1)`, opacity: 1, offset: 0.75 },
      { transform: `translate(${from[0]}px, ${from[1] - 60}px) translate(-50%, 0) scale(1)`, opacity: 0 },
    ],
    { duration: 1300, easing: 'ease-out' },
  ).onfinish = () => el.remove()
}

export type Amounts = { coins?: number; parts?: number; xp?: number; bucks?: number }
let layerEl: HTMLDivElement | null = null

const KINDS: Res[] = ['coins', 'bucks', 'parts', 'xp']

function burst(froms: [number, number][], e: Amounts) {
  const root = layerEl
  if (!root || !froms.length) return
  const quiet = reducedMotion()
  // Every position first, then the flying coins: see aim.
  const aims = Object.fromEntries(KINDS.filter((r) => e[r]).map((r) => [r, aim(r)])) as Partial<Record<Res, Aim | null>>
  // Fewer coins each when many buildings pay out at once.
  const each = Math.max(2, Math.round(8 / Math.sqrt(froms.length)))
  froms.forEach((p, i) => {
    if (quiet) return
    const d = i * 70
    if (e.coins) launch(root, p, 'coins', each, d, aims.coins ?? null)
    if (e.bucks) launch(root, p, 'bucks', Math.max(1, Math.round(each / 2)), d + 80, aims.bucks ?? null)
    if (e.parts) launch(root, p, 'parts', Math.max(1, Math.round(each / 3)), d + 120, aims.parts ?? null)
    if (e.xp) launch(root, p, 'xp', Math.max(1, Math.round(each / 3)), d + 200, aims.xp ?? null)
  })
  const bits = [e.coins && `+${e.coins.toLocaleString()}`, e.bucks && `+${e.bucks}💎`, e.parts && `+${e.parts}⚙`, e.xp && `+${e.xp} XP`].filter(Boolean)
  if (bits.length) label(root, froms[0], bits.join('  '))
  if (quiet) for (const r of ['coins', 'bucks', 'parts'] as const) {
    const a = aims[r]
    if (a) bump(r, a.el)
  }
}

// Rewards flying out of a piece of UI (a chest, a goal row) to the counters.
export function flyFrom(el: Element | null, e: Amounts) {
  if (!el) return
  const r = el.getBoundingClientRect()
  burst([[r.left + r.width / 2, r.top + r.height / 2]], e)
}

// A chest popping open: the box jumps, then its loot flies out to the counters.
export function openChestFx(btn: Element, e: Amounts) {
  const box = btn.closest('.chest')
  const icon = box?.querySelector('.chest-icon')
  if (icon && !reducedMotion()) {
    icon.animate(
      [
        { transform: 'rotate(0) scale(1)' },
        { transform: 'rotate(-14deg) scale(1.15)', offset: 0.2 },
        { transform: 'rotate(12deg) scale(1.2)', offset: 0.4 },
        { transform: 'translateY(-10px) scale(1.6)', offset: 0.65 },
        { transform: 'rotate(0) scale(1)' },
      ],
      { duration: 650, easing: 'ease-out' },
    )
  }
  flyFrom(icon ?? box ?? btn, e)
}

export function FlyLayer() {
  const layer = useRef<HTMLDivElement>(null)
  useEffect(() => {
    layerEl = layer.current
    const off = onFx((e) => {
      if (e.kind === 'helped') return flyFrom(e.el ?? anchorEls.get(e.uid) ?? null, e)
      if (e.kind !== 'collect') return
      const froms = [...new Set(e.uids)].map(source).filter((p): p is [number, number] => !!p).slice(0, 6)
      if (!froms.length) froms.push([window.innerWidth / 2, window.innerHeight / 2])
      burst(froms, e)
    })
    return () => {
      off()
      layerEl = null
    }
  }, [])
  return <div className="fly-layer" ref={layer} aria-hidden />
}

// A counter that rolls up to its new value instead of jumping, timed to land
// with the flying coins. Spending drops straight away.
export function Roll({ value, format = (v: number) => v.toLocaleString() }: { value: number; format?: (v: number) => string }) {
  const [shown, setShown] = useState(value)
  const cur = useRef(value)
  useEffect(() => {
    const from = cur.current
    if (value <= from || reducedMotion()) {
      cur.current = value
      setShown(value)
      return
    }
    let raf = 0
    const t0 = performance.now() + FLIGHT_MS * 0.55
    const dur = 550
    const step = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / dur))
      const v = Math.round(from + (value - from) * (1 - (1 - k) ** 3))
      cur.current = v
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{format(shown)}</>
}
