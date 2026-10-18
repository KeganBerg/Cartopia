import { useEffect, useRef } from 'react'
import { useGame } from '../game/store'
import { handTarget } from './Tutorial'
import { tutPoint } from './tutPoint'

// Left alone this long, the rest of the screen dims around the next tap.
const IDLE_MS = 6000

type Box = { x: number; y: number; w: number; h: number }

const onScreen = (r: DOMRect) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth
const shown = (el: Element) => (el as HTMLElement & { checkVisibility?: (o: object) => boolean }).checkVisibility?.({ visibilityProperty: true, opacityProperty: true }) ?? true

// The first selector with something on screen; with several matches (pizza bubbles), the one nearest the middle.
function find(sels: string[]): Element | null {
  for (const sel of sels) {
    let best: Element | null = null
    let bestD = Infinity
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect()
      if (!onScreen(r) || !shown(el)) continue
      const d = (r.left + r.width / 2 - innerWidth / 2) ** 2 + (r.top + r.height / 2 - innerHeight / 2) ** 2
      if (d < bestD) { best = el; bestD = d }
    }
    if (best) return best
  }
  return null
}

// Point up from below, or down from above when the target sits low on the screen. On the
// tutorial card's own Next the hand comes from above: from below it sat right on Skip.
export function handBelow(box: Box, onCard: boolean, screenH: number) {
  return !onCard && box.y + box.h + 80 < screenH
}

// Something else on top (the flashing-lights warning, a toast): the hand waits rather than point at what can't be tapped.
function covered(el: Element, x: number, y: number) {
  const hit = document.elementFromPoint(x, y)
  return !!hit && hit !== el && !el.contains(hit)
}

// A big pointing finger on whatever the tutorial wants tapped next: a town bubble, a
// button, a card in a menu, the glowing lot, or the close button of a menu the player
// wandered into. A ring hugs the target; if the player stalls, the screen dims around it.
// Taps go straight through. It follows moving bubbles every frame.
export function TutHand() {
  const on = useGame((s) => s.tutorial < 99 && !s.visiting)
  const hand = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!on) return
    let raf = 0
    let frame = 0
    let el: Element | null = null
    let lastInput = performance.now()
    let key = ''
    const input = () => (lastInput = performance.now())
    addEventListener('pointerdown', input, true)
    const hide = () => {
      hand.current?.classList.remove('on')
      ring.current?.classList.remove('on', 'dim')
    }
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const t = handTarget(useGame.getState())
      const k = t === null ? '' : t === 'lot' ? 'lot' : t.join('|')
      // A new step (or menu) restarts the idle clock, so the dim never lands the moment it appears.
      if (k !== key) { key = k; lastInput = performance.now(); el = null; frame = 0 }
      let box: Box | null = null
      if (t === 'lot') {
        const p = tutPoint.at
        if (p && document.elementFromPoint(p.x, p.y)?.tagName === 'CANVAS') box = { x: p.x - 36, y: p.y - 28, w: 72, h: 56 }
      } else if (t) {
        // Look the target up a few times a second (every frame while there's none); read where it is every frame.
        // A target that stops matching (Search all turned on) is dropped at once, so it's never tapped twice.
        if (!el || frame++ % 8 === 0 || (el && (!el.isConnected || !el.matches(k.replaceAll('|', ', '))))) el = find(t)
        const r = el?.getBoundingClientRect()
        if (el && r && onScreen(r) && !covered(el, r.left + r.width / 2, r.top + r.height / 2)) box = { x: r.left, y: r.top, w: r.width, h: r.height }
      }
      const h = hand.current
      const g = ring.current
      if (!box || !h || !g) return hide()
      const below = handBelow(box, !!el?.closest('.tutorial'), innerHeight)
      const cx = box.x + box.w / 2
      const tipY = below ? box.y + box.h * 0.6 : box.y + box.h * 0.4
      h.classList.toggle('down', !below)
      h.style.transform = `translate(${Math.round(cx)}px, ${Math.round(tipY)}px)`
      const pad = 6
      g.style.transform = `translate(${Math.round(box.x - pad)}px, ${Math.round(box.y - pad)}px)`
      g.style.width = `${Math.round(box.w + pad * 2)}px`
      g.style.height = `${Math.round(box.h + pad * 2)}px`
      h.classList.add('on')
      g.classList.add('on')
      g.classList.toggle('dim', performance.now() - lastInput > IDLE_MS)
      // In town the ring (and its dim) sits under the tutorial card so the card stays readable; over menus it goes on top.
      g.classList.toggle('top', !!useGame.getState().panel)
    }
    loop()
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('pointerdown', input, true)
      hide()
    }
  }, [on])

  if (!on) return null
  return (
    <>
      <div ref={ring} className="tut-ring" aria-hidden />
      <div ref={hand} className="tut-hand" aria-hidden><span>👆</span></div>
    </>
  )
}
