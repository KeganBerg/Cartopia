import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { CARDS, MESSAGES, cardOf, seePostcards, sendPostcard, usePostcards, type Postcard } from '../lib/postcards'
import { PlayerName } from './Username'

// Postcards (lib/postcards.ts): 💌 on a friend's row opens the picker; cards you've been
// sent show at the top of the gifts inbox.

export function PostcardButton({ to, name }: { to: string; name: string }) {
  const sent = usePostcards((p) => !!p.sent[to])
  const [open, setOpen] = useState(false)
  if (!supabase || to.startsWith('demo-')) return null
  return (
    <>
      <button className="buy small alt" disabled={sent} title={sent ? 'Postcard sent today' : 'Send a postcard'} onClick={() => setOpen(true)}>{sent ? '💌✔' : '💌'}</button>
      {open && <PostcardPicker to={to} name={name} onClose={() => setOpen(false)} />}
    </>
  )
}

function PostcardPicker({ to, name, onClose }: { to: string; name: string; onClose: () => void }) {
  const [card, setCard] = useState<string>(CARDS[0].id)
  const [msg, setMsg] = useState(0)
  const [busy, setBusy] = useState(false)
  const send = async () => {
    setBusy(true)
    await sendPostcard(to, card, msg, name)
    setBusy(false)
    onClose()
  }
  return createPortal(
    <div className="overlay pc-overlay" onClick={onClose}>
      <div className="prize pc-pick" onClick={(e) => e.stopPropagation()}>
        <h3>💌 Postcard to {name}</h3>
        <CardFace card={card} msg={msg} from="You" />
        <div className="pc-cards" role="radiogroup" aria-label="Picture">
          {CARDS.map((c) => (
            <button key={c.id} role="radio" aria-checked={card === c.id} className={card === c.id ? 'sel' : ''} style={{ background: c.bg }} title={c.name} onClick={() => setCard(c.id)}>{c.icon}</button>
          ))}
        </div>
        <div className="pc-msgs" role="radiogroup" aria-label="Message">
          {MESSAGES.map((m, i) => (
            <button key={m} role="radio" aria-checked={msg === i} className={msg === i ? 'sel' : ''} onClick={() => setMsg(i)}>{m}</button>
          ))}
        </div>
        <div className="row">
          <button className="buy alt" onClick={onClose}>Cancel</button>
          <button className="buy" disabled={busy} onClick={() => void send()}>Send</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function CardFace({ card, msg, from }: { card: string; msg: number; from: React.ReactNode }) {
  const c = cardOf(card)
  return (
    <div className="pc-face" style={{ background: c.bg }}>
      <span className="pc-stamp" aria-hidden>{c.icon}</span>
      <b>{MESSAGES[msg] ?? MESSAGES[0]}</b>
      <small>from {from}</small>
    </div>
  )
}

// The cards in the inbox, newest first; opening it marks them seen.
export function PostcardList() {
  const inbox = usePostcards((p) => p.inbox)
  useEffect(() => { if (inbox.length) seePostcards() }, [inbox])
  if (!inbox.length) return null
  return (
    <>
      <h4>💌 Postcards</h4>
      <div className="pc-list">
        {inbox.map((p: Postcard) => <CardFace key={p.id} card={p.card} msg={p.msg} from={<PlayerName id={p.from} town={p.fromName} />} />)}
      </div>
    </>
  )
}

export const unseenPostcards = (inbox: Postcard[], seen: number) => inbox.filter((p) => p.id > seen).length
