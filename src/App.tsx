import { useEffect, useRef, useState, type ComponentType } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { NeutralToneMapping, type Material, type Mesh } from 'three'
import { World } from './scene/World'
import { Hud } from './ui/Hud'
import { FlyLayer } from './ui/Fly'
import { ThumbRenderer } from './scene/BuildingPreview'
import { StageCanvas } from './scene/Stage'
import { BottomBar, ShopPanel, ShowroomPanel, GaragePanel, Toasts } from './ui/Menus'
import { PaintPrizePopup } from './ui/PaintRivals'
import { TunerPrizePopup } from './ui/TunerTrials'
import { RacePanel, LiveRaceOverlay, InvitesPanel, PrizePopup, CampaignPrizePopup, TourPrizePopup, EventPrizePopup } from './ui/Race'
import { joinLobby, useLive } from './lib/live'
import { chatDemo, startChat } from './lib/chat'
import { ChatPanel } from './ui/Chat'
import { FriendsPanel, VisitBanner } from './ui/Friends'
import { LeadersPanel, ClanPanel } from './ui/Social'
import { MeetPanel } from './ui/Meet'
import { Tutorial } from './ui/Tutorial'
import { Tips } from './ui/Tips'
import { Badges } from './ui/Badges'
import { ThoughtBubble } from './ui/Thought'
import { NeedPanel } from './ui/Need'
import { UpgradePanel } from './ui/Upgrade'
import { BankPanel } from './ui/Bank'
import { DealsPanel } from './ui/Deals'
import { LevelUpSplash } from './ui/LevelUp'
import { GoalSplash } from './ui/GoalSplash'
import { AccountPanel, openLegal } from './ui/Account'
import { AlertsCard } from './ui/Alerts'
import { WelcomeBack } from './ui/WelcomeBack'
import { GiftWatcher, GiftsPanel } from './ui/Gifts'
import { UsernameWatcher } from './ui/Username'
import { GhostRacePanel, TauntWatcher, TauntsPanel } from './ui/GhostRace'
import { GoalsPanel, DailyPanel, FlatPanel } from './ui/Goals'
import { SeasonPanel } from './ui/Season'
import { useGame } from './game/store'
import { startCloudSync } from './lib/cloud'
import './lib/rescue'
import './lib/crates'
import { startAmbience } from './lib/ambience'
import { startMusic } from './lib/townMusic'
import { startTechnoMusic } from './lib/technoMusic'
import { TechnoLayer } from './ui/Techno'
import { FlashWarning, RaveHeadsUp, flashWarningOpen, openDaily } from './ui/FlashWarning'
import { useTownPaused } from './scene/renderGate'
import { useCrewGoalWatcher } from './ui/CrewGoal'
import { BattlePanel, useCrewBattleWatcher } from './ui/CrewBattle'
import { VisitorBadges, StreetRaceCard } from './ui/Visitors'
import { visitorTick, forceVisitor } from './lib/visitors'
import type { VisitorKind } from './game/data'
import { hideSplash, splashProgress } from './lib/splash'
import { rememberSplashCar } from './lib/splashCar'
import { usePrefs } from './lib/prefs'

// Rusty's yard, the crate depot and the arcade each bring their own 3D scenes,
// so they load on first open instead of with the town. Once the town is up they
// are fetched in the background, so opening one later is still instant.
const loadRescue = () => import('./ui/Rescue')
const loadCrates = () => import('./ui/Crates')
const loadArcade = () => import('./ui/Arcade')
// Shows nothing for the moment the file is loading, then the panel. (A plain
// state flip rather than React.lazy, which never showed the panel in the dev server.)
function onDemand<M>(load: () => Promise<M>, pick: (m: M) => ComponentType) {
  let Loaded: ComponentType | null = null
  return function OnDemand() {
    const [, setReady] = useState(false)
    useEffect(() => {
      if (!Loaded) load().then((m) => { Loaded = pick(m); setReady(true) })
    }, [])
    return Loaded ? <Loaded /> : null
  }
}
const RescuePanel = onDemand(loadRescue, (m) => m.RescuePanel)
const CratesPanel = onDemand(loadCrates, (m) => m.CratesPanel)
const ArcadePanel = onDemand(loadArcade, (m) => m.ArcadePanel)
const prefetchPanels = () => {
  const go = () => { loadRescue(); loadCrates(); loadArcade() }
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 4000 })
  else go()
}

// Phones get a lighter renderer: lower pixel ratio keeps iOS from dropping the WebGL context.
const SMALL = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700

export default function App() {
  const panel = useGame((s) => s.panel)
  const liveRace = useLive((l) => l.race)
  const tick = useGame((s) => s.tick)
  const townPaused = useTownPaused()
  const graphics = usePrefs((p) => p.graphics)
  useCrewGoalWatcher()
  useCrewBattleWatcher()

  useEffect(() => {
    startCloudSync()
    startAmbience()
    startMusic()
    startTechnoMusic()
    joinLobby()
    // /terms and /privacy open in the Menu when the dev server (or an old cached page) serves the game there.
    const legal = location.pathname.replace(/\/$/, '').slice(1)
    if (legal === 'terms' || legal === 'privacy') openLegal(legal)
    // ?chatdemo shows sample messages so the chat window can be checked signed out.
    if (new URLSearchParams(location.search).has('chatdemo')) chatDemo()
    else startChat()
    tick(Date.now())
    // The loading screen leaves after the town's first frames; this is the fallback if they never come.
    const splashFallback = setTimeout(hideSplash, 15000)
    const prefetch = setTimeout(prefetchPanels, 6000)
    const stopSplashCar = rememberSplashCar()
    // Checked again when it fires: a cloud save may have loaded since, already claimed today.
    // On first launch it waits for the flashing-lights warning (FlashWarning opens it after).
    setTimeout(() => { if (!flashWarningOpen()) openDaily() }, 800)
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
      clearTimeout(prefetch)
      stopSplashCar()
    }
  }, [tick])

  return (
    <>
      {/* Camera sits well back with a tight near/far range so depth stays precise and flat layers never flicker. */}
      <Canvas shadows={graphics !== 'saver'} orthographic camera={{ position: [75, 80, 75], zoom: 36, near: 1, far: 320 }} dpr={graphics === 'saver' ? 1 : SMALL && graphics === 'auto' ? [1, 1.5] : [1, 2]} gl={{ toneMapping: NeutralToneMapping }} frameloop={townPaused ? 'never' : 'always'}
        onCreated={({ gl }) => {
          splashProgress(0.9)
          // Let the browser restore the 3D view after it drops the context, instead of leaving it blank.
          gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault())
          gl.domElement.addEventListener('webglcontextrestored', () => location.reload())
        }}
      >
        <World />
        <SplashHandoff />
        <ShadowSwitch on={graphics !== 'saver'} />
      </Canvas>
      <TechnoLayer />
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
      <Tips />
      <GoalSplash />
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
      <PaintPrizePopup />
      <TunerPrizePopup />
      <LevelUpSplash />
      <Toasts />
      <FlyLayer />
      <RaveHeadsUp />
      <FlashWarning />
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

// Shadows switched in Settings: every material rebuilds its shader so the
// change shows at once instead of leaving the last shadows painted on.
function ShadowSwitch({ on }: { on: boolean }) {
  const scene = useThree((s) => s.scene)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    scene.traverse((o) => {
      const m = (o as Mesh).material as Material | Material[] | undefined
      if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true))
      else if (m) m.needsUpdate = true
    })
  }, [on, scene])
  return null
}
