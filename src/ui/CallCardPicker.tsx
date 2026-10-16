import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGame } from '../game/store'
import { CALL_CARDS, STOCK_CARD, TIER_ICON, TIER_NAME, callCardDef, ownedCallCards } from '../game/callCards'
import { CallCardArt, CallCardShowcase, callCardTier } from './CallCard'
import './flash.css'
import './confirm.css'

// Call Cards: your race car on the card you picked, big, then every card as a small still swatch.
// Owned cards equip with one tap of the button; the rest show their tier and a lock (they drop from
// crates). Self-contained, so any menu can host it (the Quick Race popup below, the Cars page).
export function CallCardPicker({ onCrates }: { onCrates?: () => void }) {
  const callCards = useGame((s) => s.callCards)
  const worn = useGame((s) => s.callCard) ?? STOCK_CARD
  const equip = useGame((s) => s.equipCallCard)
  const owned = ownedCallCards({ callCards })
  const [pick, setPick] = useState(worn)
  const d = callCardDef(pick)!
  const mine = owned.includes(pick)
  return (
    <div className="ccp">
      <div className="ccp-hero">
        <CallCardShowcase id={pick} className="ccp-big" />
        <div className="ccp-name">
          <b>{d.name}</b>
          {d.tier && <span className={`ccp-tier t-${d.tier}`} title={`${TIER_NAME[d.tier]} Call Card`}>{TIER_ICON[d.tier]} {TIER_NAME[d.tier]}</span>}
        </div>
        {pick === worn ? (
          <button className="buy small" disabled>✔ On</button>
        ) : mine ? (
          <button className="buy small" onClick={() => equip(pick)}>Equip</button>
        ) : (
          <button className="buy small premium" onClick={onCrates} title="Call Cards drop from crates">🔒 📦 Crates</button>
        )}
      </div>
      <div className="ccp-count" title="Call Cards owned">🃏 {owned.length}/{CALL_CARDS.length}</div>
      <div className="ccp-grid" role="listbox" aria-label="Call Cards">
        {CALL_CARDS.map((c) => {
          const have = owned.includes(c.id)
          return (
            <button key={c.id} role="option" aria-selected={pick === c.id} className={`ccp-opt${callCardTier(c.id)}${pick === c.id ? ' sel' : ''}${have ? '' : ' locked'}`}
              title={`${c.name}${c.tier ? ` · ${TIER_NAME[c.tier]}` : ''}${have ? '' : ' · from crates'}`} onClick={() => setPick(c.id)}>
              <CallCardArt id={c.id} still />
              <span className="ccp-mark" aria-hidden>{c.id === worn ? '✔' : have ? '' : '🔒'}</span>
              <small>{c.name}</small>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// The picker as a popup (Quick Race's "your card" button).
export function CallCardPopup({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [onClose])
  const crates = () => { onClose(); useGame.getState().openPanel('crates') }
  return createPortal(
    <div className="flash-warn ccp-modal" role="dialog" aria-modal="true" aria-labelledby="ccp-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fw-card">
        <div className="fw-head"><span className="fw-bolt" aria-hidden>🃏</span><h2 id="ccp-title">Call Card</h2><button className="ccp-x" onClick={onClose} aria-label="Close">✕</button></div>
        <CallCardPicker onCrates={crates} />
      </div>
    </div>,
    document.body,
  )
}
