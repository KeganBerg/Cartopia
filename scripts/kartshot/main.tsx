// Dev harness: the kart race screen with a made-up garage car.
// ?track=0..2&rev=1&me=<car id>&autopilot&warp=<s>&touch=1&time=0..1
// ?live=host / ?live=guest in two tabs of one browser: a live kart race between them over a
// BroadcastChannel (no server), to check the netcode by eye.
import { createRoot } from 'react-dom/client'
import { CARS } from '../../src/game/data'
import { TRACKS, gpField } from '../../src/game/kart'
import { KartGame, playerRacer, type KartRacer } from '../../src/ui/Kart'
import { look } from '../../src/ui/ArcadeBits'
import { LiveKart, type LiveKartDeps } from '../../src/ui/LiveKart'
import type { NetChannel } from '../../src/lib/kartNet'
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
const live = q.get('live')
if (live) {
  const other = live === 'host' ? 'guest' : 'host'
  const deps: LiveKartDeps = {
    me: live,
    join: async () => true,
    channel: (raceId: string, onJoined: () => void) => {
      const bc = new BroadcastChannel('kart-' + raceId)
      const subs = new Map<string, ((p: unknown) => void)[]>()
      bc.onmessage = (e) => { for (const f of subs.get(e.data.event) ?? []) f(e.data.payload) }
      setTimeout(onJoined, 50)
      const ch: NetChannel & { close: () => void } = {
        send: (event, payload) => bc.postMessage({ event, payload: JSON.parse(JSON.stringify(payload)) }),
        on: (event, cb) => { subs.set(event, [...(subs.get(event) ?? []), cb]) },
        close: () => bc.close(),
      }
      return ch
    },
    // Stands in for the server: swap finish times with the other tab, lower wins.
    report: (raceId: string, t: number) => new Promise((done) => {
      const bc = new BroadcastChannel('kart-fin-' + raceId)
      let theirs: number | null = null
      const send = () => bc.postMessage({ from: live, t })
      bc.onmessage = (e) => {
        if (e.data.from === other && theirs === null) { theirs = e.data.t; send(); done({ won: t < theirs!, myTime: t, theirTime: theirs!, forfeit: false, void: false }) }
      }
      send()
    }),
  }
  const opp = { id: other, uid: null, town: other === 'host' ? 'Gearville' : 'Nitro Bay', level: 12, carName: 'Stallion', color: '#c62828', body: CARS.find((c) => c.id === 'stallion')!.body, pi: 48 }
  createRoot(document.getElementById('root')!).render(
    <LiveKart live={{ raceId: q.get('race') ?? 'dev', opponent: opp, host: live === 'host', mode: 'kart' }} car={me as never} onExit={() => {}} deps={deps} />,
  )
} else {
  createRoot(document.getElementById('root')!).render(
    <KartGame car={me as never} title={`Street Kings · Race 3 of 6`} track={track} reverse={q.get('rev') === '1'} field={field} prize={950} next={{ label: '▶ Race 4 · $1,050', go: () => {} }} onFinish={() => {}} onExit={() => {}} />,
  )
}
