import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useGame } from '../game/store'
import { Panel, SheetTabs } from './Menus'
import { AmbienceControl, MuteButton } from './MuteButton'
import { AlertsMenu } from './Alerts'
import { localBackup, restoreLocalBackup } from '../lib/cloud'
import { isCleanName, NAME_REJECTED } from '../lib/names'

type MenuTab = 'town' | 'account' | 'help'
const MENU_TABS = [{ id: 'town', label: '🏠 Town' }, { id: 'account', label: '👤 Account' }, { id: 'help', label: '❓ How to play' }] as const
let lastTab: MenuTab = 'town'

export function AccountPanel() {
  const townName = useGame((s) => s.townName)
  const rename = useGame((s) => s.renameTown)
  const openPanel = useGame((s) => s.openPanel)
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [tab, setTab] = useState<MenuTab>(lastTab)
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
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    if (error) return setMsg(friendlyAuthError(error.message, signUp))
    setMsg(signUp && !data.session ? 'Check your email to confirm your account, then sign in.' : 'Signed in. Your town now saves to the cloud.')
  }

  return (
    <Panel title="Menu">
      <SheetTabs items={MENU_TABS} value={tab} onChange={(t) => { lastTab = t; setTab(t) }} />
      {tab === 'town' && <>
      <button className="buy bank-menu-btn" onClick={() => openPanel('bank')}>🏦 Bank · get bucks</button>
      <div className="menu-sound"><span>Sound</span><MuteButton /></div>
      <AmbienceControl />
      <AlertsMenu />
      <h3>Town name</h3>
      <div className="row">
        <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
        <button className="buy small" onClick={() => (isCleanName(name) ? rename(name) : useGame.getState().toast(NAME_REJECTED))}>Save</button>
      </div>
      </>}
      {tab === 'account' && <>
      {!supabase ? (
        <p className="hint">Offline mode: progress saves in this browser only.</p>
      ) : user ? (
        <>
          <p>Signed in as <b>{user.email}</b>. Your town saves to the cloud and other players can race your best car.</p>
          {backup && (
            <>
              <p className="hint">This device has an older town that is further along: {backup.townName}, level {backup.level}, {backup.cars.length} cars.</p>
              <button className="buy" onClick={restoreLocalBackup}>Restore town from this device</button>
            </>
          )}
          <button className="sell" onClick={() => supabase!.auth.signOut()}>Sign out</button>
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
        </>
      )}
      {msg && <p className="hint">{msg}</p>}
      </>}
      {tab === 'help' && <ul className="howto">
        <li>Tap a business to send a car on a job. It costs fuel; fuel refills 1 per minute.</li>
        <li>When the coin bubble pops up, tap it to collect coins and XP.</li>
        <li>Buy cars in the Showroom. Every car you own drives around your roads.</li>
        <li>Build Rusty's Rescue first. Tap it to search for old cars, tow them home and restore them. Some classics can only be rescued.</li>
        <li>Upgrade cars in the Garage with coins and parts (⚙). Tire Shops, Parts Depots and Tuner Shops make parts, and Rusty's searches find some too.</li>
        <li>Short on anything? Tap the coins, parts or fuel counters at the top to see how to get more.</li>
        <li>Race rivals for coins and trophies. Shift in the green zone.</li>
        <li>Level up to unlock new businesses and cars. Gas Stations raise your fuel cap.</li>
      </ul>}
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

