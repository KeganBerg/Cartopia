// Dev harness: a wager race waiting on the line (the pot), and ?result=win|lose|void for the result card.
import { createRoot } from 'react-dom/client'
import { StageCanvas } from '../../src/scene/Stage'
import { DragRace, RaceResult } from '../../src/ui/Race'
import '../../src/index.css'
import '../../src/theme.css'

const q = new URLSearchParams(location.search)
const car = { uid: 'c1', model: 'gtr', color: '#d32f2f', upgrades: { engine: 3, turbo: 3, tires: 3, weight: 3 } }
const opp = { id: 'p2', uid: null, town: 'Maple Hollow', level: 18, carName: 'Liberty Hellhound 707', color: '#1e88e5', body: 'widebody' as const, pi: 62 }
const live = { raceId: 'wager-shot-1', opponent: opp, host: false, mode: 'drag' as const, stake: 10000 }
const rival = { id: 'live:p2', town: opp.town, level: 18, carName: opp.carName, color: opp.color, pi: 62, online: true, body: opp.body }
const r = q.get('result')
createRoot(document.getElementById('root')!).render(
  <>
    <StageCanvas />
    <DragRace car={car as never} rival={rival as never} live={live} onExit={() => {}} />
    {r && (
      <div className="race-full" style={{ background: 'transparent' }}>
        <RaceResult won={r === 'win'} myTime={10.42} theirTime={10.61} cash={r === 'void' ? 0 : r === 'win' ? 796 : 80} xp={r === 'void' ? 0 : r === 'win' ? 30 : 8} rival={opp.town} noContest={r === 'void'}
          stats={{ launch: 'PERFECT', perfect: 4, shifts: 5, top: 61 }} onExit={() => {}} bet={r === 'void' ? 0 : r === 'win' ? 10000 : -10000} />
      </div>
    )}
  </>,
)
