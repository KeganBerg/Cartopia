import { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { useFreeCam } from '../scene/freeCam'
import { savePhoto } from '../scene/photo'
import { useGame } from '../game/store'
import { Icon } from './Icon'

import { isTap, setShot, useShot } from './shot'

const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

// The town's frame as it is now, without any of the page on top. Set by ShotGrabber.
let grab: (() => HTMLCanvasElement) | null = null

// Lives inside the town's Canvas: a fresh render read straight back into a plain canvas.
export function ShotGrabber() {
  const get = useThree((s) => s.get)
  useEffect(() => {
    grab = () => {
      const { gl, scene, camera } = get()
      gl.render(scene, camera)
      const src = gl.domElement
      const pic = document.createElement('canvas')
      pic.width = src.width
      pic.height = src.height
      pic.getContext('2d')?.drawImage(src, 0, 0)
      return pic
    }
    return () => void (grab = null)
  }, [get])
  return null
}

async function savePicture() {
  const pic = grab?.()
  if (!pic) return
  if (await savePhoto(pic, `town-${new Date().toISOString().slice(0, 10)}`)) useGame.getState().toast('📸 Picture saved!')
}

// The two free-camera buttons beside the camera toggle, and the hidden-UI layer itself.
export function ShotMode() {
  const free = useFreeCam((f) => f.on)
  const on = useShot((s) => s.on)
  useEffect(() => {
    if (!free) setShot(false)
  }, [free])
  useShotKey(free)
  if (!free) return null
  return on ? <ShotLayer /> : (
    <div className="shot-dock">
      <button className="goals-btn" onClick={() => setShot(true)} title="Screenshot mode: hide menus and bubbles (H)" aria-label="Screenshot mode">
        <Icon name="shutter" />
      </button>
      <button className="goals-btn" onClick={() => void savePicture()} title="Save picture of the view" aria-label="Save picture">
        <Icon name="save" />
      </button>
    </div>
  )
}

// The click that follows a showing-tap mustn't also open the building under the finger.
// It outlives the layer, which unmounts as soon as the tap lands.
function eatNextClick() {
  const eat = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
  }
  window.addEventListener('click', eat, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', eat, true), 500)
}

function ShotLayer() {
  const [hint, setHint] = useState(true)
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('shot')
    const fade = setTimeout(() => setHint(false), 1400)
    let start: { x: number; y: number; t: number; id: number } | null = null
    const down = (e: PointerEvent) => {
      start = e.isPrimary ? { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId } : null
    }
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return
      const tap = isTap(e.clientX - start.x, e.clientY - start.y, e.timeStamp - start.t)
      start = null
      if (!tap) return
      eatNextClick()
      setShot(false)
    }
    // Ahead of the free camera's own Esc, which would leave the free view altogether.
    const key = (e: KeyboardEvent) => {
      if (e.code !== 'Escape' && e.code !== 'KeyH') return
      e.stopImmediatePropagation()
      setShot(false)
    }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('keydown', key, true)
    return () => {
      root.classList.remove('shot')
      clearTimeout(fade)
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('keydown', key, true)
    }
  }, [])
  return <div className={`shot-ui${hint ? '' : ' gone'}`}>{TOUCH ? 'Tap to show menus' : 'Esc to show menus'}</div>
}

// H on a keyboard goes into screenshot mode while flying the free camera.
function useShotKey(free: boolean) {
  useEffect(() => {
    if (!free) return
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.code !== 'KeyH' || e.ctrlKey || e.metaKey || e.altKey || useShot.getState().on || useGame.getState().panel) return
      if (t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      setShot(true)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [free])
}
