// The Race menu's front page (src/ui/RaceHub.tsx): which race it leads with, and the level
// each smaller mode joins the menu at.

// The level each mode joins the menu at (deep links and goals still open any of them).
export type HubMode = 'road' | 'cups' | 'world' | 'ghosts' | 'blast' | 'custom' | 'tuner' | 'flair'
export const MODE_LEVEL: Record<HubMode, number> = { ghosts: 2, road: 2, blast: 3, custom: 3, cups: 3, tuner: 4, world: 4, flair: 4 }
export const MODE_NAME: Record<HubMode, string> = { ghosts: 'Ghosts', road: 'Trophy Road', blast: 'Bumper Blast', custom: 'Custom race', cups: 'Class Cups', tuner: 'Tuner Trials', world: 'World Tour', flair: 'Flair' }

// Which race the menu leads with.
export function nextRace(campaignNext: number, eventLeft: boolean, tourOpen: boolean): 'campaign' | 'event' | 'tour' | 'quick' {
  if (campaignNext >= 0) return 'campaign'
  if (eventLeft) return 'event'
  return tourOpen ? 'tour' : 'quick'
}
