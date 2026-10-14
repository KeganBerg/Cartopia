// Dev harness: a campaign race driven by a bot (perfect launch, shifts in the green, boost in fourth).
// ?car=crusher&up=5&pi=58&rival=stomper&skill=torque&shift=0.68&venue=desert
import { createRoot } from 'react-dom/client'
import { StageCanvas } from '../../src/scene/Stage'
import { DragRace } from '../../src/ui/Race'
import { carDef } from '../../src/game/data'
import '../../src/index.css'
import '../../src/theme.css'

const q = new URLSearchParams(location.search)
const up = Number(q.get('up') ?? 5)
const car = { uid: 'c1', model: q.get('car') ?? 'crusher', color: '#d32f2f', upgrades: { engine: up, turbo: up, tires: up, weight: up } }
const rc = carDef(q.get('rival') ?? 'stomper')
const rival = { id: 'camp-c3-4', town: 'The Scorpion', level: 16, carName: rc.name, color: '#1e88e5', pi: Number(q.get('pi') ?? 58), online: false, body: rc.body, model: rc.id, skill: q.get('skill') || undefined, shift: Number(q.get('shift') ?? 0.68), boss: true }
;(window as any).__result = null
createRoot(document.getElementById('root')!).render(
  <>
    <StageCanvas />
    <DragRace car={car as never} rival={rival as never} venueId={q.get('venue') ?? 'desert'} sky={(q.get('sky') ?? 'clear') as never} onExit={() => {}} onFinish={(won, a, b) => { (window as any).__result = { won, me: a, them: b }; return 0 }} />
  </>,
)
const key = (type: string, code: string) => window.dispatchEvent(new KeyboardEvent(type, { code }))
let down = false
const bot = () => {
  const tach = document.querySelector('svg.tach')
  const btn = document.querySelector('.shift-btn')
  if (tach && btn) {
    const cls = tach.getAttribute('class') ?? ''
    const text = tach.textContent ?? ''
    if (btn.textContent?.includes('HOLD')) {
      if (!cls.includes('now') && !cls.includes('late') && !down) { key('keydown', 'Space'); down = true }
      else if ((cls.includes('now') || cls.includes('late')) && down) { key('keyup', 'Space'); down = false }
    } else {
      if (down) { key('keyup', 'Space'); down = false }
      if (cls.includes(' now')) { key('keydown', 'Space'); key('keyup', 'Space') }
      if (text.includes('GEAR 4')) key('keydown', 'KeyB')
    }
  }
  requestAnimationFrame(bot)
}
requestAnimationFrame(bot)
