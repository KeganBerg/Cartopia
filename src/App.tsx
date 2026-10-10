import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { World } from './scene/World'
import { Hud } from './ui/Hud'
import { BottomBar, ShopPanel, ShowroomPanel, GaragePanel, Toasts } from './ui/Menus'
import { RacePanel } from './ui/Race'
import { AccountPanel } from './ui/Account'
import { GoalsPanel, DailyPanel, FlatPanel } from './ui/Goals'
import { useGame, today } from './game/store'
import { startCloudSync } from './lib/cloud'

export default function App() {
  const panel = useGame((s) => s.panel)
  const tick = useGame((s) => s.tick)

  useEffect(() => {
    startCloudSync()
    tick(Date.now())
    if (useGame.getState().lastDaily !== today()) setTimeout(() => useGame.getState().openPanel('daily'), 800)
    const id = setInterval(() => tick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [tick])

  return (
    <>
      <Canvas shadows orthographic camera={{ position: [30, 32, 30], zoom: 36, near: 0.1, far: 500 }} dpr={[1, 2]}>
        <World />
      </Canvas>
      <Hud />
      <BottomBar />
      {panel === 'shop' && <ShopPanel />}
      {panel === 'showroom' && <ShowroomPanel />}
      {panel === 'garage' && <GaragePanel />}
      {panel === 'race' && <RacePanel />}
      {panel === 'account' && <AccountPanel />}
      {panel === 'goals' && <GoalsPanel />}
      {panel === 'daily' && <DailyPanel />}
      {panel === 'flat' && <FlatPanel />}
      <Toasts />
    </>
  )
}
