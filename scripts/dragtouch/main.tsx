// Dev harness: a solo drag race against an AI rival, for checking the touch controls on a phone.
import { createRoot } from 'react-dom/client'
import { StageCanvas } from '../../src/scene/Stage'
import { DragRace } from '../../src/ui/Race'
import '../../src/index.css'
import '../../src/theme.css'

const car = { uid: 'c1', model: 'gtr', color: '#d32f2f', upgrades: { engine: 3, turbo: 3, tires: 3, weight: 3 } }
const rival = { id: 'ai:1', town: 'Maple Hollow', level: 18, carName: 'Liberty Hellhound 707', color: '#1e88e5', pi: 62, online: false, body: 'widebody' }
createRoot(document.getElementById('root')!).render(
  <>
    <StageCanvas />
    <DragRace car={car as never} rival={rival as never} onExit={() => {}} onFinish={() => 0} />
  </>,
)
