import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { World } from './scene/World'
import { Hud } from './ui/Hud'
import { ThumbBaker } from './scene/BuildingPreview'
import { BottomBar, ShopPanel, ShowroomPanel, GaragePanel, Toasts } from './ui/Menus'
import { RacePanel, LiveRaceOverlay, InvitesPanel, PrizePopup } from './ui/Race'
import { joinLobby, useLive } from './lib/live'
import { FriendsPanel, VisitBanner } from './ui/Friends'
import { Tutorial } from './ui/Tutorial'
import { Badges } from './ui/Badges'
import { NeedPanel } from './ui/Need'
import { UpgradePanel } from './ui/Upgrade'
import { RescuePanel } from './ui/Rescue'
import { BankPanel } from './ui/Bank'
import { LevelUpSplash } from './ui/LevelUp'
import { AccountPanel } from './ui/Account'
import { GoalsPanel, DailyPanel, FlatPanel } from './ui/Goals'
import { useGame, today } from './game/store'
import { startCloudSync } from './lib/cloud'

// Phones get a lighter renderer: lower pixel ratio keeps iOS from dropping the WebGL context.
const SMALL = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700

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
      <Canvas shadows orthographic camera={{ position: [30, 32, 30], zoom: 36, near: 0.1, far: 500 }} dpr={SMALL ? [1, 1.5] : [1, 2]}
        onCreated={({ gl }) => {
          // Let the browser restore the 3D view after it drops the context, instead of leaving it blank.
          gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault())
          gl.domElement.addEventListener('webglcontextrestored', () => location.reload())
        }}
      >
        <World />
      </Canvas>
      <Badges />
      <ThumbBaker />
      <Hud />
      <BottomBar />
      {panel === 'shop' && <ShopPanel />}
      {panel === 'showroom' && <ShowroomPanel />}
      {panel === 'garage' && <GaragePanel />}
      {panel === 'race' && !liveRace && <RacePanel />}
      {liveRace && <LiveRaceOverlay />}
      {panel === 'invites' && <InvitesPanel />}
      {panel === 'friends' && <FriendsPanel />}
      {panel === 'need' && <NeedPanel />}
      {panel === 'upgrade' && <UpgradePanel />}
      {panel === 'rescue' && <RescuePanel />}
      {panel === 'bank' && <BankPanel />}
      <VisitBanner />
      <Tutorial />
      {panel === 'account' && <AccountPanel />}
      {panel === 'goals' && <GoalsPanel />}
      {panel === 'daily' && <DailyPanel />}
      {panel === 'flat' && <FlatPanel />}
      <PrizePopup />
      <LevelUpSplash />
      <Toasts />
    </>
  )
}
