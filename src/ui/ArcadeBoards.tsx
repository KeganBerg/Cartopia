import { useEffect, useState } from 'react'
import { BOARD_GAMES, arcadeCrateSource, fetchArcadeBoard, fetchArcadePrizes, type ArcadeBoard, type ArcadePrize, type BoardGame } from '../lib/arcadeBoard'
import { useGame } from '../game/store'
import { signedInUser } from '../lib/cloud'
import { PlayerName } from './Username'
import { LoadingBand } from './Loading'

// The weekly arcade boards: a tab per game, the top 20 and your own place. They reset every Monday.

const ICON: Record<BoardGame, string> = { chase: '🚓', stunt: '🔥', delivery: '🍕', wash: '🧽', pit: '🔧' }
const value = (g: BoardGame, v: number) => (g === 'pit' ? `${v.toFixed(1)}s` : g === 'wash' ? `🚗 ${v}` : g === 'delivery' ? `🍕 ${v}` : v.toLocaleString())

// Whether the boards are switched on (their SQL has been run). Asked once per visit to the arcade.
export function useBoardsOn() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let live = true
    void fetchArcadeBoard('chase').then((b) => live && setOn(!!b))
    return () => { live = false }
  }, [])
  return on
}

export function WeeklyBoards({ onBack }: { onBack: () => void }) {
  const [game, setGame] = useState<BoardGame>('chase')
  const [board, setBoard] = useState<ArcadeBoard | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    setBoard(undefined)
    void fetchArcadeBoard(game).then((b) => live && setBoard(b))
    return () => { live = false }
  }, [game])
  const uid = signedInUser()
  const town = useGame((s) => s.townName)
  const meShown = board?.top.some((r) => r.owner === uid)
  return (
    <>
      <button className="arc-back" onClick={onBack}>‹ Back</button>
      <div className="arc-board-tabs">
        {BOARD_GAMES.map((g) => (
          <button key={g} className={g === game ? 'sel' : ''} onClick={() => setGame(g)} aria-label={g}>{ICON[g]}</button>
        ))}
      </div>
      <div className="leaders">
        {board === undefined && <LoadingBand label="Loading scores" />}
        {board && board.top.length === 0 && <p className="empty-board">🏁 Be the first this week</p>}
        {board?.top.map((r) => <Row key={r.owner} game={game} place={r.place} owner={r.owner} town={r.town ?? ''} best={r.best} mine={r.owner === uid} />)}
        {board?.me && !meShown && uid && <Row game={game} place={board.me.place} owner={uid} town={town} best={board.me.best} mine />}
      </div>
    </>
  )
}

function Row({ game, place, owner, town, best, mine }: { game: BoardGame; place: number; owner: string; town: string; best: number; mine?: boolean }) {
  return (
    <div className={mine ? 'leader board-row mine' : 'leader board-row'}>
      <span className={`rank r${place}`}>{place}</span>
      <div className="leader-main"><b><PlayerName id={owner} town={town} />{mine ? ' (you)' : ''}</b></div>
      <span />
      <span className="board-value">{value(game, best)}</span>
    </div>
  )
}

// Your place on this week's board, on a result card.
export function WeekPlace({ place }: { place: number }) {
  return <div className="arc-week">🏅 #{place} this week</div>
}

// Gold crates won on last weeks' boards and not opened yet: one button sends them to the
// Crate Depot as free crates (crate_open checks each one on the server).
export function ClaimPrizes() {
  const [prizes, setPrizes] = useState<ArcadePrize[]>([])
  const free = useGame((s) => s.freeCrates) ?? []
  useEffect(() => {
    let live = true
    void fetchArcadePrizes().then((p) => live && setPrizes(p ?? []))
    return () => { live = false }
  }, [])
  const waiting = prizes.filter((p) => !p.claimed).map(arcadeCrateSource)
  if (!waiting.length) return null
  const claim = () => {
    const g = useGame.getState()
    const have = g.freeCrates ?? []
    useGame.setState({ freeCrates: [...have, ...waiting.filter((w) => !have.includes(w))], updatedAt: Date.now() })
    g.openPanel('crates')
  }
  const fresh = waiting.filter((w) => !free.includes(w)).length
  return <button className="arc-claim" onClick={claim}>🎁 {fresh || waiting.length} × Gold crate</button>
}
