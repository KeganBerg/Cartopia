import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { NeutralToneMapping, type Material, type Mesh } from 'three'
import { World } from './scene/World'
import { Hud } from './ui/Hud'
import { FlyLayer } from './ui/Fly'
import { ThumbRenderer } from './scene/BuildingPreview'
import { Preview, StageCanvas } from './scene/Stage'
import { quietShaders } from './scene/warm'
import { TapTips } from './ui/TapTip'
import { BottomBar, ShopPanel, ShowroomPanel, GaragePanel, Toasts } from './ui/Menus'
import { InventoryPanel } from './ui/Inventory'
import { PaintPrizePopup } from './ui/PaintRivals'
import { RecapPopup } from './ui/Recap'
import { TunerPrizePopup } from './ui/TunerTrials'
import { CupPrizePopup, MasteryPrizePopup } from './ui/ClassCups'
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
import './lib/rescue'
import './lib/crates'
import './lib/accountSwitch'
import { startAmbience } from './lib/ambience'
import { startMusic } from './lib/townMusic'
import { startTechnoMusic } from './lib/technoMusic'
import { TechnoLayer } from './ui/Techno'
import { LiveBanner } from './ui/LiveBanner'
import { FlashWarning, RaveHeadsUp, flashWarningOpen, openDaily } from './ui/FlashWarning'
import { useTownPaused } from './scene/renderGate'
import { PACES, useTownPace } from './scene/townPace'
import { useCrewGoalWatcher } from './ui/CrewGoal'
import { useCrewBattleWatcher } from './ui/crewBattleWatch'
import { VisitorBadges, StreetRaceCard } from './ui/Visitors'
import { visitorTick, forceVisitor } from './lib/visitors'
import type { VisitorKind } from './game/data'
import { hideSplash, splashProgress } from './lib/splash'
import { rememberSplashCar } from './lib/splashCar'
import { usePrefs } from './lib/prefs'
import { onDemand } from './ui/lazy'

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
  const panel = useGame((s) => s.panel)
  const pace = PACES[useTownPace((p) => p.step)]
  const liveRace = useLive((l) => l.race)
  // Race prizes: their popups load with the Race menu's code, so they mount only when won.
  const gpPrize = useGame((s) => !!s.gpPrize)
  const campaignPrize = useGame((s) => !!s.campaignPrize)
  const tourPrize = useGame((s) => !!s.tourPrize)
  const eventPrize = useGame((s) => !!s.eventPrize)
  const tick = useGame((s) => s.tick)
  const townPaused = useTownPaused()
  const graphics = usePrefs((p) => p.graphics)
  useCrewGoalWatcher()
  useCrewBattleWatcher()

  useEffect(() => {
    startCloudSync()
    startPurchaseSync()
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
    // A new player's first spin is the tutorial's reward: it opens once the tutorial is done or skipped.
    const unsubDaily = useGame.subscribe((s, prev) => {
      if (s.tutorial >= 99 && prev.tutorial < 99) setTimeout(openDaily, 1200)
      setCalmSky(s.tutorial < 99)
    })
    setCalmSky(useGame.getState().tutorial < 99)
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
      unsubDaily()
      clearTimeout(prefetch)
      stopSplashCar()
    }
  }, [tick])

  return (
    <>
      {/* Camera sits well back with a tight near/far range so depth stays precise and flat layers never flicker. */}
      <Canvas shadows={graphics !== 'saver'} orthographic camera={{ position: [75, 80, 75], zoom: 36, near: 1, far: 320 }} dpr={graphics === 'saver' ? 1 : graphics === 'auto' ? [1, pace.dpr] : [1, 2]} gl={{ toneMapping: NeutralToneMapping }} frameloop={townPaused ? 'never' : 'demand'}
        onCreated={({ gl }) => {
          quietShaders(gl)
          splashProgress(0.9)
          // Let the browser restore the 3D view after it drops the context, instead of leaving it blank.
          gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault())
          gl.domElement.addEventListener('webglcontextrestored', () => location.reload())
        }}
      >
        <World />
        <SplashHandoff />
        <FrameCap fps={graphics === 'saver' ? 30 : graphics === 'auto' ? pace.fps : 60} paused={townPaused} />
        <ShadowSwitch on={graphics !== 'saver'} />
      </Canvas>
      <TechnoLayer />
      <Badges />
      <VisitorBadges />
      <ThoughtBubble />
      <ThumbRenderer />
      <StageCanvas />
      <Preview.StageCanvas />
      <Hud />
      <LiveBanner />
      <BottomBar />
      {panel === 'shop' && <ShopPanel />}
      {panel === 'inventory' && <InventoryPanel />}
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
      {panel === 'carpacks' && <CarPacksPanel />}
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

// Draws the town at most about 60 times a second (30 on battery saver). Left to the screen,
// a 120 or 144 Hz laptop drew it twice as often for no visible gain, and kept its CPU busy.
function FrameCap({ fps, paused }: { fps: number; paused: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (paused) return
    // A little under the gap, so a 60 Hz screen still gets every frame and 144 Hz gets every other.
    const gap = 800 / fps
    let last = -Infinity
    let id = requestAnimationFrame(function step(t) {
      id = requestAnimationFrame(step)
      if (t - last < gap) return
      last = t
      invalidate()
    })
    return () => cancelAnimationFrame(id)
  }, [invalidate, fps, paused])
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
