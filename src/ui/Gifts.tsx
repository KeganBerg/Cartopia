import { Icon } from './Icon'
import { useEffect, useState } from 'react'
import { useGame, hasRusty } from '../game/store'
import { supabase } from '../lib/supabase'
import { signedInUser } from '../lib/cloud'
import { useGifts, refreshGifts, claimGifts, sendGift, noteTotals, GIFTS, type GiftItem, type Note } from '../lib/gifts'
import { Panel } from './Menus'
import { PlayerName } from './Username'

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
      s.openPanel('gifts')
    }, 1000)
    return () => clearInterval(id)
  }, [count])
  return null
}

export function GiftBell() {
  const count = useGifts((g) => g.inbox.length)
  const visiting = useGame((s) => !!s.visiting)
  const openPanel = useGame((s) => s.openPanel)
  if (!count || visiting) return null
  return (
    <button className="challenge-bell gift-bell has" onClick={() => openPanel('gifts')} title="Friends helped you">
      <Icon name="gift" /><span className="bell-count">{count}</span>
    </button>
  )
}

function noteText(n: Note) {
  return n.kind === 'help' ? 'helped your town' : `sent you ${GIFTS[n.kind].label}`
}

export function GiftsPanel() {
  const inbox = useGifts((g) => g.inbox)
  const [busy, setBusy] = useState(false)
  const openPanel = useGame((s) => s.openPanel)
  const t = noteTotals(inbox)
  const collect = async () => {
    if (busy) return
    setBusy(true)
    try {
      await claimGifts()
    } finally {
      setBusy(false)
    }
    if (!useGifts.getState().inbox.length) openPanel(null)
  }
  return (
    <Panel title="Friends helped you!">
      {inbox.length === 0 ? (
        <p className="hint" title="Friend helps and gifts show up here">🎁 Nothing waiting</p>
      ) : (
        <>
          <div className="cards rows gift-list">
            {inbox.map((n) => (
              <div key={n.id} className="card gift-note">
                <div className="welcome-ico" aria-hidden>{n.kind === 'help' ? '🤝' : '🎁'}</div>
                <div className="card-text">
                  <div className="card-name"><PlayerName id={n.from} town={n.fromName} /></div>
                  <div className="card-stat">{noteText(n)}</div>
                </div>
                {/* The server pays waiting notes together, so any amount collects them all. */}
                <button className="buy small gift-take" disabled={busy} onClick={collect}>+{n.amount} {n.kind === 'parts' ? '⚙' : '⛽'}</button>
              </div>
            ))}
          </div>
          <div className="welcome-actions">
            <button className="buy welcome-collect" disabled={busy} onClick={collect}>
              {busy ? 'Collecting…' : <>Collect{t.fuel ? ` +${t.fuel} ⛽` : ''}{t.parts ? ` +${t.parts} ⚙` : ''}</>}
            </button>
          </div>
        </>
      )}
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
