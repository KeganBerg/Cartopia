import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { World } from './scene/World'
import { Hud } from './ui/Hud'
import { ThumbRenderer } from './scene/BuildingPreview'
import { BottomBar, ShopPanel, ShowroomPanel, GaragePanel, Toasts } from './ui/Menus'
import { RacePanel, LiveRaceOverlay, InvitesPanel, PrizePopup, CampaignPrizePopup } from './ui/Race'
import { joinLobby, useLive } from './lib/live'
import { FriendsPanel, VisitBanner } from './ui/Friends'
import { LeadersPanel, ClanPanel } from './ui/Social'
import { Tutorial } from './ui/Tutorial'
import { Badges } from './ui/Badges'
import { ThoughtBubble } from './ui/Thought'
import { NeedPanel } from './ui/Need'
import { UpgradePanel } from './ui/Upgrade'
import { RescuePanel } from './ui/Rescue'
import { BankPanel } from './ui/Bank'
import { LevelUpSplash } from './ui/LevelUp'
import { AccountPanel } from './ui/Account'
import { AlertsCard } from './ui/Alerts'
import { WelcomeBack } from './ui/WelcomeBack'
import { GiftWatcher, GiftsPanel } from './ui/Gifts'
import { GoalsPanel, DailyPanel, FlatPanel } from './ui/Goals'
import { useGame, today } from './game/store'
import { startCloudSync } from './lib/cloud'
import './lib/rescue'
import { startAmbience } from './lib/ambience'
import { useTownPaused } from './scene/renderGate'

// Phones get a lighter renderer: lower pixel ratio keeps iOS from dropping the WebGL context.
const SMALL = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700

export default function App() {
  const panel = useGame((s) => s.panel)
  const liveRace = useLive((l) => l.race)
  const tick = useGame((s) => s.tick)
  const townPaused = useTownPaused()

  useEffect(() => {
    startCloudSync()
    startAmbience()
    joinLobby()
    tick(Date.now())
    // Checked again when it fires: a cloud save may have loaded since, already claimed today.
    setTimeout(() => { const s = useGame.getState(); if (s.lastDaily !== today() && !s.panel) s.openPanel('daily') }, 800)
    const id = setInterval(() => tick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [tick])

  return (
    <>
      {/* Camera sits well back with a tight near/far range so depth stays precise and flat layers never flicker. */}
      <Canvas shadows orthographic camera={{ position: [75, 80, 75], zoom: 36, near: 1, far: 320 }} dpr={SMALL ? [1, 1.5] : [1, 2]} gl={{ toneMapping: NeutralToneMapping }} frameloop={townPaused ? 'never' : 'always'}
        onCreated={({ gl }) => {
          // Let the browser restore the 3D view after it drops the context, instead of leaving it blank.
          gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault())
          gl.domElement.addEventListener('webglcontextrestored', () => location.reload())
        }}
      >
        <World />
      </Canvas>
      <Badges />
      <ThoughtBubble />
      <ThumbRenderer />
      <Hud />
      <BottomBar />
      {panel === 'shop' && <ShopPanel />}
      {panel === 'showroom' && <ShowroomPanel />}
      {panel === 'garage' && <GaragePanel />}
      {panel === 'race' && !liveRace && <RacePanel />}
      {liveRace && <LiveRaceOverlay />}
      {panel === 'invites' && <InvitesPanel />}
      {panel === 'friends' && <FriendsPanel />}
      {panel === 'leaders' && <LeadersPanel />}
      {panel === 'clan' && <ClanPanel />}
      {panel === 'need' && <NeedPanel />}
      {panel === 'upgrade' && <UpgradePanel />}
      {panel === 'rescue' && <RescuePanel />}
      {panel === 'bank' && <BankPanel />}
      <VisitBanner />
      <Tutorial />
      <AlertsCard />
      {panel === 'account' && <AccountPanel />}
      {panel === 'goals' && <GoalsPanel />}
      {panel === 'daily' && <DailyPanel />}
      {panel === 'flat' && <FlatPanel />}
      <WelcomeBack />
      <GiftWatcher />
      {panel === 'gifts' && <GiftsPanel />}
      <PrizePopup />
      <CampaignPrizePopup />
      <LevelUpSplash />
      <Toasts />
    </>
  )
}
