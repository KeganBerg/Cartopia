// Whether Rave Mode plays onte's "halcyon" (NCS) instead of our own synthesized
// track. Off until NCS grants the in-game licence Kegan applied for
// (ncs.io/usage-policy sends games to its commercial licence form). While it's
// off, the song file isn't fetched or built into the game at all. Turn it on
// with the one __RAVE_HALCYON__ line in vite.config.ts.
export const HALCYON: boolean = __RAVE_HALCYON__
