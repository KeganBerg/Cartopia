// The Daily Spin: one free spin a day on a giant show wheel in a tyre shop (scene/WheelScene.tsx).
// The spin is rolled first (on the server when signed in); the wheel spins up straight away and
// then slows onto the slice it gave. Odds sit in the dock; the prize shows on your own car.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame, today, spinWheel } from '../game/store'
import { modDef, skinDef, modSkinDef, SKINS } from '../game/data'
import { WHEEL, TIER_COLOR, gemPile, wheelCoins, wheelPct, wheelSlice, spinGems, type WheelSlice, type WheelSpin } from '../game/wheel'
import { raceCarOf } from '../game/raceCar'
import { prizeLook } from '../scene/CrateScene'
import { WheelScene, type WheelDrive } from '../scene/WheelScene'
import { StageSlot, useStageReady } from '../scene/Stage'
import { CarThumb } from '../scene/BuildingPreview'
import { reducedMotion } from '../game/fx'
import { buzz } from '../lib/haptics'
import { wheelTick, wheelWin } from '../lib/wheelSfx'
import { CoinIcon, BuckIcon, PartsIcon, Icon } from './Icon'
import { compact } from './format'
import { flyFrom } from './Fly'
import { LoadingScene } from './Loading'
import './crates.css'
import './wheel.css'

const STEP = 360 / WHEEL.length
const FULL_SPEED = 720 // degrees a second
const WHEEL_CAM = { position: [0, 3, 9] as [number, number, number], fov: 40, near: 0.3, far: 60, shadows: true }

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
  if (s.kind === 'gems') return <Stack n={gemPile(s.gems)} gem size={size} />
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
  const coins = useGame((s) => s.coins)
  const bucks = useGame((s) => s.bucks)
  const prizeEl = useRef<HTMLDivElement>(null)
  // What the 3D wheel reads each frame.
  const [drive] = useState<WheelDrive>(() => ({ angle: 0, kick: -10, won: -1 }))
  const raf = useRef(0)

  // Already spun today (or a cloud save arrives saying so) while nothing is spinning: close.
  useEffect(() => { if (claimed && phase === 'idle') useGame.getState().openPanel(null) }, [claimed, phase])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const setAngle = (a: number) => { drive.angle = a }
  const kick = (speed: number) => {
    wheelTick(speed)
    drive.kick = performance.now() / 1000
  }

  const win = (sp: WheelSpin) => {
    setResult(sp)
    setPhase('won')
    const s = wheelSlice(sp.slice)
    if (!s) return
    drive.won = WHEEL.indexOf(s)
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
    let peg = Math.floor(drive.angle / STEP)
    let decel: { from: number; to: number; t0: number; dur: number } | null = null
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      let a: number
      if (!decel) {
        v = Math.min(FULL_SPEED, (FULL_SPEED * (now - started)) / 300)
        a = drive.angle + v * dt
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


  const close = () => useGame.getState().closePanel()
  const collect = () => {
    const o = result?.open
    if (o) {
      const coins = o.drop.kind === 'coins' || o.drop.kind === 'skindupe' ? o.drop.coins : 0
      const bucks = spinGems(o)
      if (coins || bucks) flyFrom(prizeEl.current, { coins: coins || undefined, bucks: bucks || undefined })
    }
    close()
  }

  const paintCar = (selectedCar && carsAt.some((c) => c.uid === selectedCar) ? selectedCar : raceCarOf(carsAt, raceCar)?.uid) ?? null
  const look = useMemo(() => (result ? prizeLook(result.open.drop, carsAt, paintCar) : null), [result, carsAt, paintCar])
  const won = phase === 'won' && result ? wheelSlice(result.slice) : null
  const wonColor = won ? TIER_COLOR[won.tier] : '#ffd54f'
  // Memoised: a new element every render would rebuild the whole scene.
  const scene = useMemo(() => <WheelScene level={level} drive={drive} wonColor={wonColor} />, [level, wonColor, drive])
  const stageReady = useStageReady()

  if (claimed && phase === 'idle') return null
  return (
    <div className="race-full crate-full wheel-full">
      <StageSlot cam={WHEEL_CAM}>{scene}</StageSlot>
      <LoadingScene ready={stageReady} label="Opening the Daily Spin" onClose={close} />
      <div className="rf-top">
        <h2>🎡 Daily Spin</h2>
        <span className="crate-wallet"><span><CoinIcon size={16} />{compact(coins)}</span><span><BuckIcon size={16} />{compact(bucks)}</span></span>
        <button className="close" onClick={close} aria-label="Close"><Icon name="close" size={16} /></button>
      </div>
      {won && result ? (
        <div className="wh-prize" ref={prizeEl} style={{ ['--tier' as string]: TIER_COLOR[won.tier] }}>
          {look ? <CarThumb size="sm" {...look} /> : <span className="wh-prize-ico"><SliceIcon s={won} size={48} /></span>}
          <Prize spin={result} />
          <button className="crate-open" onClick={collect}>Collect</button>
        </div>
      ) : (
        <div className="crate-dock wh-dock">
          <div className="wh-odds">
            {WHEEL.map((s) => (
              <div key={s.id} className="wh-odd" style={{ ['--tier' as string]: TIER_COLOR[s.tier] }} title={s.kind === 'part' ? 'A part for one of your cars' : s.kind === 'skin' ? 'A paint for your car' : undefined}>
                <SliceIcon s={s} size={18} />
                <b>{amount(s, level) || (s.kind === 'part' ? 'Part' : 'Paint')}</b>
                <small>{pct(wheelPct(s))}</small>
              </div>
            ))}
          </div>
          <button className="crate-open wh-go" disabled={phase !== 'idle'} onClick={spin}>{phase === 'spin' ? 'Spinning…' : 'Spin'}</button>
        </div>
      )}
    </div>
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
