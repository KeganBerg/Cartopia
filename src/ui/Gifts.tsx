import { Icon } from './Icon'
import { useEffect, useMemo, useRef, useState } from 'react'
import { sfx } from '../lib/sound'
import { useGame, hasRusty } from '../game/store'
import { supabase } from '../lib/supabase'
import { signedInUser } from '../lib/cloud'
import { useGifts, refreshGifts, claimGifts, sendGift, noteTotals, GIFTS, type GiftItem, type Note } from '../lib/gifts'
import { Panel } from './Menus'
import { PlayerName } from './Username'
import { usePlayerName } from '../lib/profiles'
import { cardOf, refreshPostcards, seePostcards, usePostcards, type Postcard } from '../lib/postcards'
import { CardFace, unseenPostcards } from './Postcards'
import { StageSlot } from '../scene/Stage'
import { MailScene, type Parcel } from '../scene/MailScene'
import { flyFrom } from './Fly'
import './mail.css'

const REFRESH_MS = 120_000

// Loads the inbox once sign-in sync is done, then now and then, and pops it open once
// when friends left something and nothing else is on screen.
export function GiftWatcher() {
  const count = useGifts((g) => g.inbox.length)
  useEffect(() => {
    if (!supabase) return
    let ready = false
    const tick = () => {
      if (!signedInUser()) return
      ready = true
      refreshGifts().catch(() => {})
      refreshPostcards().catch(() => {})
    }
    // Sign-in sync finishes a moment after load; check until it has.
    const wait = setInterval(() => !ready && tick(), 2000)
    const slow = setInterval(tick, REFRESH_MS)
    const onVis = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(wait)
      clearInterval(slow)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])
  useEffect(() => {
    if (!count) return
    const id = setInterval(() => {
      const s = useGame.getState()
      if (useGifts.getState().shown) return clearInterval(id)
      // Waits for the welcome-back and daily bonus screens, a level-up, a visit or the tutorial.
      if (s.panel || s.levelUp || s.visiting || s.mode !== 'play' || !hasRusty(s)) return
      useGifts.setState({ shown: true })
      sfx.notify()
      s.openPanel('gifts')
    }, 1000)
    return () => clearInterval(id)
  }, [count])
  return null
}

export function GiftBell() {
  const cards = usePostcards((p) => unseenPostcards(p.inbox, p.seen))
  const count = useGifts((g) => g.inbox.length) + cards
  const visiting = useGame((s) => !!s.visiting)
  const openPanel = useGame((s) => s.openPanel)
  if (!count || visiting) return null
  return (
    <button className="challenge-bell gift-bell has" onClick={() => openPanel('gifts')} title="Friends helped you">
      <Icon name="gift" /><span className="bell-count">{count}</span>
    </button>
  )
}

const MAIL_CAM = { position: [1.2, 2.2, 4.5] as [number, number, number], fov: 40, near: 0.1, far: 60, shadows: true }
const ICON = { help: '🤝', fuel: '⛽', parts: '⚙' } as const
// A flat colour per friend, from their id, for the badge behind their initial.
const TONES = ['#2f7ff0', '#e53935', '#43a047', '#8e44ad', '#ff8f00', '#00897b', '#d81b60']
const tone = (id: string) => TONES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length]
const firstHex = (bg: string) => bg.match(/#[0-9a-f]{6}/i)?.[0] ?? '#ffb36b'

function Friend({ n }: { n: Note }) {
  const name = usePlayerName(n.from, n.fromName)
  return (
    <div className="mail-friend">
      <span className="mail-face" style={{ background: tone(n.from) }} aria-hidden>
        {name.replace(/^@/, '').charAt(0).toUpperCase()}
        <i>{ICON[n.kind]}</i>
      </span>
      <b>{name}</b>
      <em>+{n.amount} {n.kind === 'parts' ? '⚙' : '⛽'}</em>
    </div>
  )
}

// Friends' visits, gifts and postcards, on a doorstep (scene/MailScene.tsx): one parcel for
// each, the postcards in the mailbox. The button collects what the server pays today.
export function GiftsPanel() {
  const inbox = useGifts((g) => g.inbox)
  const cards = usePostcards((p) => p.inbox)
  const [busy, setBusy] = useState(false)
  const openPanel = useGame((s) => s.openPanel)
  const take = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (cards.length) seePostcards() }, [cards])
  const t = noteTotals(inbox)
  const parcels = useMemo(() => inbox.map((n) => n.kind as Parcel), [inbox])
  const colors = useMemo(() => cards.map((c) => firstHex(cardOf(c.card).bg)), [cards])
  const scene = useMemo(() => <MailScene parcels={parcels} cards={colors} />, [parcels, colors])
  const collect = async () => {
    if (busy) return
    setBusy(true)
    const parts = t.parts
    try {
      await claimGifts()
    } finally {
      setBusy(false)
    }
    sfx.reward()
    if (parts) flyFrom(take.current, { parts })
    if (!useGifts.getState().inbox.length) openPanel(null)
  }
  return (
    <Panel title="Friends helped you!" className="mail-panel">
      <div className="mail-stage">
        <StageSlot cam={MAIL_CAM}>{scene}</StageSlot>
        {(t.fuel > 0 || t.parts > 0) && (
          <div className="mail-totals">
            {t.fuel > 0 && <span className="mail-total fuel">⛽ +{t.fuel}</span>}
            {t.parts > 0 && <span className="mail-total parts">⚙ +{t.parts}</span>}
          </div>
        )}
      </div>
      {inbox.length > 0 && <div className="mail-friends">{inbox.map((n) => <Friend key={n.id} n={n} />)}</div>}
      {cards.length > 0 && (
        <div className="mail-cards">
          {cards.map((p: Postcard) => <CardFace key={p.id} card={p.card} msg={p.msg} from={<PlayerName id={p.from} town={p.fromName} />} />)}
        </div>
      )}
      {inbox.length > 0
        ? <button ref={take} className="buy mail-go" disabled={busy} onClick={collect}>{busy ? 'Collecting…' : <>🎁 Collect</>}</button>
        : <button className="buy alt mail-go" onClick={() => openPanel(null)}>👍 Nice</button>}
    </Panel>
  )
}

// Today's gift for one friend: tap 🎁, then pick fuel or parts.
export function GiftButton({ to }: { to: string }) {
  const sent = useGifts((g) => !!g.sent[to])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!supabase || to.startsWith('demo-')) return null
  if (sent) return <button className="buy small alt gift-btn" disabled title="Gift sent today">🎁✔</button>
  const send = async (item: GiftItem) => {
    setBusy(true)
    await sendGift(to, item)
    setBusy(false)
    setOpen(false)
  }
  if (!open) return <button className="buy small alt gift-btn" title="Send a gift" onClick={() => setOpen(true)}>🎁</button>
  return (
    <span className="gift-pick">
      {(Object.keys(GIFTS) as GiftItem[]).map((k) => (
        <button key={k} className="buy small gift-btn" disabled={busy} onClick={() => send(k)} title={`Send ${GIFTS[k].amount} ${GIFTS[k].label}`}>
          {GIFTS[k].icon}{GIFTS[k].amount}
        </button>
      ))}
    </span>
  )
}
