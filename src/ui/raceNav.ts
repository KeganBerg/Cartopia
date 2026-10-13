// Opening the Race menu from elsewhere (goals, visitors, prize popups) without
// loading the Race menu's code until it actually opens.
import { useGame } from '../game/store'
import type { Visitor } from '../lib/visitors'
import type { HubTab } from './RaceHub'

export type RaceTab = 'hub' | HubTab
let nextTab: RaceTab = 'hub'
// A street racer visiting town (src/lib/visitors.ts): the race opens straight away, at no fuel.
let nextStreet: Visitor | null = null
export function openStreetRace(v: Visitor) {
  nextStreet = v
  nextTab = 'quick'
  useGame.getState().openPanel('race')
}
// Opens the Race menu on a given tab (goals use it to send players to the campaign or Grand Prix).
export function openRaceTab(tab: RaceTab) {
  nextTab = tab
  useGame.getState().openPanel('race')
}
// Read once by the Race menu as it opens.
export function takeRaceTab(): RaceTab {
  const t = nextTab
  nextTab = 'hub'
  return t
}
export function takeStreetRace(): Visitor | null {
  const v = nextStreet
  nextStreet = null
  return v
}
