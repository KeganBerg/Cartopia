import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { World } from './scene/World'
import { Hud } from './ui/Hud'
import { FlyLayer } from './ui/Fly'
import { ThumbRenderer } from './scene/BuildingPreview'
import { StageCanvas } from './scene/Stage'
import { BottomBar, ShopPanel, ShowroomPanel, GaragePanel, Toasts } from './ui/Menus'
import { RacePanel, LiveRaceOverlay, InvitesPanel, PrizePopup, CampaignPrizePopup, TourPrizePopup, EventPrizePopup } from './ui/Race'
import { joinLobby, useLive } from './lib/live'
import { chatDemo, startChat } from './lib/chat'
import { ChatPanel } from './ui/Chat'
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
import { UsernameWatcher } from './ui/Username'
import { GhostRacePanel, TauntWatcher, TauntsPanel } from './ui/GhostRace'
import { GoalsPanel, DailyPanel, FlatPanel } from './ui/Goals'
import { SeasonPanel } from './ui/Season'
import { ArcadePanel } from './ui/Arcade'
import { useGame, today } from './game/store'
import { startCloudSync } from './lib/cloud'
import './lib/rescue'
import './lib/crates'
import { startAmbience } from './lib/ambience'
import { startMusic } from './lib/townMusic'
import { useTownPaused } from './scene/renderGate'
import { useCrewGoalWatcher } from './ui/CrewGoal'
import { BattlePanel, useCrewBattleWatcher } from './ui/CrewBattle'
import { VisitorBadges, StreetRaceCard } from './ui/Visitors'
import { visitorTick, forceVisitor } from './lib/visitors'
import type { VisitorKind } from './game/data'
import { hideSplash, splashProgress } from './lib/splash'
import { rememberSplashCar } from './lib/splashCar'

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
    startMusic()
    joinLobby()
    // ?chatdemo shows sample messages so the chat window can be checked signed out.
    if (new URLSearchParams(location.search).has('chatdemo')) chatDemo()
    else startChat()
    tick(Date.now())
    // The loading screen leaves after the town's first frames; this is the fallback if they never come.
    const splashFallback = setTimeout(hideSplash, 15000)
    const stopSplashCar = rememberSplashCar()
    // Checked again when it fires: a cloud save may have loaded since, already claimed today.
    setTimeout(() => { const s = useGame.getState(); if (s.lastDaily !== today() && !s.panel) s.openPanel('daily') }, 800)
    // ?visitor=racer|tourist|mystery|barn brings a guest's visitor right away (for testing).
    const forced = new URLSearchParams(location.search).get('visitor') as VisitorKind | null
    if (forced) setTimeout(() => forceVisitor(forced), 2500)
    const id = setInterval(() => {
      tick(Date.now())
      visitorTick()
    }, 1000)
    return () => {
      clearInterval(id)
      clearTimeout(splashFallback)
      stopSplashCar()
    }
  }, [tick])

  return (
    <>
      {/* Camera sits well back with a tight near/far range so depth stays precise and flat layers never flicker. */}
      <Canvas shadows orthographic camera={{ position: [75, 80, 75], zoom: 36, near: 1, far: 320 }} dpr={SMALL ? [1, 1.5] : [1, 2]} gl={{ toneMapping: NeutralToneMapping }} frameloop={townPaused ? 'never' : 'always'}
        onCreated={({ gl }) => {
          splashProgress(0.9)
          // Let the browser restore the 3D view after it drops the context, instead of leaving it blank.
          gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault())
          gl.domElement.addEventListener('webglcontextrestored', () => location.reload())
        }}
      >
        <World />
        <SplashHandoff />
      </Canvas>
      <Badges />
      <VisitorBadges />
      <ThoughtBubble />
      <ThumbRenderer />
      <StageCanvas />
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
      {panel === 'chat' && <ChatPanel />}
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
      <UsernameWatcher />
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

// Fades out the loading screen once the town has drawn a few frames, so the
// first-frame shader compile happens behind it instead of as a frozen town.
function SplashHandoff() {
  const frames = useRef(0)
  useFrame(() => {
    if (++frames.current === 3) hideSplash()
  })
  return null
}
