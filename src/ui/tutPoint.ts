// Where the see-through Rusty's sits on screen while a new player places it, in CSS px,
// or null. The town canvas writes it each frame (scene/TutorialCamera.tsx) and the
// tutorial's pointing hand (ui/TutHand.tsx) reads it, as the ghost has no DOM element.
export const tutPoint: { at: { x: number; y: number } | null } = { at: null }
