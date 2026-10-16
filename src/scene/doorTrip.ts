// The Cars page walking between its Showroom and the Crate Depot through the roller door. The
// page (ui/Menus.tsx CarsPage) sets these and the two views read them each frame, so the walk
// needs no re-render. Kept apart from both scenes: the depot's code loads on demand.

// The Showroom camera (scene/CarPreview.tsx): 'out' flies it from the car to the door; 'back'
// starts the next view at the door and flies it in to the car.
// `on` hears 'there' when the walk out reaches the door, and 'back' on the first frame of the walk
// back in (the room is drawing again).
export const doorTrip: { go: 'out' | 'back' | null; on?: (e: 'there' | 'back') => void } = { go: null }
// The depot camera (scene/CrateScene.tsx): 'hold' keeps it back from its place, 'in' dollies it
// in, 'out' pulls it back again.
export const depotWalk: { go: 'hold' | 'in' | 'out' | null; p: number } = { go: null, p: 0 }
// Seconds.
export const DOOR_FLY = 0.95
export const DEPOT_WALK = 1.1
