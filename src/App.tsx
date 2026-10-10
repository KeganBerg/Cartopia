import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { World } from './scene/World'
import { Hud } from './ui/Hud'
import { BottomBar, ShopPanel, ShowroomPanel, GaragePanel, Toasts } from './ui/Menus'
import { RacePanel, LiveRaceOverlay, ChallengePopup } from './ui/Race'
import { joinLobby, useLive } from './lib/live'
import { FriendsPanel, VisitBanner } from './ui/Friends'
import { Tutorial } from './ui/Tutorial'
import { Badges } from './ui/Badges'
import { AccountPanel } from './ui/Account'
import { GoalsPanel, DailyPanel, FlatPanel } from './ui/Goals'
import { useGame, today } from './game/store'
import { startCloudSync } from './lib/cloud'

export default function App() {
  const panel = useGame((s) => s.panel)
  const liveRace = useLive((l) => l.race)
  const tick = useGame((s) => s.tick)

  useEffect(() => {
    startCloudSync()
    joinLobby()
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
      <Badges />
      <Hud />
      <BottomBar />
      {panel === 'shop' && <ShopPanel />}
      {panel === 'showroom' && <ShowroomPanel />}
      {panel === 'garage' && <GaragePanel />}
      {panel === 'race' && !liveRace && <RacePanel />}
      {liveRace && <LiveRaceOverlay />}
      <ChallengePopup />
      {panel === 'friends' && <FriendsPanel />}
      <VisitBanner />
      <Tutorial />
      {panel === 'account' && <AccountPanel />}
      {panel === 'goals' && <GoalsPanel />}
      {panel === 'daily' && <DailyPanel />}
      {panel === 'flat' && <FlatPanel />}
      <Toasts />
    </>
  )
}
