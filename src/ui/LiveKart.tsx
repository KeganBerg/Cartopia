import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame, type OwnedCar } from '../game/store'
import { CARS, carDef, performance } from '../game/data'
import { KartRace, TRACKS, buildTrack } from '../game/kart'
import { LIVE_LOSS_SHARE } from '../game/boosts'
import { KartLink } from '../lib/kartNet'
import { kartChannel, useLive, type LiveRace } from '../lib/live'
import { joinRefereed, reportFinish, type Verdict } from '../lib/referee'
import { playerName } from '../lib/profiles'
import { KartGame, playerRacer, type KartRacer } from './Kart'
import { look as kartLook } from './ArcadeBits'

// A live kart race from a challenge: the two players plus four AI karts on a circuit the
// challenger's browser picks. The challenger's browser drives the AI. Who beat whom is the
// server's call (lib/referee: the lower finish time between the two players wins), and the
// prize is the live race prize.

type Setup = { seed: number; track: number; reverse: boolean; pi: number }
const KART_CREW = ['Lugnut Lou', 'Dizzy Dash', 'Turbo Tess', 'Skid Mark', 'Polly Piston', 'Revvin Kevin', 'Nitro Nell', 'Gravel Gus']
const zero = { engine: 0, turbo: 0, tires: 0, weight: 0 }
export const liveKartPrize = (oppPi: number) => 300 + oppPi * 8

// Both browsers build the same field from the setup: four AI around the players' PI, then
// the guest (kart 4) and the challenger (kart 5) at the back of the grid.
export function liveKartField(s: Setup, host: KartRacer, guest: KartRacer): KartRacer[] {
  let r = s.seed
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647)
  const names = [...KART_CREW].sort((a, b) => a.localeCompare(b)).map((n) => ({ n, k: rand() })).sort((a, b) => a.k - b.k).map((x) => x.n)
  const ai = [0.9, 0.95, 1, 1.05].map((f, i) => {
    const pi = Math.max(5, Math.round(s.pi * f))
    const c = [...CARS].sort((a, b) => Math.abs(performance(a, zero) - pi) - Math.abs(performance(b, zero) - pi) || a.id.localeCompare(b.id))[i % 2]
    return { name: names[i], pi, ai: true, skill: 0.6 + i * 0.08, look: kartLook({ uid: '', model: c.id, color: c.colors[i % c.colors.length], upgrades: zero }) }
  })
  return [...ai, guest, host]
}

function cleanSetup(raw: unknown): Setup | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const int = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi
  if (!int(o.seed, 1, 2147483646) || !int(o.track, 0, TRACKS.length - 1) || typeof o.reverse !== 'boolean' || !int(o.pi, 1, 250)) return null
  return { seed: o.seed as number, track: o.track as number, reverse: o.reverse, pi: o.pi as number }
}

// Shown (empty) while the two browsers agree on a circuit.
const PLACEHOLDER = { race: new KartRace(buildTrack(TRACKS[0], false), [{ name: 'You', pi: 1, ai: false }], 1) }

// The server and channel calls, swappable so the dev harness (scripts/kartshot ?live) can race
// two browser tabs over a BroadcastChannel.
export type LiveKartDeps = { join: typeof joinRefereed; channel: typeof kartChannel; report: typeof reportFinish; me?: string }
const REAL: LiveKartDeps = { join: joinRefereed, channel: kartChannel, report: reportFinish }

export function LiveKart({ live, car, onExit, deps = REAL }: { live: LiveRace; car: OwnedCar; onExit: () => void; deps?: LiveKartDeps }) {
  const lobbyId = useLive((l) => l.me)
  const me = deps.me ?? lobbyId
  const o = live.opponent
  const mine = useMemo(() => playerRacer(car), [car])
  const theirs = useMemo<KartRacer>(() => ({
    name: playerName(o.uid, o.town), pi: o.pi, ai: false,
    look: { body: o.body, model: CARS.find((c) => c.name === o.carName)?.id, color: o.color, mods: o.mods },
  }), [o])
  const [setup, setSetup] = useState<Setup | null>(() => live.host ? {
    seed: 1 + Math.floor(Math.random() * 2147483000), track: Math.floor(Math.random() * TRACKS.length), reverse: Math.random() < 0.5,
    pi: Math.round((mine.pi + o.pi) / 2),
  } : null)
  const [go, setGo] = useState(false)
  const [verdict, setVerdict] = useState<Verdict | 'checking' | 'failed' | null>(null)
  const [chan, setChan] = useState<ReturnType<typeof kartChannel>>(null)
  const started = useRef(false)
  const setupRef = useRef(setup)
  useEffect(() => { setupRef.current = setup }, [setup])

  const field = useMemo(() => setup && (live.host ? liveKartField(setup, mine, theirs) : liveKartField(setup, theirs, mine)), [setup, live.host, mine, theirs])
  const owners = useMemo(() => {
    const host = live.host ? me : o.id, guest = live.host ? o.id : me
    return [host, host, host, host, guest, host]
  }, [live.host, me, o.id])
  const net = useMemo(() => {
    if (!setup || !field || !chan) return null
    const race = new KartRace(buildTrack(TRACKS[setup.track], setup.reverse), field.map((f) => ({ name: f.name, pi: f.pi, ai: f.ai, skill: f.skill, weight: f.look.model ? carDef(f.look.model).weight : undefined })), setup.seed)
    const link = new KartLink(race, me, owners, chan)
    link.onGone = () => useGame.getState().toast(`${playerName(o.uid, o.town)} lost their connection. An AI driver takes their kart.`)
    return { race, link }
  }, [setup, field, me, owners, o, chan])

  // Server first (the race channel is private to the race's two players), then the channel.
  useEffect(() => {
    let disposed = false
    let ping: ReturnType<typeof setInterval> | undefined
    let c: ReturnType<typeof kartChannel> = null
    deps.join(live.raceId, o.uid).then((ok) => {
      if (disposed) return
      if (!ok) {
        useGame.getState().toast("📡 Race didn't start · try again")
        onExit()
        return
      }
      c = deps.channel(live.raceId, () => {
        // The challenger keeps offering the setup until the other browser has it; the other
        // browser keeps saying it's ready until the start comes.
        ping = setInterval(() => {
          if (started.current) return clearInterval(ping)
          if (live.host) c?.send('setup', setupRef.current)
          else if (setupRef.current) c?.send('ready', { seed: setupRef.current.seed })
        }, 700)
      })
      if (!c) return onExit()
      const cc = c
      c.on('setup', (p) => {
        if (live.host || setupRef.current) return
        const s = cleanSetup(p)
        if (s) setSetup(s)
      })
      c.on('ready', (p) => {
        if (!live.host || (p as { seed?: unknown })?.seed !== setupRef.current?.seed) return
        // Still hearing 'ready' after the start: every 'go' got lost, so say it again.
        if (started.current) return cc.send('go', {})
        started.current = true
        for (let i = 0; i < 3; i++) setTimeout(() => cc.send('go', {}), i * 250)
        setGo(true)
      })
      c.on('go', () => {
        if (live.host || started.current) return
        started.current = true
        setGo(true)
      })
      c.on('leave', () => {
        if (started.current) return
        useGame.getState().toast(`${playerName(o.uid, o.town)} called off the race`)
        onExit()
      })
      setChan(c)
    })
    return () => {
      disposed = true
      clearInterval(ping)
      if (!started.current) c?.send('leave', {})
      c?.close()
    }
  }, [live, o, onExit, deps])

  // Our finish time goes to the server, which waits for theirs and calls it. That carries on
  // (and pays) even if the player leaves the podium first; only the podium update needs us here.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const prize = liveKartPrize(o.pi)
  const onFinish = async (_place: number, time: number) => {
    setVerdict('checking')
    const v = await deps.report(live.raceId, time, { cancelled: false })
    if (v && !v.void) useGame.getState().finishRace(v.won, prize, { mode: 'kart', live: true })
    if (!mounted.current) return
    setVerdict(!v || v.void ? 'failed' : v)
  }

  const who = playerName(o.uid, o.town)
  const verdictView = verdict === 'checking' ? <div className="kt-verdict wait">⏳ {who}</div>
    : verdict === 'failed' ? <div className="kt-verdict lose">📡 Didn't count</div>
    : verdict ? (
      <div className={`kt-verdict ${verdict.won ? 'win' : 'lose'}`}>
        <b>{verdict.won ? `🏆 You beat ${who}` : `${who} wins`}</b>
        <span>🪙 +${(verdict.won ? prize : Math.round(prize * LIVE_LOSS_SHARE)).toLocaleString()}</span>
      </div>
    ) : null

  if (!setup || !field || !net) {
    return <KartGame key="wait" car={car} title={`🏎️ vs ${who}`} track={TRACKS[0]} reverse={false} field={[mine]} onFinish={() => {}} onExit={onExit}
      live={{ race: PLACEHOLDER.race, tick: () => {}, me: 0, ready: false, verdict: null, loading: `Waiting for ${who}` }} />
  }
  return (
    <KartGame key="race" car={car} title={`🏎️ vs ${who}`} track={TRACKS[setup.track]} reverse={setup.reverse} field={field} onFinish={onFinish} onExit={onExit}
      live={{ race: net.race, tick: () => net.link.tick(), me: live.host ? 5 : 4, ready: go, verdict: verdictView, loading: `Waiting for ${who}` }} />
  )
}
