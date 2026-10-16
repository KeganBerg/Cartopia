import { useEffect, useState } from 'react'
import { askCrewParts, claimCrewParts, giveCrewPart, refreshCrewParts, useCrewParts, CREW_ASK, CREW_GIVE_MAX } from '../lib/crewParts'

// The crew home's part requests (lib/crewParts.ts): ask once a day, give crewmates a part each.
export function CrewPartsTile({ uid }: { uid: string | null }) {
  const list = useCrewParts((c) => c.list)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    // Anything given since last time is collected on the way in.
    void claimCrewParts().then(refreshCrewParts)
  }, [])
  const mine = list.find((r) => r.asker === uid)
  const others = list.filter((r) => r.asker !== uid)
  const run = async (f: () => Promise<unknown>) => {
    setBusy(true)
    try { await f() } finally { setBusy(false) }
  }
  return (
    <div className="rm-tile cr-parts">
      <span className="rm-tag" title={`Ask your crew for ${CREW_ASK} parts once a day`}>PART REQUESTS</span>
      {mine ? (
        <span className="rm-cta">
          <span>Your ask: ⚙ {mine.given}/{mine.want}</span>
          <button className="buy small" disabled={busy || !mine.given} onClick={() => run(async () => { await claimCrewParts(); await refreshCrewParts() })}>Collect</button>
        </span>
      ) : (
        <span className="rm-cta">
          <span>⚙ ×{CREW_ASK}</span>
          <button className="buy small" disabled={busy} onClick={() => run(askCrewParts)}>Ask</button>
        </span>
      )}
      {others.map((r) => (
        <span key={r.id} className="rm-cta">
          <span>{r.name} · ⚙ {r.given}/{r.want}</span>
          <button className="buy small alt" disabled={busy || r.given >= r.want || r.mine >= CREW_GIVE_MAX} onClick={() => run(() => giveCrewPart(r.id))}>{r.given >= r.want ? '✔' : 'Give ⚙1'}</button>
        </span>
      ))}
    </div>
  )
}
