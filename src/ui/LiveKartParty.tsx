import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame, type OwnedCar } from '../game/store'
import { CARS, performance } from '../game/data'
import { FIELD, KartRace, TRACKS, buildTrack } from '../game/kart'
import { KartLink } from '../lib/kartNet'
import { INVITE_MS, cleanCard, endParty, useLive, type LivePlayer, type LiveRace } from '../lib/live'
import { joinParty, partyChannel, reportPartyFinish, type PartyVerdict } from '../lib/party'
import { placeShare } from '../game/boosts'
import { playerName } from '../lib/profiles'
import { signedInUser } from '../lib/cloud'
import { CarThumb } from '../scene/BuildingPreview'
import { KartGame, playerRacer, type KartRacer } from './Kart'
import { look as kartLook } from './ArcadeBits'
import { liveKartPrize } from './LiveKart'

// A kart party: the host and up to five invited players, AI karts filling the rest of the
// grid. Before the start everyone waits on the party's roster (who's in, who's still
// deciding); the host starts it. Then it runs like a 1v1 live kart race (lib/kartNet), the
// host's browser driving the AI, and the server (lib/party) places the players by time.

type Setup = { seed: number; track: number; reverse: boolean; pi: number; players: string[]; cards: LivePlayer[] }
const KART_CREW = ['Lugnut Lou', 'Dizzy Dash', 'Turbo Tess', 'Skid Mark', 'Polly Piston', 'Revvin Kevin', 'Nitro Nell', 'Gravel Gus']
const zero = { engine: 0, turbo: 0, tires: 0, weight: 0 }
const START_WAIT = 8000 // after the setup goes out, start without anyone still not ready

// AI fill the front of the grid; the guests, then the host, line up at the back.
// players: host first. Returns the field and, per kart, the player id that drives it.
export function partyField(s: Setup, racers: KartRacer[]): { field: KartRacer[]; owners: string[] } {
  let r = s.seed
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647)
  const names = [...KART_CREW].map((n) => ({ n, k: rand() })).sort((a, b) => a.k - b.k).map((x) => x.n)
  const nAi = FIELD - racers.length
  const ai = Array.from({ length: nAi }, (_, i) => {
    const pi = Math.max(5, Math.round(s.pi * (0.9 + i * 0.05)))
    const c = [...CARS].sort((a, b) => Math.abs(performance(a, zero) - pi) - Math.abs(performance(b, zero) - pi) || a.id.localeCompare(b.id))[i % 2]
    return { name: names[i], pi, ai: true, skill: 0.6 + i * 0.08, look: kartLook({ uid: '', model: c.id, color: c.colors[i % c.colors.length], upgrades: zero }) }
  })
  const host = s.players[0]
  return {
    field: [...ai, ...racers.slice(1), racers[0]],
    owners: [...ai.map(() => host), ...s.players.slice(1), host],
  }
}

function cleanSetup(raw: unknown): Setup | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const int = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi
  if (!int(o.seed, 1, 2147483646) || !int(o.track, 0, TRACKS.length - 1) || typeof o.reverse !== 'boolean' || !int(o.pi, 1, 250)) return null
  const players = o.players
  if (!Array.isArray(players) || players.length < 2 || players.length > FIELD || !players.every((p) => typeof p === 'string' && p.length <= 64)) return null
  if (new Set(players).size !== players.length || !Array.isArray(o.cards) || o.cards.length !== players.length) return null
  const cards = o.cards.map(cleanCard)
  if (cards.some((c, i) => !c || c.id !== players[i])) return null
  return { seed: o.seed as number, track: o.track as number, reverse: o.reverse, pi: o.pi as number, players: players as string[], cards: cards as LivePlayer[] }
}

const racerOf = (p: LivePlayer): KartRacer => ({
  name: playerName(p.uid, p.town), pi: p.pi, ai: false,
  look: { body: p.body, model: CARS.find((c) => c.name === p.carName)?.id, color: p.color, mods: p.mods },
})
const ORD = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
const PLACEHOLDER = { race: new KartRace(buildTrack(TRACKS[0], false), [{ name: 'You', pi: 1, ai: false }], 1) }

// The server and channel calls, swappable so the dev harness (scripts/kartshot ?party) can race
// browser tabs over a BroadcastChannel.
export type PartyDeps = { join: typeof joinParty; channel: typeof partyChannel; report: typeof reportPartyFinish; me?: string }
const REAL: PartyDeps = { join: joinParty, channel: partyChannel, report: reportPartyFinish }

export function LiveKartParty({ live, car, onExit, deps = REAL }: { live: LiveRace; car: OwnedCar; onExit: () => void; deps?: PartyDeps }) {
  const lobbyMe = useLive((l) => l.me)
  const me = deps.me ?? lobbyMe
  const party = useLive((l) => l.party)
  const mine = useMemo(() => playerRacer(car), [car])
  const host = live.opponent // for a guest: the host. For the host: the first invited (unused).
  const [setup, setSetup] = useState<Setup | null>(null)
  const [here, setHere] = useState<Record<string, LivePlayer>>({})
  const [ready, setReady] = useState<Record<string, boolean>>({})
  const [go, setGo] = useState(false)
  const [verdict, setVerdict] = useState<PartyVerdict | 'checking' | 'failed' | null>(null)
  const [chan, setChan] = useState<ReturnType<typeof partyChannel>>(null)
  const started = useRef(false)
  const setupRef = useRef(setup)
  useEffect(() => { setupRef.current = setup }, [setup])

  // My own card, as the lobby shows it to the others.
  const myCard = useMemo<LivePlayer>(() => {
    const d = CARS.find((c) => c.id === car.model)
    return { id: me, uid: signedInUser(), town: useGame.getState().townName, level: useGame.getState().level, carName: d?.name ?? '', color: car.color, body: d?.body ?? 'coupe', pi: mine.pi, mods: car.mods }
  }, [me, car, mine.pi])

  // Built once per setup. The lobby's player list changes whenever anyone joins or leaves the
  // lobby; depending on it rebuilt the race mid-run (every kart back on the grid, clock at 0).
  const built = useMemo(() => {
    if (!setup) return null
    const lobby = useLive.getState().players
    const racers = setup.players.map((id, i) => (id === me ? mine : racerOf(lobby.find((p) => p.id === id) ?? setup.cards[i])))
    return partyField(setup, racers)
  }, [setup, me, mine])
  const net = useMemo(() => {
    if (!setup || !built || !chan) return null
    const race = new KartRace(buildTrack(TRACKS[setup.track], setup.reverse), built.field.map((f) => ({ name: f.name, pi: f.pi, ai: f.ai, skill: f.skill })), setup.seed)
    const link = new KartLink(race, me, built.owners, chan)
    link.onGone = (p) => {
      const i = setup.players.indexOf(p)
      useGame.getState().toast(`${built.field[built.owners.lastIndexOf(p)]?.name ?? setup.cards[i]?.town} dropped out. An AI driver takes over.`)
    }
    return { race, link }
  }, [setup, built, me, chan])

  // The server first (the party channel is private to its players), then the channel.
  useEffect(() => {
    let disposed = false
    let ping: ReturnType<typeof setInterval> | undefined
    let c: ReturnType<typeof partyChannel> = null
    void deps.join(live.raceId).then((ok) => {
      if (disposed) return
      if (!ok) {
        useGame.getState().toast("📡 Party didn't start · try again")
        onExit()
        return
      }
      c = deps.channel(live.raceId, () => {
        // Guests say they're here until the setup comes, then that they're ready until the
        // start; the host keeps offering the setup until it starts.
        ping = setInterval(() => {
          if (started.current) return clearInterval(ping)
          if (live.host) { if (setupRef.current) c?.send('setup', setupRef.current) }
          else if (setupRef.current) c?.send('ready', { id: me, seed: setupRef.current.seed })
          else c?.send('here', { id: me })
        }, 700)
      })
      if (!c) return onExit()
      const cc = c
      c.on('here', (p) => {
        if (!live.host) return
        // Only players we invited (their card as the lobby showed it to us); once it's set up,
        // a late arrival is told it went without them.
        const id = (p as { id?: unknown })?.id
        const card = useLive.getState().party?.invited.find((q) => q.id === id)
        if (!card) return
        if (setupRef.current) return cc.send('setup', setupRef.current)
        setHere((h) => (h[card.id] ? h : { ...h, [card.id]: card }))
      })
      c.on('setup', (p) => {
        if (live.host || started.current) return
        const s = cleanSetup(p)
        if (!s || s.players[0] !== host.id) return
        if (!s.players.includes(me)) {
          useGame.getState().toast('The party started without you')
          return onExit()
        }
        if (!setupRef.current) setSetup(s)
      })
      c.on('ready', (p) => {
        const o = p as { id?: unknown; seed?: unknown }
        if (!live.host || typeof o?.id !== 'string' || o.seed !== setupRef.current?.seed || !setupRef.current?.players.includes(o.id)) return
        if (started.current) return cc.send('go', {})
        setReady((r) => (r[o.id as string] ? r : { ...r, [o.id as string]: true }))
      })
      c.on('go', () => {
        if (live.host || started.current || !setupRef.current) return
        started.current = true
        setGo(true)
      })
      c.on('leave', (p) => {
        if (started.current) return
        // The host calling it off ends it for everyone; a guest leaving just drops off the roster.
        const id = (p as { id?: unknown })?.id
        if (!live.host && id === host.id) {
          useGame.getState().toast(`${playerName(host.uid, host.town)} called off the party`)
          onExit()
        } else if (live.host && typeof id === 'string') setHere((h) => { const n = { ...h }; delete n[id]; return n })
      })
      setChan(c)
    })
    return () => {
      disposed = true
      clearInterval(ping)
      if (!started.current) c?.send('leave', { id: me })
      c?.close()
      if (live.host) endParty()
    }
  }, [live, me, host, myCard, onExit, deps])

  // Host: start once everyone is ready (or after a short wait, AI driving anyone missing).
  const startRace = () => {
    if (!live.host || setup) return
    const guests = Object.values(here)
    if (!guests.length) return
    const players = [me, ...guests.map((g) => g.id)]
    const pis = [mine.pi, ...guests.map((g) => g.pi)]
    endParty() // nobody else can join now
    setSetup({
      seed: 1 + Math.floor(Math.random() * 2147483000), track: Math.floor(Math.random() * TRACKS.length), reverse: Math.random() < 0.5,
      pi: Math.round(pis.reduce((a, b) => a + b, 0) / pis.length), players, cards: [myCard, ...guests],
    })
  }
  useEffect(() => {
    if (!live.host || !setup || started.current || !chan) return
    const all = setup.players.slice(1).every((id) => ready[id])
    const begin = () => {
      if (started.current) return
      started.current = true
      for (let i = 0; i < 3; i++) setTimeout(() => chan.send('go', {}), i * 250)
      setGo(true)
    }
    if (all) return begin()
    const id = setTimeout(begin, START_WAIT)
    return () => clearTimeout(id)
  }, [live.host, setup, ready, chan])
  // Host: off it goes once everyone invited is here or has said no, or when the invites run
  // out with anyone here at all.
  const invited = useMemo(() => party?.invited ?? [], [party])
  const hereCount = Object.keys(here).length
  const allIn = hereCount > 0 && invited.every((p) => here[p.id] || party?.answers[p.id] === false)
  const startRef = useRef(startRace)
  const hereRef = useRef(here)
  useEffect(() => { startRef.current = startRace; hereRef.current = here })
  useEffect(() => {
    if (live.host && allIn) startRef.current()
  }, [live.host, allIn])
  useEffect(() => {
    if (!live.host) return
    const id = setTimeout(() => {
      if (setupRef.current) return
      if (Object.keys(hereRef.current).length) return startRef.current()
      useGame.getState().toast('Nobody joined the party')
      onExit()
    }, INVITE_MS + 2000)
    return () => clearTimeout(id)
  }, [live.host, onExit])

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const others = setup ? setup.cards.filter((c) => c.id !== me) : []
  const prize = liveKartPrize(others.length ? Math.round(others.reduce((a, c) => a + c.pi, 0) / others.length) : mine.pi)
  const payOf = (place: number, of: number) => Math.round(prize * placeShare(place, of, true))
  const onFinish = async (_place: number, time: number) => {
    setVerdict('checking')
    const v = await deps.report(live.raceId, time)
    if (v) useGame.getState().finishRace(v.place === 1, prize, { mode: 'kart', live: true, loss: payOf(v.place, v.of) })
    if (!mounted.current) return
    setVerdict(v ?? 'failed')
  }

  const title = `🏎️ Kart party ×${setup ? setup.players.length : 1 + invited.length}`
  const verdictView = verdict === 'checking' ? <div className="kt-verdict wait">⏳ 🏁</div>
    : verdict === 'failed' ? <div className="kt-verdict lose">📡 Didn't count</div>
    : verdict ? (
      <div className={`kt-verdict ${verdict.place === 1 ? 'win' : 'lose'}`}>
        <b>{verdict.place === 1 ? '🏆' : ''} {ORD(verdict.place)} / {verdict.of}</b>
        <span>🪙 +${payOf(verdict.place, verdict.of).toLocaleString()}</span>
      </div>
    ) : null

  // Before the start: the roster, and for the host the one button that starts it.
  const roster = (
    <div className="kp-roster">
      <div className="kp-rows">
        {(setup ? setup.cards : live.host ? [myCard, ...invited] : [host, myCard]).map((p) => {
          const st = p.id === me || (live.host ? !!here[p.id] : true) ? 'in' : party?.answers[p.id] === false ? 'out' : 'wait'
          return (
            <div key={p.id} className={`kp-row ${st}`}>
              <CarThumb size="sm" color={p.color} body={p.body} mods={p.mods} />
              <b>{p.id === me ? 'You' : playerName(p.uid, p.town)}</b>
              <span className="kp-pi">PI {p.pi}</span>
              <span className="kp-st" aria-label={st}>{st === 'in' ? '✅' : st === 'out' ? '❌' : '⏳'}</span>
            </div>
          )
        })}
      </div>
      {live.host && !setup ? (
        <button className="buy kp-go" disabled={!hereCount} onClick={startRace}>🏁 Go ×{hereCount + 1}</button>
      ) : (
        <div className="kp-note">⏳ 🏁</div>
      )}
    </div>
  )

  if (!setup || !built || !net) {
    return <KartGame key="wait" car={car} title={title} track={TRACKS[0]} reverse={false} field={[mine]} onFinish={() => {}} onExit={onExit}
      live={{ race: PLACEHOLDER.race, tick: () => {}, me: 0, ready: false, verdict: null, lobby: roster }} />
  }
  return (
    <KartGame key="race" car={car} title={title} track={TRACKS[setup.track]} reverse={setup.reverse} field={built.field} onFinish={onFinish} onExit={onExit}
      live={{ race: net.race, tick: () => net.link.tick(), me: built.owners.lastIndexOf(me), ready: go, verdict: verdictView, lobby: roster }} />
  )
}
