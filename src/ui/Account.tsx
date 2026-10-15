import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useGame } from '../game/store'
import { Panel, SheetTabs } from './Menus'
import { localBackup, restoreLocalBackup } from '../lib/cloud'
import { isCleanName, NAME_REJECTED } from '../lib/names'
import { UsernameRow } from './Username'
import { AccountData, Group, GuestData, HelpTab, LegalView, SettingsTab } from './Settings'
import { LEGAL, type LegalDoc } from '../legal/legal'
import { CityLook } from './CityLook'

type MenuTab = 'town' | 'settings' | 'account' | 'help'
const MENU_TABS = [{ id: 'town', label: '🏠 Town' }, { id: 'settings', label: '⚙️ Settings' }, { id: 'account', label: '👤 Account' }, { id: 'help', label: '❓ Help' }] as const
let lastTab: MenuTab = 'town'
// A Terms or Privacy page to open with the Menu (from /terms, /privacy or a sign-up link).
let pendingLegal: LegalDoc['id'] | null = null

export function openLegal(id: LegalDoc['id']) {
  pendingLegal = id
  useGame.getState().openPanel('account')
}

export function AccountPanel() {
  const townName = useGame((s) => s.townName)
  const rename = useGame((s) => s.renameTown)
  const openPanel = useGame((s) => s.openPanel)
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [tab, setTab] = useState<MenuTab>(lastTab)
  const [legal, setLegal] = useState<LegalDoc['id'] | null>(() => {
    const id = pendingLegal
    pendingLegal = null
    return id
  })
  const [name, setName] = useState(townName)
  // Follow the town when sign-in swaps in the cloud save while this menu is open.
  useEffect(() => setName(townName), [townName])
  const updatedAt = useGame((s) => s.updatedAt)
  // Recheck after each save change, e.g. once sign-in has swapped in the cloud town.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const backup = useMemo(() => localBackup(), [updatedAt])

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setUser(data.user))
    const sub = supabase?.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null))
    return () => sub?.data.subscription.unsubscribe()
  }, [])

  const signIn = async (signUp: boolean) => {
    if (!supabase) return
    setMsg('...')
    const { error, data } = signUp
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword({ email, password })
    if (error) return setMsg(friendlyAuthError(error.message, signUp))
    setMsg(signUp && !data.session ? 'Check your email to confirm your account, then sign in.' : 'Signed in. Your town now saves to the cloud.')
  }

  if (legal) return (
    <Panel title={LEGAL[legal].title} onBack={() => setLegal(null)}>
      <LegalView id={legal} />
    </Panel>
  )

  return (
    <Panel title="Menu">
      <SheetTabs items={MENU_TABS} value={tab} onChange={(t) => { lastTab = t; setTab(t) }} />
      {tab === 'town' && <>
      <button className="buy bank-menu-btn" onClick={() => openPanel('bank')}>🏦 Bank · get gems</button>
      <h3 className="cl-head">🏙️ Town name</h3>
      <div className="row tn-row">
        <input value={name} maxLength={24} aria-label="Town name" onChange={(e) => setName(e.target.value)} />
        <button className="buy" disabled={!name.trim() || name === townName} onClick={() => (isCleanName(name) ? rename(name) : useGame.getState().toast(NAME_REJECTED))}>Save</button>
      </div>
      <CityLook />
      </>}
      {tab === 'settings' && <SettingsTab user={user} />}
      {tab === 'account' && <>
      {!supabase ? (
        <>
          <p className="hint">Offline mode: progress saves in this browser only.</p>
          <GuestData />
        </>
      ) : user ? (
        <>
          <Group icon="☁️" title="Cloud save">
            <div className="set-row">
              <span className="set-label">{user.email}<small>Your town saves to the cloud</small></span>
              <button className="sell small" onClick={() => supabase!.auth.signOut()}>Sign out</button>
            </div>
          </Group>
          <UsernameRow />
          {backup && (
            <>
              <p className="hint">This device has an older town that is further along: {backup.townName}, level {backup.level}, {backup.cars.length} cars.</p>
              <button className="buy" onClick={restoreLocalBackup}>Restore town from this device</button>
            </>
          )}
          <AccountData user={user} />
        </>
      ) : (
        <>
          <p className="hint">Sign in to save your town online and race real players.</p>
          <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="row">
            <button className="buy" onClick={() => signIn(false)}>Sign in</button>
            <button className="buy alt" onClick={() => signIn(true)}>Create account</button>
          </div>
          <p className="hint agree">By creating an account you agree to the <button className="link" onClick={() => setLegal('terms')}>Terms</button> and <button className="link" onClick={() => setLegal('privacy')}>Privacy Policy</button>.</p>
          <GuestData />
        </>
      )}
      {msg && <p className="hint">{msg}</p>}
      </>}
      {tab === 'help' && <HelpTab openLegal={setLegal} />}
    </Panel>
  )
}

function friendlyAuthError(message: string, signUp: boolean): string {
  const m = message.toLowerCase()
  if (m.includes('rate limit') || m.includes('too many'))
    return signUp
      ? 'Too many new accounts were made in the last hour. Try again a bit later, or tap Sign in if you already made one. Your town is still saved in this browser.'
      : 'Too many tries in a row. Wait a minute and try again.'
  if (m.includes('email not confirmed')) return 'Your email is not confirmed yet. Open the link we emailed you, then sign in.'
  if (m.includes('invalid login')) return 'That email and password do not match. Check them, or tap Create account if you are new.'
  if (m.includes('already registered')) return 'That email already has an account. Tap Sign in instead.'
  if (m.includes('password')) return 'Passwords need at least 6 characters.'
  if (m.includes('email')) return 'Please enter a valid email address.'
  return message
}

