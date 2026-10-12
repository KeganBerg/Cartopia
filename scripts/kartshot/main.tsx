// Dev harness: the kart race screen with a made-up garage car.
// ?track=0..2&rev=1&me=<car id>&autopilot&warp=<s>&touch=1&time=0..1
import { createRoot } from 'react-dom/client'
import { CARS } from '../../src/game/data'
import { TRACKS, gpField } from '../../src/game/kart'
import { KartGame, playerRacer, type KartRacer } from '../../src/ui/Kart'
import { look } from '../../src/ui/ArcadeBits'
import '../../src/index.css'
import '../../src/theme.css'

const q = new URLSearchParams(location.search)
const me = { uid: 'x', model: q.get('me') ?? 'hotshot', color: '', upgrades: { engine: 3, turbo: 3, tires: 3, weight: 3 } }
me.color = CARS.find((c) => c.id === me.model)!.colors[0]
const ids = ['stallion', 'rally', 'buggy', 'bandit', 'vette']
const names = ['Nitro Nina', 'Torque Tony', 'Drift Dee', 'Boost Bo', 'Redline Rae', 'King Kurt']
const f = gpField(names, 2, 46, { name: 'You', pi: 48 })
const field: KartRacer[] = f.map((r, i) => {
  if (!r.ai) return playerRacer(me as never)
  const c = CARS.find((o) => o.id === ids[i])!
  return { name: r.name, pi: r.pi, ai: true, skill: r.skill, look: look({ ...me, model: c.id, color: c.colors[i % c.colors.length] } as never) }
})
if (q.has('clean')) document.head.insertAdjacentHTML('beforeend', '<style>.rf-top,.kt-hud,.kt-map,.kt-slot,.dc,.dc-keys,.kt-flash,.kt-charge{display:none!important}</style>')
const track = TRACKS[Number(q.get('track') ?? 0)]
createRoot(document.getElementById('root')!).render(
  <KartGame car={me as never} title={`Street Kings · Race 3 of 6`} track={track} reverse={q.get('rev') === '1'} field={field} prize={950} next={{ label: '▶ Race 4 · $1,050', go: () => {} }} onFinish={() => {}} onExit={() => {}} />,
)
