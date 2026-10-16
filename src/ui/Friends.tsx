import { useEffect, useState } from 'react'
import { useGame, today } from '../game/store'
import { fetchLeaderboard, townToVisit, demoLeaders, type Leader } from '../lib/friends'
import { supabase } from '../lib/supabase'
import { FreeCamButton, Panel } from './Menus'
import { SOCIAL_TITLE, SocialTabs, useUserId } from './Social'
import { useFriends, refreshFriends, addFriend, respondFriend, removeFriend, seenAgo, MAX_FRIENDS, type Friend } from '../lib/friendsList'
import { useNames, loadUsernames, usePlayerName } from '../lib/profiles'
import { useLive, challenge, cancelChallenge, refreshPresence, type LivePlayer } from '../lib/live'
import { UsernameForm } from './Username'
import { FRIEND_LEVELS, friendLevel } from '../game/friendship'
import { GiftButton } from './Gifts'
import { PostcardButton } from './Postcards'
import { refreshGifts } from '../lib/gifts'
import { useHelp, helpsLeft, loadHelps } from '../lib/help'
import { HELPS_PER_TOWN } from '../game/help'
import { signedInUser } from '../lib/cloud'
import { LikeButton } from './Meet'
import { GhostButton } from './GhostRace'
import { LoadingBand } from './Loading'

export function FriendsPanel() {
  const uid = useUserId()
  const mine = useNames((s) => s.mine)
  const { list, loaded, missing } = useFriends()
  const live = useLive((l) => l.players)
  const helped = useGame((s) => s.helped)
  const openPanel = useGame((s) => s.openPanel)
  const visit = useVisitTown()
  // Players to add: the leaderboard's real players plus the neighbour towns.
  const [others, setOthers] = useState<Leader[]>(demoLeaders)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchLeaderboard().then(setOthers).catch(() => {})
    refreshGifts().catch(() => {})
    void refreshFriends()
    refreshPresence()
  }, [])
  useEffect(() => loadUsernames(others.map((o) => o.ownerId)), [others])

  const online = new Map(live.filter((p) => p.uid).map((p) => [p.uid!, p]))
  const friends = list.filter((f) => f.status === 'friend')
    .sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)) || (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''))
  const incoming = list.filter((f) => f.status === 'incoming')
  const outgoing = list.filter((f) => f.status === 'outgoing')
  const known = new Set([...list.map((f) => f.id), uid ?? 'me'])
  const suggest = others.filter((o) => !known.has(o.ownerId)).slice(0, 8)
  const canFriend = !!uid && !missing

  const send = async () => {
    if (await addFriend({ username: query })) setQuery('')
  }

  return (
    <Panel title={SOCIAL_TITLE} wide>
      <SocialTabs current="friends" />
      {supabase && uid === null && (
        <div className="fr-signin">
          <span>👫</span>
          <div><b>Add your friends</b><small>Sign in to send requests and see who's online.</small></div>
          <button className="buy small" onClick={() => openPanel('account')}>Sign in</button>
        </div>
      )}
      {canFriend && mine && !mine.username && (
        <div className="fr-claim">
          <b>🪪 Claim a username so friends can add you</b>
          <UsernameForm cta="Claim" />
        </div>
      )}
      {canFriend && (
        <div className="fr-add">
          <input value={query} placeholder="Add by @username" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={17}
            onChange={(e) => setQuery(e.target.value.replace(/\s/g, ''))} onKeyDown={(e) => e.key === 'Enter' && query.trim() && void send()} />
          <button className="buy small" disabled={!query.replace(/^@/, '').trim()} onClick={send}>+ Add</button>
        </div>
      )}

      {incoming.length > 0 && (
        <>
          <h3 className="fr-h">Requests <span className="tab-dot">{incoming.length}</span></h3>
          <div className="leaders">
            {incoming.map((f) => (
              <div key={f.id} className="leader fr-row fr-incoming">
                <Avatar name={f.username ?? f.townName} />
                <FriendName f={f} />
                <div className="leader-acts">
                  <button className="buy small" onClick={() => respondFriend(f.id, true)}>✓ Accept</button>
                  <button className="buy small alt" aria-label="Decline" onClick={() => respondFriend(f.id, false)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {canFriend && (
        <>
          <h3 className="fr-h">Friends <small>{friends.length ? `${friends.filter((f) => online.has(f.id)).length} online · ${friends.length}/${MAX_FRIENDS}` : ''}</small></h3>
          {!loaded && <LoadingBand label="Finding your friends" />}
          {loaded && friends.length === 0 && <p className="empty-board fr-empty">No friends yet. Add someone by username or from the drivers below.</p>}
          <div className="leaders">
            {friends.map((f) => (
              <FriendRow key={f.id} f={f} on={online.get(f.id)} helped={helped[f.id] === today()} onVisit={() => visit(f.id)} />
            ))}
          </div>
          {outgoing.length > 0 && (
            <div className="fr-sent">
              <small>Sent:</small>
              {outgoing.map((f) => (
                <span key={f.id} className="fr-chip">
                  {f.username ? `@${f.username}` : f.townName}
                  <button aria-label="Cancel request" onClick={() => removeFriend(f.id)}>✕</button>
                </span>
              ))}
            </div>
          )}
        </>
      )}

      <h3 className="fr-h">Drivers to visit <small>tap {HELPS_PER_TOWN} shops each for coins</small></h3>
      <div className="leaders">
        {suggest.map((o) => (
          <SuggestRow key={o.ownerId} o={o} canAdd={canFriend && !o.demo} helped={helped[o.ownerId] === today()} onVisit={() => visit(o.ownerId)} />
        ))}
      </div>
    </Panel>
  )
}

function useVisitTown() {
  const visit = useGame((s) => s.visit)
  const toast = useGame((s) => s.toast)
  return async (id: string) => {
    const town = await townToVisit(id)
    if (town === 'stale') return
    if (!town) return toast("Couldn't load that town")
    visit(town)
  }
}

function Avatar({ name, on }: { name: string; on?: boolean }) {
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
  return (
    <span className={`fr-av${on ? ' on' : ''}`} style={{ background: `hsl(${hue} 65% 55%)` }}>
      {name.replace(/^@/, '').charAt(0).toUpperCase()}
    </span>
  )
}

function FriendName({ f, on }: { f: Friend; on?: LivePlayer }) {
  const seen = seenAgo(f.lastSeen)
  const pts = useGame((s) => s.friendship?.[f.id] ?? 0)
  const lv = FRIEND_LEVELS[friendLevel(pts)]
  const next = FRIEND_LEVELS[friendLevel(pts) + 1]
  return (
    <div className="leader-main">
      <b>{f.username ? `@${f.username}` : f.townName}{f.status === 'friend' && <span className="fr-level" title={`${lv.name}${next ? ` · ${next.at - pts} more to ${next.name}` : ''}. Gifts, help and postcards add up.`}>{lv.icon}</span>}</b>
      <div className="card-stat">
        {f.username && <>{f.townName} · </>}Lvl {f.level}
        {f.status === 'friend' && (on
          ? <span className="fr-online"> · 🟢 {on.carName} <em>PI {on.pi}</em></span>
          : seen && <span className="fr-seen"> · seen {seen}</span>)}
      </div>
    </div>
  )
}

function FriendRow({ f, on, helped, onVisit }: { f: Friend; on?: LivePlayer; helped: boolean; onVisit: () => void }) {
  const outgoing = useLive((l) => l.outgoing)
  const cooldown = useLive((l) => (on ? (l.cooldownTo[on.id] ?? 0) > Date.now() : false))
  const [confirm, setConfirm] = useState(false)
  return (
    <div className={`leader fr-row${on ? ' fr-on' : ''}`}>
      <Avatar name={f.username ?? f.townName} on={!!on} />
      <FriendName f={f} on={on} />
      <div className="leader-acts">
        {confirm ? (
          <>
            <button className="sell small" onClick={() => removeFriend(f.id)}>Unfriend</button>
            <button className="buy small alt" onClick={() => setConfirm(false)}>Keep</button>
          </>
        ) : (
          <>
            {on && (outgoing?.to === on.id
              ? <button className="buy small alt" onClick={cancelChallenge}>Waiting… ✕</button>
              : <button className="buy small fr-race" disabled={!!outgoing || on.closed || cooldown} onClick={() => void challenge(on.id)} title={on.closed ? 'Not taking races' : 'Challenge to a live race'}>🏁</button>)}
            <GiftButton to={f.id} />
            <PostcardButton to={f.id} name={f.username ? `@${f.username}` : f.townName} />
            <VisitBtn helped={helped} onVisit={onVisit} />
            <button className="fr-more" aria-label="Unfriend" title="Unfriend" onClick={() => setConfirm(true)}>⋯</button>
          </>
        )}
      </div>
    </div>
  )
}

// Visit a town; 🤝 while its shops can still be helped today.
function VisitBtn({ helped, onVisit }: { helped: boolean; onVisit: () => void }) {
  return <button className="buy small alt fr-visit" title={helped ? 'Visit their town' : `Visit and help ${HELPS_PER_TOWN} shops for coins`} onClick={onVisit}>{helped ? '🏠' : '🤝'} Visit</button>
}

function SuggestRow({ o, canAdd, helped, onVisit }: { o: Leader; canAdd: boolean; helped: boolean; onVisit: () => void }) {
  const name = usePlayerName(o.demo ? null : o.ownerId, o.townName)
  const [sent, setSent] = useState(false)
  const hasName = name.startsWith('@')
  return (
    <div className="leader fr-row fr-sug">
      <Avatar name={name} />
      <div className="leader-main">
        <b>{name}</b>
        <div className="card-stat">{hasName && <>{o.townName} · </>}Lvl {o.level} · 🏆 {o.trophies}{o.demo ? ' · neighbour' : ''}</div>
      </div>
      <div className="leader-acts">
        {canAdd && hasName && (
          <button className="buy small alt" disabled={sent} onClick={async () => setSent(await addFriend({ id: o.ownerId }))}>{sent ? 'Sent' : '+ Add'}</button>
        )}
        <VisitBtn helped={helped} onVisit={onVisit} />
      </div>
    </div>
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
        Visiting <b>{v.townName}</b>{!v.ownerId.startsWith('demo-') && <VisitUser id={v.ownerId} />}
        <small>Lvl {v.level} · 🏆 {v.trophies} · {v.cars.length} cars</small>
      </div>
      <div className="row">
        <LikeButton owner={v.ownerId} />
        {signedInUser() && <GiftButton to={v.ownerId} />}
        <AddFriendButton id={v.ownerId} />
        <GhostButton town={v} />
        {left !== null && (
          <span className={`help-meter${left ? '' : ' full'}`} title={left ? 'Tap their shops to help' : 'All helped today'}>
            {Array.from({ length: HELPS_PER_TOWN }, (_, i) => <i key={i} className={i < HELPS_PER_TOWN - left ? 'on' : ''} />)}
            <b>{left ? `🤝 ${left}` : '🤝 ✔'}</b>
          </span>
        )}
        <FreeCamButton className="buy small alt visit-cam" />
        <button className="buy small alt" onClick={() => visit(null)}>🏠 Home</button>
      </div>
    </div>
  )
}

// "+ Friend" on the visit banner for a real player you aren't friends with yet.
function AddFriendButton({ id }: { id: string }) {
  const uid = useUserId()
  const status = useFriends((f) => (f.missing ? 'missing' : f.list.find((x) => x.id === id)?.status ?? null))
  const [busy, setBusy] = useState(false)
  if (!uid || id === uid || id.startsWith('demo-') || status === 'missing' || status === 'friend') return null
  if (status) return <button className="buy small alt" disabled>{status === 'incoming' ? '👫 Asked you' : '👫 Sent'}</button>
  return (
    <button className="buy small alt" disabled={busy} title="Send a friend request"
      onClick={async () => { setBusy(true); await addFriend({ id }); setBusy(false) }}>+ 👫</button>
  )
}

function VisitUser({ id }: { id: string }) {
  const name = usePlayerName(id, '')
  return name.startsWith('@') ? <span className="visit-user"> {name}</span> : null
}
