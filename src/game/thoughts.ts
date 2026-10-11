import { create } from 'zustand'

// The townsperson the player tapped and what they're up to, for the thought bubble.
// The town scene keeps it up to date and clears it after `until` (performance.now()).
export const useThought = create<{ id: string | null; text: string; until: number }>(() => ({ id: null, text: '', until: 0 }))
