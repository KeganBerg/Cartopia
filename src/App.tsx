import { useEffect, useRef, useState } from 'react'
import { CountFrames, FpsMeter } from './ui/FpsMeter'
import { SharedShapes } from './scene/sharedShapes'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { NeutralToneMapping, type Material, type Mesh } from 'three'
import { World } from './scene/World'
import { Hud } from './ui/Hud'
import { FlyLayer } from './ui/Fly'
import { ThumbRenderer } from './scene/BuildingPreview'
import { Preview, StageCanvas } from './scene/Stage'
import { WarmPreview } from './scene/WarmPreview'
import { quietShaders } from './scene/warm'
import { TapTips } from './ui/TapTip'
import { BottomBar, ShopPanel, CarsPage, Toasts } from './ui/Menus'
import { ShotGrabber, ShotMode } from './ui/ShotMode'
import { InventoryPanel } from './ui/Inventory'
import { PaintPrizePopup } from './ui/PaintRivals'
import { RecapPopup } from './ui/Recap'
import { TunerPrizePopup } from './ui/TunerTrials'
import { CupPrizePopup, MasteryPrizePopup } from './ui/ClassCups'
import { joinLobby, useLive } from './lib/live'
import { chatDemo, startChat } from './lib/chat'
import { ChatPanel } from './ui/Chat'
import { VisitBanner } from './ui/Friends'
import { SocialPanel, isSocialTab, type SocialTab } from './ui/SocialPanel'
import { Kept } from './ui/KeepTabs'
import { Tutorial } from './ui/Tutorial'
import { TutHand } from './ui/TutHand'
import { Tips } from './ui/Tips'
import { Badges } from './ui/Badges'
import { ThoughtBubble } from './ui/Thought'
import { NeedPanel } from './ui/Need'
import { UpgradePanel } from './ui/Upgrade'
import { BankPanel } from './ui/Bank'
import { unlocked } from './game/unlocks'
import { CarPacksPanel } from './ui/CarPacks'
import { DealsPanel } from './ui/Deals'
import { LevelUpSplash } from './ui/LevelUp'
import { PurchaseSplash } from './ui/PurchaseSplash'
import { GoalSplash } from './ui/GoalSplash'
import { AccountPanel, openLegal } from './ui/Account'
import { AlertsCard } from './ui/Alerts'
import { WelcomeBack } from './ui/WelcomeBack'
import { GiftWatcher, GiftsPanel } from './ui/Gifts'
import { UsernameWatcher } from './ui/Username'
import { GhostRacePanel, TauntWatcher, TauntsPanel } from './ui/GhostRace'
import { GoalsPanel, FlatPanel } from './ui/Goals'
import { SeasonPanel } from './ui/Season'
import { useGame } from './game/store'
import { setCalmSky } from './game/weather'
import { startCloudSync } from './lib/cloud'
import { startPurchaseSync } from './lib/payments'
import { startMenuHistory } from './lib/menuHistory'
import './lib/rescue'
import './lib/crates'
import './lib/accountSwitch'
import { startAmbience } from './lib/ambience'
import { startMusic } from './lib/townMusic'
import { startTechnoMusic } from './lib/technoMusic'
import { TechnoLayer } from './ui/Techno'
import { LiveBanner } from './ui/LiveBanner'
import { FlashWarning, RaveHeadsUp, flashWarningOpen, openDaily } from './ui/FlashWarning'
import { useTownPaused, useTownSlowed } from './scene/renderGate'
import { PACES, useTownPace } from './scene/townPace'
import { FrameCap, isDesktop, townFps } from './scene/frameCap'
import { useFreeCam } from './scene/freeCam'
import { useCrewGoalWatcher } from './ui/CrewGoal'
import { useCrewBattleWatcher } from './ui/crewBattleWatch'
import { VisitorBadges, StreetRaceCard } from './ui/Visitors'
import { visitorTick, forceVisitor } from './lib/visitors'
import type { VisitorKind } from './game/data'
import { hideSplash, splashProgress } from './lib/splash'
import { rememberSplashCar, skinSplashCar } from './lib/splashCar'
import { usePrefs } from './lib/prefs'
import { onDemand, reopenAfterReload } from './ui/lazy'
import { useAdminCheck } from './lib/admin'
import { captureArrival, startInviteFollowUp } from './lib/invite'

// Rusty's yard, the crate depot and the arcade each bring their own 3D scenes,
// so they load on first open instead of with the town. Once the town is up they
// are fetched in the background, so opening one later is still instant.
const loadRescue = () => import('./ui/Rescue')
const loadCrates = () => import('./ui/Crates')
const loadArcade = () => import('./ui/Arcade')
const loadWheel = () => import('./ui/Wheel')
// The Race menu, drag races, kart and live races: the biggest share of the game's code.
const loadRace = () => import('./ui/Race')
const loadBattle = () => import('./ui/CrewBattle')
const RescuePanel = onDemand(loadRescue, (m) => m.RescuePanel)
const CratesPanel = onDemand(loadCrates, (m) => m.CratesPanel)
const ArcadePanel = onDemand(loadArcade, (m) => m.ArcadePanel)
const WheelPanel = onDemand(loadWheel, (m) => m.WheelPanel)
const BattlePanel = onDemand(loadBattle, (m) => m.BattlePanel)
const RacePanel = onDemand(loadRace, (m) => m.RacePanel)
// Only admins ever open it, so nobody else downloads it.
const AdminPanel = onDemand(() => import('./ui/Admin'), (m) => m.AdminPanel)
const LiveRaceOverlay = onDemand(loadRace, (m) => m.LiveRaceOverlay)
const InvitesPanel = onDemand(loadRace, (m) => m.InvitesPanel)
const PrizePopup = onDemand(loadRace, (m) => m.PrizePopup)
const CampaignPrizePopup = onDemand(loadRace, (m) => m.CampaignPrizePopup)
const TourPrizePopup = onDemand(loadRace, (m) => m.TourPrizePopup)
const EventPrizePopup = onDemand(loadRace, (m) => m.EventPrizePopup)
const prefetchPanels = () => {
  const go = () => { loadRace(); loadRescue(); loadCrates(); loadArcade() }
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 4000 })
  else go()
}

export default function App() {
  useAdminCheck()
  const panel = useGame((s) => s.panel)
  // The Social window kept out of sight shows the tab it was left on.
  const [socialTab, setSocialTab] = useState<SocialTab>('friends')
  if (isSocialTab(panel) && panel !== socialTab) setSocialTab(panel)
  // Real-money menus need the Crew House (src/game/payGate.ts).
  const bankOn = useGame((s) => unlocked(s, 'bank'))
  const paceStep = useTownPace((p) => p.step)
  const pace = PACES[paceStep]
  const free = useFreeCam((f) => f.on)
  const liveRace = useLive((l) => l.race)
  // Race prizes: their popups load with the Race menu's code, so they mount only when won.
  const gpPrize = useGame((s) => !!s.gpPrize)
  const campaignPrize = useGame((s) => !!s.campaignPrize)
  const tourPrize = useGame((s) => !!s.tourPrize)
  const eventPrize = useGame((s) => !!s.eventPrize)
  const tick = useGame((s) => s.tick)
  const townPaused = useTownPaused()
  const townSlowed = useTownSlowed()
  const graphics = usePrefs((p) => p.graphics)
  useCrewGoalWatcher()
  useCrewBattleWatcher()

  useEffect(() => {
    captureArrival()
    startCloudSync()
    startPurchaseSync()
    const stopMenuHistory = startMenuHistory()
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
    skinSplashCar()
    const stopSplashCar = rememberSplashCar()
    // Checked again when it fires: a cloud save may have loaded since, already claimed today.
    // On first launch it waits for the flashing-lights warning (FlashWarning opens it after).
    // A menu that couldn't load before a reload onto a new build (ui/lazy.tsx) opens again first.
    setTimeout(() => { reopenAfterReload(); if (!flashWarningOpen()) openDaily() }, 800)
    // A new player's first spin is the tutorial's reward: it opens once the tutorial is done or skipped.
    const unsubDaily = useGame.subscribe((s, prev) => {
      if (s.tutorial >= 99 && prev.tutorial < 99) setTimeout(openDaily, 1200)
      setCalmSky(s.tutorial < 99)
    })
    setCalmSky(useGame.getState().tutorial < 99)
    // ?visitor=racer|tourist|mystery|barn brings a guest's visitor right away (for testing).
    const forced = new URLSearchParams(location.search).get('visitor') as VisitorKind | null
    if (forced) setTimeout(() => forceVisitor(forced), 2500)
    const stopInvite = startInviteFollowUp()
    const id = setInterval(() => {
      tick(Date.now())
      visitorTick()
    }, 1000)
    return () => {
      clearInterval(id)
      clearTimeout(splashFallback)
      unsubDaily()
      stopInvite()
      clearTimeout(prefetch)
      stopSplashCar()
      stopMenuHistory()
    }
  }, [tick])

  return (
    <>
      {/* Camera sits well back with a tight near/far range so depth stays precise and flat layers never flicker. */}
      <Canvas className="town-3d" shadows={graphics !== 'saver'} orthographic camera={{ position: [75, 80, 75], zoom: 36, near: 1, far: 320 }} dpr={graphics === 'saver' ? 1 : graphics === 'auto' ? [1, pace.dpr] : [1, 2]} gl={{ toneMapping: NeutralToneMapping }} frameloop={townPaused ? 'never' : 'demand'}
        onCreated={({ gl }) => {
          quietShaders(gl)
          splashProgress(0.9)
          // Let the browser restore the 3D view after it drops the context, instead of leaving it blank.
          gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault())
          gl.domElement.addEventListener('webglcontextrestored', () => location.reload())
        }}
      >
        <SharedShapes />
        <CountFrames view="town" />
        <World />
        <SplashHandoff />
        <ShotGrabber />
        <FrameCap fps={townSlowed ? Math.min(30, pace.fps) : townFps(graphics, pace.fps, paceStep === 0, free, isDesktop())} paused={townPaused} />
        <ShadowSwitch on={graphics !== 'saver'} />
      </Canvas>
      <FpsMeter />
      <TechnoLayer />
      <Badges />
      <VisitorBadges />
      <ThoughtBubble />
      <ThumbRenderer />
      <StageCanvas />
      <Preview.StageCanvas />
      <WarmPreview />
      <Hud />
      <LiveBanner />
      <BottomBar />
      {/* The main menus stay built while switching between them (Kept), and go back in town. */}
      <Kept on={panel === 'shop'} open={!!panel}><ShopPanel /></Kept>
      <Kept on={panel === 'inventory'} open={!!panel}><InventoryPanel /></Kept>
      {/* My Cars, For Sale, Collection and Crates are one page that stays up while its tabs switch. */}
      <Kept on={panel === 'garage' || panel === 'showroom' || panel === 'crates'} open={!!panel}><CarsPage crates={(onReady) => <CratesPanel embedded onReady={onReady} />} /></Kept>
      {panel === 'race' && !liveRace && <RacePanel />}
      {liveRace && <LiveRaceOverlay />}
      {panel === 'invites' && <InvitesPanel />}
      {/* Friends, Crew, Meet and Leaderboards: one window that stays up while its tabs switch. */}
      <Kept on={isSocialTab(panel)} open={!!panel}><SocialPanel tab={socialTab} /></Kept>
      {panel === 'chat' && <ChatPanel />}
      {panel === 'need' && <NeedPanel />}
      {panel === 'upgrade' && <UpgradePanel />}
      {panel === 'rescue' && <RescuePanel />}
      <Kept on={panel === 'bank' && bankOn} open={!!panel}><BankPanel /></Kept>
      <Kept on={panel === 'carpacks' && bankOn} open={!!panel}><CarPacksPanel /></Kept>
      {panel === 'deals' && <DealsPanel />}
      {panel === 'battle' && <BattlePanel />}
      <VisitBanner />
      <Tutorial />
      <TutHand />
      <Tips />
      <GoalSplash />
      <AlertsCard />
      {panel === 'account' && <AccountPanel />}
      <Kept on={panel === 'goals'} open={!!panel}><GoalsPanel /></Kept>
      {panel === 'season' && <SeasonPanel />}
      {panel === 'daily' && <WheelPanel />}
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
      {panel === 'admin' && <AdminPanel />}
      {gpPrize && <PrizePopup />}
      {campaignPrize && <CampaignPrizePopup />}
      {tourPrize && <TourPrizePopup />}
      {eventPrize && <EventPrizePopup />}
      <PaintPrizePopup />
      <TunerPrizePopup />
      <CupPrizePopup />
      <MasteryPrizePopup />
      <RecapPopup />
      <LevelUpSplash />
      <PurchaseSplash />
      <Toasts />
      <TapTips />
      <FlyLayer />
      <RaveHeadsUp />
      <FlashWarning />
      <ShotMode />
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
