// Dev harness: the Race menu's quick races with five players in the live lobby, to check the
// kart party card and picking who to invite. Needs VITE_SUPABASE_URL/KEY set (any values):
// the live cards only show when there's a server to race through.
import { createRoot } from 'react-dom/client'
import { StageCanvas } from '../../src/scene/Stage'
import { CARS } from '../../src/game/data'
import { useLive, type LivePlayer } from '../../src/lib/live'
import { RacePanel, openRaceTab } from '../../src/ui/Race'
import '../../src/index.css'
import '../../src/theme.css'

const towns = ['Maple Hollow', 'Nitro Bay', 'Piston Point', 'Gearville', 'Dusty Flats']
const ids = ['stallion', 'rally', 'buggy', 'bandit', 'vette']
const players: LivePlayer[] = towns.map((town, i) => {
  const c = CARS.find((o) => o.id === ids[i]) ?? CARS[i]
  return { id: 'p' + i, uid: null, town, level: 10 + i * 3, carName: c.name, color: c.colors[0], body: c.body, pi: 40 + i * 4 }
})
useLive.setState({ players, signedIn: true })
openRaceTab('quick')
createRoot(document.getElementById('root')!).render(<><StageCanvas /><RacePanel /></>)
