import { useEffect, useState } from 'react'
import { useGame, today } from '../game/store'
import { fetchLeaderboard, fetchTown, demoLeaders, type Leader } from '../lib/friends'
import { supabase } from '../lib/supabase'
import { Panel } from './Menus'
import { SocialTabs } from './Social'
import { GiftButton } from './Gifts'
import { refreshGifts } from '../lib/gifts'
import { useHelp, helpsLeft, loadHelps } from '../lib/help'
import { HELPS_PER_TOWN } from '../game/help'
import { signedInUser } from '../lib/cloud'
import { LikeButton } from './Meet'
import { GhostButton } from './GhostRace'

export function FriendsPanel() {
  // Neighbours show right away; real players merge in when the query returns.
  const [leaders, setLeaders] = useState<Leader[] | null>(demoLeaders)
  const [me, setMe] = useState<string | null>(null)
  const myTown = useGame((s) => s.townName)
  const myLevel = useGame((s) => s.level)
  const myTrophies = useGame((s) => s.trophies)
  const helped = useGame((s) => s.helped)
  const visit = useGame((s) => s.visit)
  const toast = useGame((s) => s.toast)

  useEffect(() => {
    fetchLeaderboard().then(setLeaders).catch(() => {})
    supabase?.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null))
    refreshGifts().catch(() => {})
  }, [])

  // Put the local player on the board even when not signed in.
  const rows = leaders
    ? (me && leaders.some((l) => l.ownerId === me)
        ? leaders
        : [...leaders, { ownerId: 'me', townName: myTown, level: myLevel, trophies: myTrophies, carName: null }].sort(
            (a, b) => b.trophies - a.trophies || b.level - a.level,
          ))
    : null

  const go = async (id: string) => {
    const town = await fetchTown(id)
    if (!town) return toast("Couldn't load that town")
    visit(town)
  }

  return (
    <Panel title="Friends" wide>
      <SocialTabs current="friends" />
      <p className="hint">Visit a town and tap {HELPS_PER_TOWN} of its shops each day for coins (they get ⛽ too). 🎁 sends a daily gift.</p>
      {!rows && <p className="hint">Loading...</p>}
      <div className="leaders">
        {rows?.map((l, i) => {
          const mine = l.ownerId === 'me' || l.ownerId === me
          return (
            <div key={l.ownerId} className={mine ? 'leader mine' : 'leader'}>
              <span className={`rank r${i + 1}`}>{i + 1}</span>
              <div className="leader-main">
                <b>{mine ? `${l.townName} (you)` : l.townName}</b>
                <div className="card-stat">Lvl {l.level}{l.carName ? ` · ${l.carName}` : ''}{l.demo ? ' · neighbour' : ''}</div>
              </div>
              <span className="leader-trophies">🏆 {l.trophies}</span>
              {!mine && (
                <div className="leader-acts">
                  {me && <GiftButton to={l.ownerId} />}
                  <button className="buy small" onClick={() => go(l.ownerId)}>
                    {helped[l.ownerId] === today() ? 'Visit' : 'Visit & help'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {supabase && !me && <p className="hint">Sign in from the Menu to appear on the leaderboard for everyone.</p>}
    </Panel>
  )
}

export function VisitBanner() {
  const v = useGame((s) => s.visiting)
  const visit = useGame((s) => s.visit)
  const racing = useGame((s) => s.panel === 'ghost')
  const left = useHelp((h) => (v && h.owner === v.ownerId ? helpsLeft(h) : null))
  const owner = v?.ownerId
  useEffect(() => {
    if (owner) void loadHelps(owner)
  }, [owner])
  if (!v || racing) return null
  return (
    <div className="visit-banner">
      <div className="visit-title">
        Visiting <b>{v.townName}</b>
        <small>Lvl {v.level} · 🏆 {v.trophies} · {v.cars.length} cars</small>
      </div>
      <div className="row">
        <LikeButton owner={v.ownerId} />
        {signedInUser() && <GiftButton to={v.ownerId} />}
        <GhostButton town={v} />
        {left !== null && (
          <span className={`help-meter${left ? '' : ' full'}`} title={left ? 'Tap their shops to help' : 'All helped today'}>
            {Array.from({ length: HELPS_PER_TOWN }, (_, i) => <i key={i} className={i < HELPS_PER_TOWN - left ? 'on' : ''} />)}
            <b>{left ? `🤝 ${left}` : '🤝 ✔'}</b>
          </span>
        )}
        <button className="buy small alt" onClick={() => visit(null)}>🏠 Home</button>
      </div>
    </div>
  )
}
