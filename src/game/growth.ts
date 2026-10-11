// What a business turns into as it levels up, like homes do (house, apartments,
// Sky Tower). Level 1-3 is the shop as built; level 4 rebuilds it into its
// second form and level 7 into its last. Purely how it looks: pay, job times
// and costs stay in data.ts (the economy guard mirrors those).

export type GrowthStage = 1 | 2 | 3
export const growthStage = (level: number): GrowthStage => (level >= 7 ? 3 : level >= 4 ? 2 : 1)

// Floors: three to five above the shop at levels 4-6, then a tower of 9 to 19.
export const midFloors = (level: number) => Math.min(6, Math.max(4, level)) - 1
export const towerFloors = (level: number) => [9, 12, 15, 19][Math.min(10, Math.max(7, level)) - 7]

// Names for the second and last forms.
export const GROWTH: Record<string, [string, string]> = {
  pizza: ['Pizza Walk-Up', 'Pizza Tower'],
  donut: ['Donut Corner', 'Donut Tower'],
  burger: ['Burger Block', 'Burger Tower'],
  icecream: ['Sundae Block', 'Soft Serve Tower'],
  coffee: ['Coffee House', 'Coffee Tower'],
  diner: ['Streamline Diner', 'Diner Tower'],
  bowling: ['Bowl-O-Rama', 'Strike Tower'],
  motel: ['Hotel', 'Grand Hotel Tower'],
  market: ['Fresh Mart Plaza', 'Mart Tower'],
  arcade: ['Arcade Block', 'Pixel Tower'],
  tuner: ['Tuner Showroom', 'Car Tower'],
  police: ['Police Precinct', 'Police HQ Tower'],
  offices: ['Office Block', 'Business Tower'],
  hospital: ['Medical Center', 'Medical Tower'],
  hq: ['HQ Campus', 'Twin Towers'],
  glasstower: ['Sky Garden Tower', 'Twisting Supertall'],
}

export const grows = (id: string) => id in GROWTH

// The building's name at a level: its shop name until it grows.
export const growthName = (id: string, name: string, level: number) => {
  const s = growthStage(level)
  const g = GROWTH[id]
  return g && s > 1 ? g[s - 2] : name
}
