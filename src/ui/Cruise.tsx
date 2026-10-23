import { useEffect, useState } from 'react'
import { useGame } from '../game/store'
import { carDef } from '../game/data'
import { cruiseInput, endCruise, useCruise } from '../scene/cruise'
import { backdrop, compose, photoFilter, savePhoto } from '../scene/photo'
import { grabTown } from './shot'
import { KeyHints, TouchDrive, useDriveKeys, useTall, useTouchDevice } from './DriveControls'

// The controls while you drive your own car round town (scene/cruise.ts). Every other
// layer of the page hides, the way screenshot mode does, so it's just you and the town.
export function Cruise() {
  const uid = useCruise((c) => c.uid)
  return uid ? <CruiseLayer uid={uid} /> : null
}

function CruiseLayer({ uid }: { uid: string }) {
  const name = useGame((s) => carDef(s.cars.find((c) => c.uid === uid)?.model ?? '').name)
  const touch = useTouchDevice()
  const tall = useTall()
  const [flash, setFlash] = useState(0)
  const shoot = async () => {
    const shot = grabTown()
    const pic = shot && compose(shot, backdrop('studio'), photoFilter('none'))
    if (!pic) return
    setFlash((n) => n + 1)
    if (await savePhoto(pic, name)) useGame.getState().toast('📸 Photo saved!')
  }
  useDriveKeys(cruiseInput)
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('cruise')
    const key = (e: KeyboardEvent) => e.code === 'Escape' && endCruise()
    window.addEventListener('keydown', key)
    return () => {
      root.classList.remove('cruise')
      window.removeEventListener('keydown', key)
      Object.assign(cruiseInput, { steer: 0, gas: 0, brake: 0 })
    }
  }, [])
  return (
    <div className="cruise-ui">
      <div className="rf-top">
        <h2>🚗 {name}</h2>
        <button className="cam-btn" title="Take photo" aria-label="Take photo" onClick={() => void shoot()}>📸</button>
        <button className="close" onClick={endCruise} aria-label="Back to town">✕</button>
      </div>
      {flash > 0 && <div key={flash} className="ci-flash" aria-hidden />}
      {touch ? <TouchDrive input={cruiseInput} tall={tall} drift={false} autoGas={false} /> : <KeyHints drift={false} item={false} />}
    </div>
  )
}
