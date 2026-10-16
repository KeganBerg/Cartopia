import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { friendPicks, insertMention, mentionAt, mergePicks, searchPlayers, splitMentions, idForUsername, type Suggest } from '../lib/mentions'
import { useNames } from '../lib/profiles'
import { openPlayerCard } from '../lib/playerCard'
import './mentions.css'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (text: string) => void
}

// A text box where "@" offers friends first, then any player by username.
export function MentionInput({ value, onChange, onKeyDown, ...rest }: Props) {
  const box = useRef<HTMLInputElement>(null)
  const me = useNames((s) => s.mine?.uid)
  const [at, setAt] = useState<{ start: number; query: string } | null>(null)
  const [players, setPlayers] = useState<Suggest[]>([])
  const [hi, setHi] = useState(0)

  const look = () => {
    const el = box.current
    setAt(el && document.activeElement === el ? mentionAt(el.value, el.selectionStart ?? el.value.length) : null)
  }

  const query = at?.query ?? null
  useEffect(() => {
    setHi(0)
    if (query === null || query.length < 2) return setPlayers([])
    let live = true
    const t = setTimeout(() => void searchPlayers(query, me).then((r) => live && setPlayers(r)), 200)
    return () => { live = false; clearTimeout(t) }
  }, [query, me])

  const picks = at ? mergePicks(friendPicks(at.query, me), players) : []
  const open = picks.length > 0

  const choose = (p: Suggest) => {
    const el = box.current
    if (!el || !at) return
    const r = insertMention(el.value, at.start, el.selectionStart ?? el.value.length, p.username)
    onChange(r.text)
    setAt(null)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(r.caret, r.caret)
    })
  }

  return (
    <span className="mention-box">
      {open && (
        <div className="mention-list" role="listbox" aria-label="Players">
          {picks.map((p, i) => (
            <button key={p.id} type="button" role="option" aria-selected={i === hi} className={i === hi ? 'sel' : ''}
              // Keep the keyboard up on phones: choose before the box loses focus.
              onPointerDown={(e) => { e.preventDefault(); choose(p) }}
              onClick={(e) => e.detail === 0 && choose(p)}>
              <b>@{p.username}</b>
              {p.friend && <span className="mention-friend" title="Friend">👥</span>}
              {p.level !== undefined && <small>Lv {p.level}</small>}
            </button>
          ))}
        </div>
      )}
      <input
        {...rest}
        ref={box}
        value={value}
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); requestAnimationFrame(look) }}
        onSelect={look}
        onFocus={look}
        onBlur={() => setAt(null)}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              const n = picks.length
              return setHi((h) => (h + (e.key === 'ArrowDown' ? 1 : n - 1)) % n)
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault()
              return choose(picks[Math.min(hi, picks.length - 1)])
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              return setAt(null)
            }
          }
          onKeyDown?.(e)
        }}
      />
    </span>
  )
}

// Text with each @username drawn as a tappable name that opens that player's profile.
export function MentionText({ text, me }: { text: string; me?: string | null }) {
  const parts = splitMentions(text)
  if (parts.length === 1 && typeof parts[0] === 'string') return <>{text}</>
  return (
    <>
      {parts.map((p, i) => typeof p === 'string' ? p : (
        <button key={i} type="button" className={`mention${me && p.name.toLowerCase() === me.toLowerCase() ? ' you' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            void idForUsername(p.name).then((id) => id && openPlayerCard(id, `@${p.name}`))
          }}>
          @{p.name}
        </button>
      ))}
    </>
  )
}
