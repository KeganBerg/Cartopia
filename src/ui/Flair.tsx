import { useEffect } from 'react'
import { useGame } from '../game/store'
import { CHEERS, TRAILS, flairOpen, flairOpenCount, flairProgress, myCheer, myTrail, type FlairChallenge } from '../game/flair'

// Flair screen (game/flair.ts): the boost trails and win celebrations, each a tile. Open ones
// are picked with a tap; locked ones show their challenge's progress (the full text on hover).

// The challenge as a short chip: its icon and progress.
const need = (c: FlairChallenge, have: number) => `${c.icon} ${have.toLocaleString()}/${c.goal.toLocaleString()}`

export function Flair() {
  const trophies = useGame((g) => g.trophies)
  const stats = useGame((g) => g.stats)
  const cups = useGame((g) => g.cups)
  const mastery = useGame((g) => g.mastery)
  const picked = { trail: useGame((g) => g.trail), cheer: useGame((g) => g.cheer) }
  const s = { trophies, stats, cups, mastery, ...picked }
  const pick = useGame((g) => g.pickFlair)
  const see = useGame((g) => g.seeFlair)
  // Everything open is seen once this screen shows (clears the Race menu's dot).
  useEffect(() => see(), [see])
  const trail = myTrail(s).id
  const cheer = myCheer(s).id
  return (
    <div className="fl-flair">
      <h4>🔥 Boost trail</h4>
      <div className="fl-grid" role="listbox" aria-label="Boost trail">
        {TRAILS.map((t) => {
          const open = flairOpen(t.challenge, s)
          return (
            <button key={t.id} role="option" aria-selected={t.id === trail} disabled={!open} title={t.challenge ? `${t.name}: ${t.challenge.text}` : t.name}
              className={`fl-tile${t.id === trail ? ' sel' : ''}${open ? '' : ' locked'}`} onClick={() => pick('trail', t.id)}>
              <i className="fl-trail" style={{ background: `linear-gradient(90deg, ${t.look.tail}00, ${t.look.tail}, ${t.look.head})` }} aria-hidden />
              <b>{t.name}</b>
              <small>{t.id === trail ? '✔' : open ? '' : need(t.challenge!, flairProgress(t.challenge, s))}</small>
            </button>
          )
        })}
      </div>
      <h4>🎉 Win celebration</h4>
      <div className="fl-grid" role="listbox" aria-label="Win celebration">
        {CHEERS.map((c) => {
          const open = flairOpen(c.challenge, s)
          return (
            <button key={c.id} role="option" aria-selected={c.id === cheer} disabled={!open} title={c.challenge ? `${c.name}: ${c.challenge.text}` : c.name}
              className={`fl-tile${c.id === cheer ? ' sel' : ''}${open ? '' : ' locked'}`} onClick={() => pick('cheer', c.id)}>
              <i className="fl-cheer" aria-hidden>{c.icon}</i>
              <b>{c.name}</b>
              <small>{c.id === cheer ? '✔' : open ? '' : need(c.challenge!, flairProgress(c.challenge, s))}</small>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Trails and celebrations opened since the Flair screen was last seen, for the Race menu's dot.
export const flairNew = (s: Parameters<typeof flairOpenCount>[0] & { flairSeen?: number }) => Math.max(0, flairOpenCount(s) - (s.flairSeen ?? 2))
export const flairChip = (s: Parameters<typeof flairOpenCount>[0]) => `✨ ${flairOpenCount(s)}/${TRAILS.length + CHEERS.length}`
