// The daily prize wheel: a glossy alloy rim in a tyre, eight slices round it, one free spin a day.
// The spin is rolled first (on the server when signed in); the wheel spins up straight away and
// then slows onto the slice it gave. Odds sit under the wheel; the prize shows on your own car.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame, today, spinWheel } from '../game/store'
import { modDef, skinDef, modSkinDef, SKINS } from '../game/data'
import { WHEEL, TIER_COLOR, wheelCoins, wheelPct, wheelSlice, spinGems, type WheelSlice, type WheelSpin } from '../game/wheel'
import { raceCarOf } from '../game/raceCar'
import { prizeLook } from '../scene/CrateScene'
import { CarThumb } from '../scene/BuildingPreview'
import { reducedMotion } from '../game/fx'
import { calmFlashing } from '../game/flashing'
import { buzz } from '../lib/haptics'
import { wheelTick, wheelWin } from '../lib/wheelSfx'
import { Panel } from './Menus'
import { CoinIcon, BuckIcon, PartsIcon } from './Icon'
import { flyFrom } from './Fly'

const N = WHEEL.length
const STEP = 360 / N
const FULL_SPEED = 720 // degrees a second
const R = 80 // slice radius in the wheel's 200 x 200 drawing

const polar = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180
  return [r * Math.sin(a), -r * Math.cos(a)] as const
}
function wedge(i: number, r = R) {
  const [x0, y0] = polar(i * STEP, r)
  const [x1, y1] = polar((i + 1) * STEP, r)
  return `M0 0L${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`
}

const SKIN_SWATCH = SKINS.find((s) => s.id === 'prismatic')?.swatch ?? SKINS[0]?.swatch

// A stack of n currency icons, a little offset, so a bigger prize looks bigger.
function Stack({ n, gem, size }: { n: number; gem?: boolean; size: number }) {
  return (
    <span className="wh-stack" style={{ width: size + (n - 1) * size * 0.32, height: size + (n - 1) * size * 0.12 }}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} style={{ left: i * size * 0.32, top: (n - 1 - i) * size * 0.12 }}>{gem ? <BuckIcon size={size} /> : <CoinIcon size={size} />}</span>
      ))}
    </span>
  )
}

function SliceIcon({ s, size = 26 }: { s: WheelSlice; size?: number }) {
  if (s.kind === 'coins') return <Stack n={s.mult < 0.5 ? 1 : s.mult < 1 ? 2 : 3} size={size} />
  if (s.kind === 'gems') return <Stack n={Math.min(s.gems, 3)} gem size={size} />
  if (s.kind === 'jackpot') return <span className="wh-jackpot"><span className="wh-crown">👑</span><Stack n={3} gem size={size} /></span>
  if (s.kind === 'part') return <PartsIcon size={size + 2} />
  return <span className="wh-swatch" style={{ width: size, height: size, background: SKIN_SWATCH }} />
}

const amount = (s: WheelSlice, level: number) =>
  s.kind === 'coins' ? wheelCoins(s.mult, level).toLocaleString() : s.kind === 'gems' || s.kind === 'jackpot' ? `${s.gems}` : ''

const pct = (p: number) => `${p < 1 ? p.toFixed(1) : Math.round(p)}%`

type Phase = 'idle' | 'spin' | 'won'

export function WheelPanel() {
  const level = useGame((s) => s.level)
  const claimed = useGame((s) => s.lastDaily === today())
  const cars = useGame((s) => s.cars)
  const selectedCar = useGame((s) => s.selectedCar)
  const raceCar = useGame((s) => s.raceCar)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<WheelSpin | null>(null)
  // The cars as they were before the spin, so a part prize shows the car it's going on.
  const [carsAt, setCarsAt] = useState(cars)
  const wheelEl = useRef<HTMLDivElement>(null)
  const flapEl = useRef<HTMLDivElement>(null)
  const prizeEl = useRef<HTMLDivElement>(null)
  const angle = useRef(0)
  const raf = useRef(0)

  // Already spun today (or a cloud save arrives saying so) while nothing is spinning: close.
  useEffect(() => { if (claimed && phase === 'idle') useGame.getState().openPanel(null) }, [claimed, phase])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const setAngle = (a: number) => {
    angle.current = a
    if (wheelEl.current) wheelEl.current.style.transform = `rotate(${a}deg)`
  }
  const kick = (speed: number) => {
    wheelTick(speed)
    flapEl.current?.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-22deg)' }, { transform: 'rotate(0deg)' }], { duration: 90 + (1 - speed) * 120, easing: 'ease-out' })
  }

  const win = (sp: WheelSpin) => {
    setResult(sp)
    setPhase('won')
    const s = wheelSlice(sp.slice)
    if (!s) return
    wheelWin(s.tier)
    buzz(s.tier === 'legendary' || s.tier === 'epic' ? [30, 60, 30, 60, 80] : 25)
  }

  const spin = async () => {
    if (phase !== 'idle') return
    setPhase('spin')
    setCarsAt(useGame.getState().cars)
    const quick = reducedMotion()
    // Spin up while the server rolls.
    let got: WheelSpin | null | undefined
    const asked = spinWheel().then((r) => { got = r })
    let v = 0
    let last = performance.now()
    const started = last
    let peg = Math.floor(angle.current / STEP)
    let decel: { from: number; to: number; t0: number; dur: number } | null = null
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      let a: number
      if (!decel) {
        v = Math.min(FULL_SPEED, (FULL_SPEED * (now - started)) / 300)
        a = angle.current + v * dt
        if (got === null) {
          // Couldn't spin (the toast says why): coast to a stop where it is.
          setAngle(a)
          setPhase('idle')
          return
        }
        if (got && now - started > (quick ? 150 : 700)) {
          const slice = WHEEL.findIndex((s) => s.id === got!.slice)
          const jitter = (Math.random() - 0.5) * STEP * 0.6
          // Clockwise turn that puts the slice's middle under the flapper at the top.
          const land = (((-(slice + 0.5) * STEP + jitter - a) % 360) + 360) % 360
          const dist = (quick ? 360 : 360 * 3) + land
          // Slows at the speed it had (ease-out cubic starts at 3 x dist / time), kept to a few seconds.
          decel = { from: a, to: a + dist, t0: now, dur: Math.min(quick ? 1500 : 6000, Math.max(quick ? 800 : 3500, ((3 * dist) / v) * 1000)) }
        }
      } else {
        const t = Math.min(1, (now - decel.t0) / decel.dur)
        a = decel.from + (decel.to - decel.from) * (1 - (1 - t) ** 3)
        v = ((3 * (decel.to - decel.from)) / (decel.dur / 1000)) * (1 - t) ** 2
        if (t >= 1) {
          setAngle(decel.to)
          win(got!)
          return
        }
      }
      setAngle(a)
      const p = Math.floor(a / STEP)
      if (p !== peg) {
        peg = p
        kick(Math.min(1, v / FULL_SPEED))
      }
      raf.current = requestAnimationFrame(frame)
    }
    raf.current = requestAnimationFrame(frame)
    await asked
  }


  const collect = () => {
    const o = result?.open
    if (o) {
      const coins = o.drop.kind === 'coins' || o.drop.kind === 'skindupe' ? o.drop.coins : 0
      const bucks = spinGems(o)
      if (coins || bucks) flyFrom(prizeEl.current, { coins: coins || undefined, bucks: bucks || undefined })
    }
    useGame.getState().openPanel(null)
  }

  const paintCar = (selectedCar && carsAt.some((c) => c.uid === selectedCar) ? selectedCar : raceCarOf(carsAt, raceCar)?.uid) ?? null
  const look = useMemo(() => (result ? prizeLook(result.open.drop, carsAt, paintCar) : null), [result, carsAt, paintCar])
  const won = phase === 'won' && result ? wheelSlice(result.slice) : null
  const wonIndex = won ? WHEEL.indexOf(won) : -1
  const lights = !calmFlashing()

  if (claimed && phase === 'idle') return null
  return (
    <Panel title="Daily Spin" className="wheel-panel">
      <div className={`wh-wrap${phase === 'spin' ? ' spinning' : ''}${won ? ' won' : ''}${lights ? ' lights' : ''}`}>
        <div className="wh-flap" ref={flapEl} aria-hidden><svg viewBox="0 0 30 40"><path d="M15 38 3 10a12 12 0 1 1 24 0Z" /><circle cx="15" cy="12" r="5" /></svg></div>
        <div className="wh-wheel" ref={wheelEl}>
          <svg viewBox="-100 -100 200 200" aria-hidden>
            <defs>
              <radialGradient id="wh-gloss" cx="0" cy="-40" r="120" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#fff" stopOpacity=".45" />
                <stop offset=".55" stopColor="#fff" stopOpacity="0" />
                <stop offset="1" stopColor="#000" stopOpacity=".22" />
              </radialGradient>
              <linearGradient id="wh-chrome" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset=".45" stopColor="#b9c4cf" />
                <stop offset=".55" stopColor="#7d8a97" />
                <stop offset="1" stopColor="#e6edf3" />
              </linearGradient>
            </defs>
            {/* Tyre with tread, then the chrome lip of the rim. */}
            <circle r="99" className="wh-tyre" />
            {Array.from({ length: 48 }, (_, i) => <rect key={i} x="-2.2" y="-99" width="4.4" height="9" rx="1" className="wh-tread" transform={`rotate(${i * 7.5})`} />)}
            <circle r="88" fill="url(#wh-chrome)" className="wh-lip" />
            {WHEEL.map((s, i) => <path key={s.id} d={wedge(i)} fill={TIER_COLOR[s.tier]} className="wh-slice" />)}
            {WHEEL.map((s, i) => i % 2 === 1 && <path key={s.id} d={wedge(i)} className="wh-shade" />)}
            {wonIndex >= 0 && <path d={wedge(wonIndex)} className="wh-hit" />}
            <circle r={R} fill="url(#wh-gloss)" className="wh-gloss" />
            {/* Spokes on the slice edges, pegs at their ends. */}
            {WHEEL.map((_, i) => (
              <g key={i} transform={`rotate(${i * STEP})`}>
                <rect x="-2.6" y={-R} width="5.2" height={R - 16} rx="2.4" fill="url(#wh-chrome)" className="wh-spoke" />
                <circle cy={-R + 3} r="3.2" fill="url(#wh-chrome)" className="wh-peg" />
              </g>
            ))}
            {Array.from({ length: 16 }, (_, i) => {
              const [x, y] = polar(i * 22.5 + 11.25, 84)
              return <circle key={i} cx={x} cy={y} r="2.6" className={`wh-bulb${i % 2 ? ' odd' : ''}`} />
            })}
          </svg>
          {WHEEL.map((s, i) => (
            <div key={s.id} className="wh-label" style={{ transform: `rotate(${(i + 0.5) * STEP}deg)` }}>
              <div className="wh-label-in">
                <SliceIcon s={s} />
                {amount(s, level) && <b>{amount(s, level)}</b>}
              </div>
            </div>
          ))}
        </div>
        <div className="wh-hub" aria-hidden><span>★</span></div>
      </div>

      {won && result ? (
        <div className="wh-prize" ref={prizeEl} style={{ ['--tier' as string]: TIER_COLOR[won.tier] }}>
          {look ? <CarThumb size="sm" {...look} /> : <span className="wh-prize-ico"><SliceIcon s={won} size={44} /></span>}
          <Prize spin={result} />
          <button className="buy" onClick={collect}>Collect</button>
        </div>
      ) : (
        <>
          <div className="wh-odds">
            {WHEEL.map((s) => (
              <div key={s.id} className="wh-odd" style={{ ['--tier' as string]: TIER_COLOR[s.tier] }} title={s.kind === 'part' ? 'A part for one of your cars' : s.kind === 'skin' ? 'A paint for your car' : undefined}>
                <SliceIcon s={s} size={18} />
                <b>{amount(s, level) || (s.kind === 'part' ? 'Part' : 'Paint')}</b>
                <small>{pct(wheelPct(s))}</small>
              </div>
            ))}
          </div>
          <button className="buy wh-go" disabled={phase !== 'idle'} onClick={spin}>{phase === 'spin' ? 'Spinning…' : 'Spin'}</button>
        </>
      )}
    </Panel>
  )
}

// What was won, as one line of icons and numbers.
function Prize({ spin }: { spin: WheelSpin }) {
  const d = spin.open.drop
  const gems = spinGems(spin.open)
  if (gems) return <b className="wh-prize-line"><BuckIcon size={28} />+{gems}</b>
  if (d.kind === 'coins' || d.kind === 'skindupe') {
    return <b className="wh-prize-line">{d.kind === 'skindupe' && <span className="wh-swatch sm" style={{ background: (d.part ? modSkinDef(d.skin) : skinDef(d.skin))?.swatch }} />}<CoinIcon size={28} />+{d.coins.toLocaleString()}</b>
  }
  if (d.kind === 'mod') return <b className="wh-prize-line"><PartsIcon size={26} />{modDef(d.mod)?.name ?? 'New part'}</b>
  if (d.kind === 'skin') {
    const s = d.part ? modSkinDef(d.skin) : skinDef(d.skin)
    return <b className="wh-prize-line"><span className="wh-swatch sm" style={{ background: s?.swatch }} />{s?.name ?? 'New paint'}</b>
  }
  return null
}
