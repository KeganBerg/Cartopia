import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useGame } from '../game/store'
import { Panel } from './Menus'

export function AccountPanel() {
  const townName = useGame((s) => s.townName)
  const rename = useGame((s) => s.renameTown)
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [name, setName] = useState(townName)

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
    if (error) return setMsg(error.message)
    setMsg(signUp && !data.session ? 'Check your email to confirm your account, then sign in.' : 'Signed in. Your town now saves to the cloud.')
  }

  return (
    <Panel title="Menu">
      <h3>Town name</h3>
      <div className="row">
        <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
        <button className="buy small" onClick={() => rename(name)}>Save</button>
      </div>
      <h3>Account</h3>
      {!supabase ? (
        <p className="hint">Offline mode: progress saves in this browser only.</p>
      ) : user ? (
        <>
          <p>Signed in as <b>{user.email}</b>. Your town saves to the cloud and other players can race your best car.</p>
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
      <h3>How to play</h3>
      <ul className="howto">
        <li>Tap a business to send a car on a job. It costs fuel; fuel refills 1 per minute.</li>
        <li>When the coin bubble pops up, tap it to collect coins and XP.</li>
        <li>Buy cars in the Showroom. Every car you own drives around your roads.</li>
        <li>Upgrade cars in the Garage with coins and parts (Tire Shops and Parts Depots make parts).</li>
        <li>Race rivals for coins and trophies. Shift in the green zone.</li>
        <li>Level up to unlock new businesses and cars. Gas Stations raise your fuel cap.</li>
      </ul>
    </Panel>
  )
}
