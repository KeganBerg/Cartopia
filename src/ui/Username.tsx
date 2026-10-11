import { useEffect, useState } from 'react'
import { useGame, hasRusty } from '../game/store'
import { supabase } from '../lib/supabase'
import { Panel } from './Menus'
import { useUserId } from './Social'
import {
  useNames, usePlayerName, loadMyProfile, saveUsername, isUsernameFree, usernameProblem, daysUntilChange,
  USERNAME_MAX, USERNAME_CHANGE_DAYS,
} from '../lib/profiles'
import { refreshFriends } from '../lib/friendsList'

const askedKey = (uid: string) => `cartopia-username-asked-${uid}`
const asked = (uid: string) => {
  try {
    return localStorage.getItem(askedKey(uid)) === '1'
  } catch {
    return false
  }
}
const markAsked = (uid: string) => {
  try {
    localStorage.setItem(askedKey(uid), '1')
  } catch {
    // Private mode: we may ask again next visit.
  }
}

// Type a username, see if it's free, save it.
export function UsernameForm({ initial = '', onDone, cta = 'Save' }: { initial?: string; onDone?: () => void; cta?: string }) {
  const [name, setName] = useState(initial)
  const [free, setFree] = useState<boolean | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const problem = name.trim() && name.trim() !== initial ? usernameProblem(name) : null

  useEffect(() => {
    if (!name.trim() || name.trim() === initial || usernameProblem(name)) return
    let live = true
    const t = setTimeout(() => isUsernameFree(name).then((f) => live && setFree(f)), 350)
    return () => { live = false; clearTimeout(t) }
  }, [name, initial])

  const save = async () => {
    setBusy(true)
    const err = await saveUsername(name)
    setBusy(false)
    if (err) return setMsg(err)
    useGame.getState().toast(`You're @${name.trim()}!`)
    onDone?.()
  }

  const note = msg || problem || (free === false ? 'Someone already has that name' : free ? '✓ Available' : '')
  return (
    <div className="uname-form">
      <div className="uname-input">
        <span>@</span>
        <input
          value={name}
          maxLength={USERNAME_MAX}
          placeholder="username"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => { setName(e.target.value.replace(/\s/g, '')); setFree(null); setMsg('') }}
          onKeyDown={(e) => e.key === 'Enter' && !problem && free !== false && name.trim() && void save()}
        />
        <button className="buy small" disabled={busy || !name.trim() || name.trim() === initial || !!problem || free === false} onClick={save}>{cta}</button>
      </div>
      {note && <small className={`uname-note${free && !msg && !problem ? ' ok' : ''}`}>{note}</small>}
    </div>
  )
}

// The username line in the Menu's Account tab.
export function UsernameRow() {
  const mine = useNames((s) => s.mine)
  const [editing, setEditing] = useState(false)
  if (!mine) return null
  const wait = daysUntilChange(mine.changedAt)
  if (!mine.username || editing) {
    return (
      <div className="uname-row">
        <h3>Username</h3>
        <UsernameForm initial={mine.username ?? ''} onDone={() => setEditing(false)} />
        <small className="hint">Friends find you by it. You can change it once every {USERNAME_CHANGE_DAYS} days.</small>
      </div>
    )
  }
  return (
    <div className="uname-row">
      <h3>Username</h3>
      <div className="row uname-show">
        <b>@{mine.username}</b>
        {wait > 0
          ? <small className="hint">Change in {wait}d</small>
          : <button className="buy small alt" onClick={() => setEditing(true)}>Change</button>}
      </div>
    </div>
  )
}

// Loads your username and friends when you sign in, and asks once for a username if you have none.
export function UsernameWatcher() {
  const uid = useUserId()
  const mine = useNames((s) => s.mine)
  const panel = useGame((s) => s.panel)
  const ready = useGame((s) => !s.visiting && !s.levelUp && s.mode === 'play' && hasRusty(s))
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (uid === undefined) return
    void loadMyProfile(uid)
    if (uid) void refreshFriends()
  }, [uid])

  // Friend requests arrive while you play: check now and then.
  useEffect(() => {
    if (!uid) return
    const id = setInterval(() => document.visibilityState === 'visible' && void refreshFriends(), 120000)
    return () => clearInterval(id)
  }, [uid])

  useEffect(() => {
    if (!supabase || !mine || mine.username || asked(mine.uid) || panel || !ready) return
    const t = setTimeout(() => setOpen(true), 1500)
    return () => clearTimeout(t)
  }, [mine, panel, ready])

  if (!open || !mine || mine.username || panel) return null
  const close = () => { markAsked(mine.uid); setOpen(false) }
  return (
    <Panel title="Pick a username" onClose={close}>
      <div className="uname-prompt">
        <span className="uname-badge">🪪</span>
        <p>Your town name stays the same. Your username is how friends find and add you.</p>
        <UsernameForm cta="Claim" onDone={close} />
        <button className="link" onClick={close}>Later</button>
      </div>
    </Panel>
  )
}

// Another player's name as text: "@username" once they have one, else their town name.
export function PlayerName({ id, town }: { id: string | null | undefined; town: string }) {
  return <>{usePlayerName(id, town)}</>
}
