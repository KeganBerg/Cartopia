import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useGame } from '../game/store'
import { AmbienceControl, EffectsControl, MusicControl, SoundControl } from './MuteButton'
import { AlertsMenu } from './Alerts'
import { useLive, setClosed, unmute } from '../lib/live'
import { setPrefs, usePrefs, reduceMotionOn, type Graphics, type Steer } from '../lib/prefs'
import { deleteAccount, exportData } from '../lib/cloud'
import { useNames } from '../lib/profiles'
import { LEGAL, DRAFT_NOTE, type LegalDoc } from '../legal/legal'
import { setCalmFlashing, useCalmFlashing } from '../game/flashing'
import { showFlashWarning } from './FlashWarning'
import { useTouchDevice } from './DriveControls'

// Contact address for the Help tab. Empty hides the row until the owner sets one.
export const SUPPORT_EMAIL = ''

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={on ? 'switch on' : 'switch'} onClick={() => onChange(!on)}>
      <i />
    </button>
  )
}

// A titled card of settings rows.
export function Group({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className="set-group">
      <h3 className="set-head"><span className="set-ico" aria-hidden>{icon}</span>{title}</h3>
      {children}
    </section>
  )
}

function Row({ label, sub, children }: { label: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="set-row">
      <span className="set-label">{label}{sub && <small>{sub}</small>}</span>
      {children}
    </div>
  )
}

const GRAPHICS: { id: Graphics; label: string; sub: string }[] = [
  { id: 'auto', label: 'Auto', sub: 'Picks the best look your device can keep smooth.' },
  { id: 'high', label: 'High', sub: 'Full glow, sharpest picture. Uses more battery.' },
  { id: 'saver', label: 'Saver', sub: 'No shadows or glow. Cooler phone, longer battery.' },
]

const STEER: { id: Steer; label: string }[] = [
  { id: 'smooth', label: '🌊 Smooth' },
  { id: 'sharp', label: '⚡ Sharp' },
]

export function SettingsTab({ user }: { user: User | null }) {
  const prefs = usePrefs()
  const touch = useTouchDevice()
  const motion = prefs.reduceMotion ?? reduceMotionOn()
  // Reduce flashing's logic lives in game/flashing.ts (the photosensitivity work).
  const calmFlash = useCalmFlashing()
  return (
    <>
      <Group icon="🔊" title="Sound">
        <SoundControl />
        <MusicControl />
        <EffectsControl />
        <AmbienceControl />
      </Group>
      <Group icon="✨" title="Graphics">
        <div className="seg set-seg" role="radiogroup" aria-label="Graphics quality">
          {GRAPHICS.map((g) => (
            <button key={g.id} role="radio" aria-checked={prefs.graphics === g.id} className={prefs.graphics === g.id ? 'sel' : ''} onClick={() => setPrefs({ graphics: g.id })}>{g.label}</button>
          ))}
        </div>
        <small className="set-note">{GRAPHICS.find((g) => g.id === prefs.graphics)!.sub}</small>
      </Group>
      {touch && (
        <Group icon="🏎️" title="Kart steering">
          <div className="seg set-seg" role="radiogroup" aria-label="Kart steering">
            {STEER.map((g) => (
              <button key={g.id} role="radio" aria-checked={prefs.steer === g.id} className={prefs.steer === g.id ? 'sel' : ''} onClick={() => setPrefs({ steer: g.id })}>{g.label}</button>
            ))}
          </div>
        </Group>
      )}
      <Group icon="♿" title="Accessibility">
        <Row label="Reduce motion" sub="Calmer animations and effects">
          <Switch label="Reduce motion" on={motion} onChange={(on) => setPrefs({ reduceMotion: on })} />
        </Row>
        <Row label="Reduce flashing" sub="Softer lightning, club and Rave lights">
          <Switch label="Reduce flashing" on={calmFlash} onChange={setCalmFlashing} />
        </Row>
        <Row label="Vibration" sub="Phone buzz on big moments">
          <Switch label="Vibration" on={prefs.vibration} onChange={(on) => setPrefs({ vibration: on })} />
        </Row>
      </Group>
      <Group icon="✋" title="Ask first">
        <Row label="Leaving Rusty's" sub="Before your haul is left behind">
          <Switch label="Ask before leaving Rusty's" on={prefs.askLeave} onChange={(on) => setPrefs({ askLeave: on })} />
        </Row>
        <Row label="Selling a car">
          <Switch label="Ask before selling a car" on={prefs.askSell} onChange={(on) => setPrefs({ askSell: on })} />
        </Row>
      </Group>
      <Group icon="🔔" title="Notifications">
        <AlertsMenu />
        {user && <ChallengeSettings />}
      </Group>
    </>
  )
}

// Live race challenges: the on/off switch plus anyone the player muted from a challenge.
function ChallengeSettings() {
  const closed = useLive((l) => l.closed)
  const muted = useLive((l) => l.muted)
  return (
    <>
      <Row label="Race challenges" sub="Other players can challenge you live">
        <Switch label="Race challenges" on={!closed} onChange={(on) => setClosed(!on)} />
      </Row>
      {Object.entries(muted).map(([id, town]) => (
        <Row key={id} label={`🔇 ${town}`} sub="Muted from challenges">
          <button className="buy small alt" onClick={() => unmute(id)}>Unmute</button>
        </Row>
      ))}
    </>
  )
}

// Export and delete, for a signed-in player.
export function AccountData({ user }: { user: User }) {
  const username = useNames((s) => s.mine?.username ?? null)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  return (
    <Group icon="🗂️" title="Your data">
      <Row label="Export my data" sub="Your town and account as a file">
        <button className="buy small alt" onClick={() => exportData({ id: user.id, email: user.email, username })}>Save</button>
      </Row>
      <Row label="Delete account" sub="Removes your cloud town for good">
        <button className="sell small" onClick={() => setConfirm(true)}>Delete</button>
      </Row>
      {confirm && (
        <div className="set-danger">
          <b>Delete your account?</b>
          <p>Your cloud town, cars, friends, crew spot and chat messages are deleted forever. This can't be undone.</p>
          <div className="row">
            <button className="buy small alt" disabled={busy} onClick={() => { setConfirm(false); setErr('') }}>Keep it</button>
            <button className="danger-btn" disabled={busy} onClick={async () => {
              setBusy(true)
              const e = await deleteAccount()
              setBusy(false)
              if (e) setErr(e.includes('delete_my_account') ? 'Deleting accounts is not switched on yet. Try again later.' : e)
            }}>{busy ? 'Deleting…' : 'Delete forever'}</button>
          </div>
          {err && <small className="hint">{err}</small>}
        </div>
      )}
    </Group>
  )
}

// Signed-out players can still keep a copy of the town in this browser.
export function GuestData() {
  return (
    <Group icon="🗂️" title="Your data">
      <Row label="Export my town" sub="A copy of this browser's save">
        <button className="buy small alt" onClick={() => exportData(null)}>Save</button>
      </Row>
    </Group>
  )
}

export function LegalLinks({ open }: { open: (id: LegalDoc['id']) => void }) {
  return (
    <>
      <button className="set-link" onClick={() => open('terms')}><span>📜 Terms of Service</span><b>›</b></button>
      <button className="set-link" onClick={() => open('privacy')}><span>🔒 Privacy Policy</span><b>›</b></button>
    </>
  )
}

const TIPS = [
  ['⛽', 'Tap a business to send a car on a job. Jobs use fuel, which refills 1 a minute.'],
  ['💰', 'Tap the coin bubble to collect coins and XP.'],
  ['🚗', 'Buy cars in the Showroom. Every car you own drives your roads.'],
  ['🔧', "Build Rusty's Rescue first to find, tow and restore old cars."],
  ['⚙️', 'Upgrade cars in the Garage with coins and parts.'],
  ['➕', 'Short on something? Tap its counter at the top.'],
  ['🏁', 'Race rivals for coins and trophies. Shift in the green zone.'],
  ['⭐', 'Level up to unlock new businesses and cars.'],
] as const

export function HelpTab({ openLegal }: { openLegal: (id: LegalDoc['id']) => void }) {
  const openPanel = useGame((s) => s.openPanel)
  return (
    <>
      <Group icon="🚗" title="How to play">
        <ul className="howto set-tips">
          {TIPS.map(([icon, text]) => <li key={icon}><span aria-hidden>{icon}</span>{text}</li>)}
        </ul>
      </Group>
      <Group icon="💬" title="Support">
        {SUPPORT_EMAIL && <a className="set-link" href={`mailto:${SUPPORT_EMAIL}?subject=Cartopia%20help%20(${__BUILD_ID__})`}><span>✉️ Contact us</span><b>›</b></a>}
        <button className="set-link" onClick={showFlashWarning}><span>⚡ Photosensitivity warning</span><b>›</b></button>
        <button className="set-link" onClick={() => openPanel('chat')}><span>🗨️ Ask other players in chat</span><b>›</b></button>
        <Row label="Version"><code className="set-ver">{__BUILD_ID__.slice(0, 7)}</code></Row>
      </Group>
      <Group icon="⚖️" title="Legal">
        <LegalLinks open={openLegal} />
      </Group>
    </>
  )
}

export function LegalView({ id }: { id: LegalDoc['id'] }) {
  const doc = LEGAL[id]
  return (
    <article className="legal">
      <p className="legal-draft">{DRAFT_NOTE}</p>
      <p className="hint">Last updated {doc.updated}</p>
      <p>{doc.intro}</p>
      {doc.sections.map((s) => (
        <section key={s.h}>
          <h3>{s.h}</h3>
          {s.body.map((b, i) => (typeof b === 'string' ? <p key={i}>{b}</p> : <ul key={i}>{b.list.map((li) => <li key={li}>{li}</li>)}</ul>))}
        </section>
      ))}
      <p className="hint">Also at <a href={`/${id}`} target="_blank" rel="noreferrer">{location.host}/{id}</a></p>
    </article>
  )
}
