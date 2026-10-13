// Friendship: each friend has a friendship level that grows as you play together: sending
// them a gift, helping their town and sending a postcard (each at most once a day, as the
// server allows). It's looks only: a badge on the Friends list and a toast at each new level.
// The save keeps the points per friend id (`friendship`).

export const FRIEND_POINTS = { gift: 3, help: 2, postcard: 1 } as const
export type FriendAct = keyof typeof FRIEND_POINTS

export const FRIEND_LEVELS = [
  { name: 'New friend', icon: '🤝', at: 0 },
  { name: 'Buddy', icon: '😊', at: 6 },
  { name: 'Pal', icon: '🎉', at: 20 },
  { name: 'Close friend', icon: '💛', at: 45 },
  { name: 'Best friend', icon: '💖', at: 90 },
]

export const friendLevel = (points = 0) => FRIEND_LEVELS.reduce((n, l, i) => (points >= l.at ? i : n), 0)
