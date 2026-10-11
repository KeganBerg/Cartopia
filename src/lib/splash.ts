// The loading screen is drawn inline in index.html (scripts/splash/build.mjs)
// so it paints before any of the game's code arrives. These nudge its bar and
// fade it out once the town has drawn.
type Splash = { set(p: number): void; done(): void }
const splash = () => (window as Window & { cartopiaSplash?: Splash }).cartopiaSplash

export const splashProgress = (p: number) => splash()?.set(p)
export const hideSplash = () => splash()?.done()
