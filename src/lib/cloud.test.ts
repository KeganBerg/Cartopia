// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory stand-in for the game_saves table, including the server's level guard.
type Row = { owner_id: string; state: { level: number; townName: string; updatedAt: number }; updated_at: string; level: number }
let db: Map<string, Row>
let serverWrites: number

function stamp(iso: string) {
  // Postgres hands timestamps back in its own format, not the one we sent.
  return iso.replace('Z', '+00:00')
}

function fakeClient() {
  let session: { user: { id: string } } | null = null
  const listeners: ((event: string, s: typeof session) => void)[] = []
  const client = {
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: (fn: (event: string, s: typeof session) => void) => {
        listeners.push(fn)
        return { data: { subscription: { unsubscribe() {} } } }
      },
    },
    from: () => {
      const filters: Record<string, string> = {}
      let op: 'select' | 'update' | 'insert' = 'select'
      let payload: Omit<Row, 'updated_at'> & { updated_at: string }
      const run = () => {
        if (op === 'select') {
          const row = db.get(filters.owner_id)
          return { data: row ? { state: row.state, updated_at: row.updated_at } : null, error: null }
        }
        if (op === 'insert') {
          if (db.has(payload.owner_id)) return { data: null, error: { code: '23505', message: 'duplicate' } }
          db.set(payload.owner_id, { ...payload, updated_at: stamp(payload.updated_at) })
          serverWrites++
          return { data: [{ updated_at: db.get(payload.owner_id)!.updated_at }], error: null }
        }
        const row = db.get(filters.owner_id)
        if (!row || (filters.updated_at && row.updated_at !== filters.updated_at)) return { data: [], error: null }
        if (payload.state.level < row.state.level) return { data: null, error: { code: '23514', message: 'refusing level drop' } }
        db.set(row.owner_id, { ...payload, updated_at: stamp(payload.updated_at) })
        serverWrites++
        return { data: [{ updated_at: db.get(row.owner_id)!.updated_at }], error: null }
      }
      const q = {
        select: () => q,
        update: (row: typeof payload) => ((op = 'update'), (payload = row), q),
        insert: (row: typeof payload) => ((op = 'insert'), (payload = row), q),
        eq: (k: string, v: string) => ((filters[k] = v), q),
        maybeSingle: async () => run(),
        then: (resolve: (r: unknown) => void) => resolve(run()),
      }
      return q
    },
    signIn(uid: string) {
      session = { user: { id: uid } }
      listeners.forEach((fn) => fn('SIGNED_IN', session))
    },
  }
  return client
}

// Boots a fresh copy of the game, as if opening the site on a device whose browser storage is `storage`.
async function openGame(storage: Record<string, string>) {
  vi.resetModules()
  localStorage.clear()
  for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v)
  const client = fakeClient()
  vi.doMock('./supabase', () => ({ supabase: client }))
  const { useGame } = await import('../game/store')
  const cloud = await import('./cloud')
  cloud.startCloudSync()
  await vi.advanceTimersByTimeAsync(10)
  const snapshot = () => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)!]))
  return { client, useGame, snapshot }
}

async function signIn(device: Awaited<ReturnType<typeof openGame>>, uid: string) {
  device.client.signIn(uid)
  await vi.advanceTimersByTimeAsync(10)
}

async function play(device: Awaited<ReturnType<typeof openGame>>, changes: { level: number; townName: string }) {
  vi.advanceTimersByTime(1000)
  device.useGame.setState({ ...changes, updatedAt: Date.now() })
  await vi.advanceTimersByTimeAsync(3500)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-10T12:00:00Z'))
  db = new Map()
  serverWrites = 0
})

afterEach(() => {
  vi.useRealTimers()
  vi.doUnmock('./supabase')
})

describe('moving between devices', () => {
  it('loads the cloud town on a second device instead of uploading its fresh town', async () => {
    const phone = await openGame({})
    await signIn(phone, 'kegan')
    await play(phone, { level: 6, townName: 'Phone Town' })
    expect(db.get('kegan')!.state.level).toBe(6)

    // Desktop opens later with a brand-new town that is stamped newer than the cloud save.
    vi.advanceTimersByTime(60_000)
    const desktop = await openGame({})
    await signIn(desktop, 'kegan')

    expect(desktop.useGame.getState().townName).toBe('Phone Town')
    expect(desktop.useGame.getState().level).toBe(6)
    expect(db.get('kegan')!.state.townName).toBe('Phone Town')
  })

  it('carries progress back and forth across devices', async () => {
    const phone = await openGame({})
    await signIn(phone, 'kegan')
    await play(phone, { level: 3, townName: 'Phone Town' })
    const phoneStorage = phone.snapshot()

    const desktop = await openGame({})
    await signIn(desktop, 'kegan')
    await play(desktop, { level: 4, townName: 'Desk Town' })
    expect(db.get('kegan')!.state.level).toBe(4)

    // Reopening the site on the phone picks up the desktop progress.
    const phoneAgain = await openGame(phoneStorage)
    await signIn(phoneAgain, 'kegan')
    expect(phoneAgain.useGame.getState().level).toBe(4)
    expect(phoneAgain.useGame.getState().townName).toBe('Desk Town')
  })

  it('stops a tab left open on device A from overwriting newer play on device B', async () => {
    const phone = await openGame({})
    await signIn(phone, 'kegan')
    await play(phone, { level: 3, townName: 'Phone Town' })

    const desktop = await openGame({})
    await signIn(desktop, 'kegan')
    await play(desktop, { level: 3, townName: 'Desk Town' })
    expect(db.get('kegan')!.state.townName).toBe('Desk Town')

    // The phone tab is still open and the player taps something there.
    const writes = serverWrites
    await play(phone, { level: 3, townName: 'Stale Phone Town' })
    expect(serverWrites).toBe(writes)
    expect(db.get('kegan')!.state.townName).toBe('Desk Town')
    expect(phone.useGame.getState().townName).toBe('Desk Town')
  })

  it('keeps a guest town when signing in to a brand-new account', async () => {
    const laptop = await openGame({})
    await play(laptop, { level: 2, townName: 'Guest Town' })
    await signIn(laptop, 'newbie')
    expect(db.get('newbie')!.state.townName).toBe('Guest Town')
  })

  it("never uploads one account's town into another account's save", async () => {
    const shared = await openGame({})
    await signIn(shared, 'kegan')
    await play(shared, { level: 5, townName: 'Kegan Town' })
    db.set('nate', { owner_id: 'nate', level: 2, state: { level: 2, townName: 'Nate Town', updatedAt: 1 }, updated_at: '2026-10-10T00:00:00+00:00' })

    const sameBrowser = await openGame(shared.snapshot())
    await signIn(sameBrowser, 'nate')
    expect(db.get('nate')!.state.townName).toBe('Nate Town')
    expect(sameBrowser.useGame.getState().townName).toBe('Nate Town')
  })
})
