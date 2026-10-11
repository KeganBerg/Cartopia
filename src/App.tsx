import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { World } from './scene/World'
import { Hud } from './ui/Hud'
import { FlyLayer } from './ui/Fly'
import { ThumbRenderer } from './scene/BuildingPreview'
import { BottomBar, ShopPanel, ShowroomPanel, GaragePanel, Toasts } from './ui/Menus'
import { RacePanel, LiveRaceOverlay, InvitesPanel, PrizePopup, CampaignPrizePopup, TourPrizePopup, EventPrizePopup } from './ui/Race'
import { joinLobby, useLive } from './lib/live'
import { FriendsPanel, VisitBanner } from './ui/Friends'
import { LeadersPanel, ClanPanel } from './ui/Social'
import { MeetPanel } from './ui/Meet'
import { Tutorial } from './ui/Tutorial'
import { Badges } from './ui/Badges'
import { ThoughtBubble } from './ui/Thought'
import { NeedPanel } from './ui/Need'
import { UpgradePanel } from './ui/Upgrade'
import { RescuePanel } from './ui/Rescue'
import { BankPanel } from './ui/Bank'
import { DealsPanel } from './ui/Deals'
import { CratesPanel } from './ui/Crates'
import { LevelUpSplash } from './ui/LevelUp'
import { AccountPanel } from './ui/Account'
import { AlertsCard } from './ui/Alerts'
import { WelcomeBack } from './ui/WelcomeBack'
import { GiftWatcher, GiftsPanel } from './ui/Gifts'
import { GhostRacePanel, TauntWatcher, TauntsPanel } from './ui/GhostRace'
import { GoalsPanel, DailyPanel, FlatPanel } from './ui/Goals'
import { SeasonPanel } from './ui/Season'
import { ArcadePanel } from './ui/Arcade'
import { useGame, today } from './game/store'
import { startCloudSync } from './lib/cloud'
import './lib/rescue'
import './lib/crates'
import { startAmbience } from './lib/ambience'
import { useTownPaused } from './scene/renderGate'
import { useCrewGoalWatcher } from './ui/CrewGoal'
import { BattlePanel, useCrewBattleWatcher } from './ui/CrewBattle'
import { VisitorBadges, StreetRaceCard } from './ui/Visitors'
import { visitorTick, forceVisitor } from './lib/visitors'
import type { VisitorKind } from './game/data'

// Phones get a lighter renderer: lower pixel ratio keeps iOS from dropping the WebGL context.
const SMALL = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700

export default function App() {
  const panel = useGame((s) => s.panel)
  const liveRace = useLive((l) => l.race)
  const tick = useGame((s) => s.tick)
  const townPaused = useTownPaused()
  useCrewGoalWatcher()
  useCrewBattleWatcher()

  useEffect(() => {
    startCloudSync()
    startAmbience()
    joinLobby()
    tick(Date.now())
    // Checked again when it fires: a cloud save may have loaded since, already claimed today.
    setTimeout(() => { const s = useGame.getState(); if (s.lastDaily !== today() && !s.panel) s.openPanel('daily') }, 800)
    // ?visitor=racer|tourist|mystery|barn brings a guest's visitor right away (for testing).
    const forced = new URLSearchParams(location.search).get('visitor') as VisitorKind | null
    if (forced) setTimeout(() => forceVisitor(forced), 2500)
    const id = setInterval(() => {
      tick(Date.now())
      visitorTick()
    }, 1000)
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
      <VisitorBadges />
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
      {panel === 'meet' && <MeetPanel />}
      {panel === 'need' && <NeedPanel />}
      {panel === 'upgrade' && <UpgradePanel />}
      {panel === 'rescue' && <RescuePanel />}
      {panel === 'bank' && <BankPanel />}
      {panel === 'deals' && <DealsPanel />}
      {panel === 'crates' && <CratesPanel />}
      {panel === 'battle' && <BattlePanel />}
      <VisitBanner />
      <Tutorial />
      <AlertsCard />
      {panel === 'account' && <AccountPanel />}
      {panel === 'goals' && <GoalsPanel />}
      {panel === 'season' && <SeasonPanel />}
      {panel === 'daily' && <DailyPanel />}
      {panel === 'flat' && <FlatPanel />}
      <WelcomeBack />
      <GiftWatcher />
      {panel === 'gifts' && <GiftsPanel />}
      <StreetRaceCard />
      <TauntWatcher />
      {panel === 'taunts' && <TauntsPanel />}
      {panel === 'ghost' && <GhostRacePanel />}
      {panel === 'arcade' && <ArcadePanel />}
      <PrizePopup />
      <CampaignPrizePopup />
      <TourPrizePopup />
      <EventPrizePopup />
      <LevelUpSplash />
      <Toasts />
      <FlyLayer />
    </>
  )
}
