// Dev harness: the race result card after a loss to a quicker car (the PI cue and Upgrade button).
import { createRoot } from 'react-dom/client'
import { RaceResult } from '../../src/ui/Race'
import '../../src/index.css'
import '../../src/theme.css'

createRoot(document.getElementById('root')!).render(
  <RaceResult won={false} myTime={13.42} theirTime={13.18} cash={180} xp={8} rival="The Scorpion" stats={{ launch: 'PERFECT LAUNCH!', perfect: 5, shifts: 5, top: 61 }}
    pi={{ me: 47, them: 54 }} onUpgrade={() => {}} next={{ label: '↻ Retry', go: () => {} }} onExit={() => {}} />,
)
