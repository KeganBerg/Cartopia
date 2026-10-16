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
  // Homes grow in their own style (the plain House and Trailer keep theirs in data.ts).
  cottage: ['Garden Cottage', 'Cottage Lane'],
  bungalow: ['Craftsman Bungalow', 'Bungalow Court'],
  townhouse: ['Row Houses', 'Brownstone Terrace'],
  cabin: ['Timber Lodge', 'Mountain Lodge'],
  duplex: ['Modern Fourplex', 'Modern Lofts'],
  victorian: ['Grand Victorian', 'Victorian Terrace'],
  condos: ['Lakeview Residences', 'Lakeview Towers'],
  villa: ['Villa Estate', 'Grand Villa'],
  mansion: ['Goldcrest Estate', 'Goldcrest Palace'],
  // Grand forms for places that wouldn't make sense as towers.
  tacos: ['Taqueria', 'Cantina'],
  firehouse: ['Fire Station & Drill Tower', 'Fire HQ'],
  stadium: ['Grand Speedway', 'Speedway Arena'],
  gas: ['Service Plaza', 'Travel Center'],
  cinema: ['Drive-In Deluxe', 'Mega Drive-In'],
  tires: ['Tire Center', 'Giant Tire Auto Mall'],
  lube: ['Lube Center', 'Oil Can Auto Mall'],
  carwash: ['Wash Center', 'Bubble Car Spa'],
  parts: ['Parts Center', 'Parts Superstore'],
  bodyshop: ['Paint Center', 'Custom Paint Studio'],
  rescue: ["Rusty's Recovery Yard", "Rusty's Restoration Works"],
  // Third wave.
  muffler: ['Exhaust Center', 'Exhaust Works'],
  brakes: ['Brake Center', 'Brake & Align Works'],
  wraps: ['Wrap Studio', 'Custom Wrap Works'],
  dynolab: ['Dyno Center', 'Performance Lab'],
  engines: ['Engine Center', 'Engine Factory'],
  racefab: ['Race Fab Works', 'Race Team HQ'],
  laundry: ['Laundry Block', 'Laundry Tower'],
  vet: ['Animal Clinic', 'Animal Hospital'],
  postoffice: ['Mail Center', 'Sorting Hub'],
  library: ['Library & Archive', 'Grand Library'],
  busdepot: ['Transit Center', 'Grand Terminal'],
  cityhall: ['Civic Center', 'Capitol Hall'],
  minigolf: ['Mini Golf Plaza', 'Adventure Golf'],
  pool: ['Aquatic Center', 'Olympic Pool'],
  funfair: ['Fairground', 'Amusement Park'],
  waterpark: ['Slide Park', 'Mega Water Park'],
  haunted: ['Haunted Mansion', 'Haunted Castle'],
}

export const grows = (id: string) => id in GROWTH

// The building's name at a level: its shop name until it grows.
export const growthName = (id: string, name: string, level: number) => {
  const s = growthStage(level)
  const g = GROWTH[id]
  return g && s > 1 ? g[s - 2] : name
}
