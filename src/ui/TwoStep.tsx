import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { checkCode, cleanCode, startSetup, turnOff, twoStepState, type Setup, type TwoStep } from '../lib/twoStep'
import { Group } from './Settings'
import { sfx } from '../lib/sound'

function CodeInput({ value, onChange, onDone }: { value: string; onChange: (v: string) => void; onDone: () => void }) {
  return (
    <input
      className="ts-code"
      value={value}
      inputMode="numeric"
      autoComplete="one-time-code"
      enterKeyHint="done"
      maxLength={7}
      placeholder="123456"
      aria-label="6-digit code"
      onChange={(e) => onChange(cleanCode(e.target.value))}
      onKeyDown={(e) => { if (e.key === 'Enter') onDone() }}
    />
  )
}

// Signed in with the password only, on an account with two-step on: ask for the code
// before showing the account. Sign out is the way back. Otherwise children get the
// two-step card to place in the account.
export function TwoStepGate({ uid, children }: { uid: string; children: (card: React.ReactNode) => React.ReactNode }) {
  const [state, setState] = useState<TwoStep | null>(null)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    twoStepState().then((s) => live && setState(s), () => live && setState({ factorId: null, needCode: false }))
    return () => { live = false }
  }, [uid])
  if (!state) return null
  if (!state.needCode || !state.factorId) return <>{children(<TwoStepCard state={state} onChange={setState} />)}</>
  const go = async () => {
    if (busy) return
    setBusy(true)
    const err = await checkCode(state.factorId!, code)
    setBusy(false)
    if (err) { sfx.error(); setMsg(err); setCode(''); return }
    sfx.unlock()
    setState({ ...state, needCode: false })
  }
  return (
    <Group icon="🔐" title="Two-step code">
      <div className="ts-ask">
        <span className="ts-big" aria-hidden>📱</span>
        <CodeInput value={code} onChange={setCode} onDone={go} />
        <button className="buy" disabled={busy || code.length !== 6} onClick={go}>Unlock</button>
        {msg && <p className="ts-msg">{msg}</p>}
        <button className="sell small" onClick={() => supabase!.auth.signOut()}>Sign out</button>
      </div>
    </Group>
  )
}

// Turn two-step on (scan, then confirm a code) or off.
function TwoStepCard({ state, onChange }: { state: TwoStep; onChange: (s: TwoStep) => void }) {
  const [setup, setSetup] = useState<Setup | null>(null)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [sure, setSure] = useState(false)

  const begin = async () => {
    setBusy(true); setMsg('')
    const s = await startSetup()
    setBusy(false)
    if (typeof s === 'string') return setMsg(s)
    setSetup(s); setCode('')
  }
  const confirm = async () => {
    if (!setup || busy) return
    setBusy(true)
    const err = await checkCode(setup.factorId, code)
    setBusy(false)
    if (err) { sfx.error(); setMsg(err); setCode(''); return }
    sfx.unlock()
    setSetup(null); setMsg('')
    onChange({ factorId: setup.factorId, needCode: false })
  }
  const off = async () => {
    if (!state.factorId) return
    if (!sure) return setSure(true)
    setBusy(true)
    const err = await turnOff(state.factorId)
    setBusy(false); setSure(false)
    if (err) return setMsg(err)
    onChange({ factorId: null, needCode: false })
  }

  return (
    <Group icon="🔐" title="Two-step sign-in">
      {!setup ? (
        <div className="set-row">
          <span className="set-label">
            {state.factorId ? '✅ On' : '⭕ Off'}
            <small>📱 Authenticator app code</small>
          </span>
          {state.factorId
            ? <button className={`sell small${sure ? ' sure' : ''}`} disabled={busy} onClick={off}>{sure ? 'Turn off?' : 'Turn off'}</button>
            : <button className="buy small" disabled={busy} onClick={begin}>Turn on</button>}
        </div>
      ) : (
        <div className="ts-setup">
          <img className="ts-qr" src={setup.qr} alt="QR code for your authenticator app" width={168} height={168} />
          <code className="ts-secret" title="Type this into the app if you can't scan">{setup.secret}</code>
          <div className="row">
            <CodeInput value={code} onChange={setCode} onDone={confirm} />
            <button className="buy" disabled={busy || code.length !== 6} onClick={confirm}>Confirm</button>
          </div>
          <button className="sell small" onClick={() => { setSetup(null); setMsg('') }}>Cancel</button>
        </div>
      )}
      {msg && <p className="ts-msg">{msg}</p>}
    </Group>
  )
}
