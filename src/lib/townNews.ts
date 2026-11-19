import { demoRows, fetchBoard, type BoardRow, type Metric } from './clans'

// The top of chat's Global room: who led the week's boards, so the room has news even
// when nobody has spoken. Read from the same weekly boards as Leaderboards.

export type NewsItem = { metric: Metric; icon: string; tip: string; row: BoardRow; n: number }

const STORIES: { metric: Metric; icon: string; tip: string }[] = [
  { metric: 'race_wins', icon: '🏁', tip: 'Most race wins this week' },
  { metric: 'level', icon: '⭐', tip: 'Most levels gained this week' },
  { metric: 'trophies', icon: '🏆', tip: 'Most trophies this week' },
]

const FRESH = 5 * 60_000
let cache: { at: number; items: NewsItem[] } | null = null

// The leader of each weekly board that has one, at most one story per player.
export function pickNews(boards: BoardRow[][]): NewsItem[] {
  const used = new Set<string>()
  const out: NewsItem[] = []
  STORIES.forEach((s, i) => {
    const row = boards[i]?.find((r) => !used.has(r.ownerId) && r.week[s.metric] > 0)
    if (!row) return
    used.add(row.ownerId)
    out.push({ ...s, row, n: row.week[s.metric] })
  })
  return out
}

export async function fetchTownNews(): Promise<NewsItem[]> {
  if (cache && Date.now() - cache.at < FRESH) return cache.items
  try {
    const boards = await Promise.all(STORIES.map(async (s) => {
      const rows = await fetchBoard(s.metric, 'week')
      const extras = rows.length < 50 ? demoRows.filter((d) => d.week[s.metric] > 0) : []
      return [...rows, ...extras].sort((a, b) => b.week[s.metric] - a.week[s.metric])
    }))
    const items = pickNews(boards)
    cache = { at: Date.now(), items }
    return items
  } catch {
    return cache?.items ?? []
  }
}
