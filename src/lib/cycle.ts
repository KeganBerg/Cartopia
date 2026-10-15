// The list item for any whole number, wrapping both ways. Plain `n % list.length` goes
// negative for tiles left of or above the town's centre (x or z < 0), which picked
// `undefined` and crashed towns with roads there ("kn[e] is not a function").
export const cycle = <T,>(list: readonly T[], n: number): T => list[((n % list.length) + list.length) % list.length]
