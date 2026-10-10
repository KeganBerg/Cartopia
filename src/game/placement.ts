import { useGame } from './store'

// The turn the placement ghost currently shows, so Rotate turns from what the player sees.
let ghostTurn = 0

export function setGhostTurn(t: number) {
  ghostTurn = t
}

// Turns the building being placed a quarter turn clockwise.
export function rotatePlacement() {
  const s = useGame.getState()
  if (s.mode !== 'place' || !s.placing) return
  s.setPlaceRot(((s.placeRot ?? ghostTurn) + 1) % 4)
}
