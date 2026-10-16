// Town rivals: one named rival at a time picks on your town. Beat them and they
// storm off, tune their car and come back faster. After the third loss they
// give up (paying a one-time bonus) and the next rival rolls into town. Right
// after a win they offer a double-or-nothing rematch for the prize.

export type RivalLines = {
  intro: string // first visit
  back: [string, string] // second and third visits
  gloat: string // they beat you
  sore: string // you beat them
  bet: string // double-or-nothing offer
  betLost: string // you won the rematch
  betWon: string // they won the rematch
  quit: string // third loss
}
export type RivalDef = {
  id: string; name: string; icon: string; color: string; pi: [number, number] // PI on the first visit and the last
  coins: number; bucks: number; trophies: number; lines: RivalLines
}

export const RIVAL_VISITS = 3
// Rivals start turning up at this level; after that each one rolls in when the one before
// quits (no level locks), so the next rival is always on the way.
export const RIVAL_LEVEL = 2
// How long a beaten rival spends tuning before coming back.
export const RIVAL_BACK_MS = 30 * 60 * 1000

export const RIVALS: RivalDef[] = [
  {
    id: 'vinnie', name: 'Vinnie Vroom', icon: '😎', color: '#ff7043', pi: [26, 34], coins: 1500, bucks: 15, trophies: 3,
    lines: {
      intro: 'Cute town. Shame about the slow cars.',
      back: ['New spark plugs. Bad news for you.', 'Mom let me borrow her turbo. Last chance.'],
      gloat: 'Was that your top speed? Adorable.',
      sore: 'Lucky launch. I want a rematch!',
      bet: 'Double or nothing. Unless you\'re chicken?',
      betLost: 'Okay, okay. Nice driving.',
      betWon: 'Thanks for the cash, champ!',
      quit: 'Fine! I\'m moving to Gearville.',
    },
  },
  {
    id: 'polly', name: 'Polly Pistonbroke', icon: '💅', color: '#ec407a', pi: [36, 44], coins: 2500, bucks: 15, trophies: 3,
    lines: {
      intro: 'I\'ve seen faster lawn mowers in this town.',
      back: ['I polished every bolt. Twice.', 'Custom exhaust. Try to keep up.'],
      gloat: 'Don\'t cry. It smudges the chrome.',
      sore: 'My nails were drying. Again!',
      bet: 'Double or nothing, sweetie?',
      betLost: 'Ugh. Fine. You\'re good.',
      betWon: 'I\'ll spend this on wax.',
      quit: 'You win. I\'m taking up knitting.',
    },
  },
  {
    id: 'duke', name: 'Duke Dragsworth', icon: '🎩', color: '#7e57c2', pi: [48, 58], coins: 4000, bucks: 30, trophies: 4,
    lines: {
      intro: 'A town this small needs a proper champion. Me.',
      back: ['My butler tuned the gearbox.', 'I bought a faster engine. And a faster butler.'],
      gloat: 'Splendid effort. For a commoner.',
      sore: 'Preposterous! Again, at once!',
      bet: 'Shall we say double or nothing?',
      betLost: 'Well raced. Most irritating.',
      betWon: 'Put it on my tab. Oh wait, it\'s yours.',
      quit: 'I concede. Do keep the monocle polish.',
    },
  },
  {
    id: 'roxy', name: 'Roxy Revs', icon: '🔥', color: '#ef5350', pi: [64, 76], coins: 6500, bucks: 30, trophies: 5,
    lines: {
      intro: 'Heard you\'re fast. I\'m faster.',
      back: ['New tires. Still hot.', 'Full nitro. No more games.'],
      gloat: 'Smell that? That\'s your tires losing.',
      sore: 'Okay, that one stung. Rematch!',
      bet: 'Double or nothing. Right now.',
      betLost: 'Respect. Real respect.',
      betWon: 'Better luck next lap!',
      quit: 'You\'re the real deal. See you around.',
    },
  },
  {
    id: 'clutchula', name: 'Count Clutchula', icon: '🧛', color: '#5c6bc0', pi: [84, 96], coins: 10000, bucks: 45, trophies: 6,
    lines: {
      intro: 'I have come from Transamsylvania to drain your trophies.',
      back: ['I rested in my garage. I am refreshed.', 'A full moon tonight. I am at full power.'],
      gloat: 'Bleh! Too slow!',
      sore: 'Curses! The sun was in my eyes!',
      bet: 'Double or nothing? I have all night.',
      betLost: 'Ahh! I must return to my coffin.',
      betWon: 'Your coins are mine. Bleh!',
      quit: 'I yield. Your town is safe... for now.',
    },
  },
  {
    id: 'nova', name: 'Nova Nightshift', icon: '🌙', color: '#26c6da', pi: [104, 118], coins: 15000, bucks: 45, trophies: 8,
    lines: {
      intro: 'Every town has a fastest racer. Not yours.',
      back: ['I rebuilt the engine overnight.', 'This is my best car. Ready?'],
      gloat: 'Go home and practice.',
      sore: 'Nobody beats me twice. Again.',
      bet: 'Double or nothing. Prove it.',
      betLost: 'Legend. I mean it.',
      betWon: 'That\'s the difference.',
      quit: 'This town is yours. Champion.',
    },
  },
]

export type RivalProgress = { beaten: number; back?: number }

// The rival in town now: the first one not yet beaten three times.
// locked: rivals haven't started turning up yet (level below RIVAL_LEVEL). away: tuning until this time.
export function currentRival(level: number, progress: Record<string, RivalProgress>, now: number) {
  const def = RIVALS.find((r) => (progress[r.id]?.beaten ?? 0) < RIVAL_VISITS)
  if (!def) return null
  const p = progress[def.id] ?? { beaten: 0 }
  const away = p.back && p.back > now ? p.back : 0
  return { def, visit: p.beaten, locked: level < RIVAL_LEVEL, away }
}

// Each comeback is in a faster car, so beating a rival three times takes upgrades along the way.
export const rivalLadderPi = (def: RivalDef, visit: number) => Math.round(def.pi[0] + ((def.pi[1] - def.pi[0]) * visit) / (RIVAL_VISITS - 1))
// What they race against your best car (myPi): a touch slower on the first visit, level on the
// second, a touch quicker as the boss, and never faster than their own ladder.
export const RIVAL_PI_STEP = [0.96, 1, 1.04]
export const rivalPi = (def: RivalDef, visit: number, myPi = Infinity) =>
  Math.max(10, Math.min(rivalLadderPi(def, visit), Math.round(myPi * RIVAL_PI_STEP[visit])))
// Shift cleanly from 0 (sloppy) to 1 (perfect); they practice between visits.
export const rivalShift = (def: RivalDef, visit: number) => Math.min(1, 0.45 + RIVALS.indexOf(def) * 0.05 + visit * 0.15)
// A rival race pays a bit more than a quick race, on the PI raced (so an eased rival pays what the
// race was worth, as Pro Tour does). The rematch stakes the same again.
export const rivalPrize = (pi: number) => Math.round((200 + pi * 8) / 10) * 10
