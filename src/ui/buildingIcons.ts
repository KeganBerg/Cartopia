// One small icon per business, for compact rows like a car's favourite jobs
// (docs/ui-rules.md: icons over names). The name stays in the tooltip.
export const BUILDING_ICONS: Record<string, string> = {
  academy: '🚦', arcade: '🕹️', bodyshop: '🎨', bowling: '🎳', burger: '🍔', carwash: '🫧', cinema: '🎬', club: '🪩',
  coffee: '☕', diner: '🥞', donut: '🍩', firehouse: '🚒', glasstower: '🏙️', helipad: '🚁', highschool: '🏫', hospital: '🏥',
  hq: '🏢', icecream: '🍦', junkyard: '🧲', lube: '🛢️', market: '🛒', motel: '🛏️', offices: '💼', parkade: '🅿️',
  parts: '⚙️', pizza: '🍕', police: '🚓', school: '🎒', stadium: '🏟️', tacos: '🌮', tires: '🛞', tuner: '🔧', university: '🎓',
}

export const buildingIcon = (id: string) => BUILDING_ICONS[id] ?? '🏪'
