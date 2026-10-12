// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory stand-in for the game_saves table, including the server's level guard.
type Row = { owner_id: string; state: { level: number; townName: string; updatedAt: number }; updated_at: string; level: number }
let db: Map<string, Row>
let serverWrites: number
// Stands in for the server's economy guard: trims a save and says what it changed.
let serverTrim: ((s: Row['state']) => object | null) | null
// Server functions the fake client knows, like reset_my_account. Missing ones error like PostgREST.
let rpcs: Record<string, (uid: string) => void>

function stamp(iso: string) {
  // Postgres hands timestamps back in its own format, not the one we sent.
  return iso.replace('Z', '+00:00')
}

function fakeClient(signedInAs?: string) {
  let session: { user: { id: string } } | null = signedInAs ? { user: { id: signedInAs } } : null
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
          const corrections = serverTrim?.(payload.state) ?? null
          db.set(payload.owner_id, { ...payload, updated_at: stamp(payload.updated_at) })
          serverWrites++
          return { data: [{ updated_at: db.get(payload.owner_id)!.updated_at, corrections }], error: null }
        }
        const row = db.get(filters.owner_id)
        if (!row || (filters.updated_at && row.updated_at !== filters.updated_at)) return { data: [], error: null }
        if (payload.state.level < row.state.level) return { data: null, error: { code: '23514', message: 'refusing level drop' } }
        const corrections = serverTrim?.(payload.state) ?? null
        db.set(row.owner_id, { ...payload, updated_at: stamp(payload.updated_at) })
        serverWrites++
        return { data: [{ updated_at: db.get(row.owner_id)!.updated_at, corrections }], error: null }
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
    rpc: async (name: string) => {
      const fn = rpcs[name]
      if (!fn) return { error: { code: 'PGRST202', message: `Could not find the function public.${name}` } }
      fn(session!.user.id)
      return { error: null }
    },
    signIn(uid: string) {
      session = { user: { id: uid } }
      listeners.forEach((fn) => fn('SIGNED_IN', session))
    },
  }
  return client
}

type Device = Awaited<ReturnType<typeof boot>>

// Boots a fresh copy of the game, as if opening the site on a device whose browser storage is `storage`.
async function boot(storage: Record<string, string>, signedInAs?: string) {
  vi.resetModules()
  localStorage.clear()
  for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v)
  const client = fakeClient(signedInAs)
  vi.doMock('./supabase', () => ({ supabase: client }))
  const { useGame } = await import('../game/store')
  const cloud = await import('./cloud')
  const device = { client, useGame, reloads: 0, uid: signedInAs, snapshot: () => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)!])) }
  cloud.page.reload = () => void device.reloads++
  cloud.startCloudSync()
  await vi.advanceTimersByTimeAsync(10)
  return device
}

const openGame = (storage: Record<string, string>) => boot(storage)

// Signs in, following the page reload the game does when it swaps in the cloud town.
async function signIn(device: Device, uid: string): Promise<Device> {
  device.client.signIn(uid)
  await vi.advanceTimersByTimeAsync(10)
  if (!device.reloads) return device
  const reloaded = await boot(device.snapshot(), uid)
  expect(reloaded.reloads).toBe(0)
  return reloaded
}

async function play(device: Device, changes: { level: number; townName: string }) {
  vi.advanceTimersByTime(1000)
  device.useGame.setState({ ...changes, updatedAt: Date.now() })
  await vi.advanceTimersByTimeAsync(3500)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-10T12:00:00Z'))
  db = new Map()
  serverWrites = 0
  serverTrim = null
  // reset_my_account deletes the save row; no trigger runs on delete, so no level guard.
  rpcs = { reset_my_account: (uid) => void db.delete(uid) }
})

afterEach(() => {
  vi.useRealTimers()
  vi.doUnmock('./supabase')
})

describe('moving between devices', () => {
  it('loads the cloud town on a second device instead of uploading its fresh town', async () => {
    let phone = await openGame({})
    phone = await signIn(phone, 'kegan')
    await play(phone, { level: 6, townName: 'Phone Town' })
    expect(db.get('kegan')!.state.level).toBe(6)

    // Desktop opens later with a brand-new town that is stamped newer than the cloud save.
    vi.advanceTimersByTime(60_000)
    let desktop = await openGame({})
    const writes = serverWrites
    desktop.client.signIn('kegan')
    await vi.advanceTimersByTimeAsync(10)
    // The page reloads into the cloud town, and the starter town can't save while that happens.
    expect(desktop.reloads).toBe(1)
    await play(desktop, { level: 1, townName: 'My Town' })
    expect(serverWrites).toBe(writes)
    desktop = await boot(desktop.snapshot(), 'kegan')
    expect(desktop.reloads).toBe(0)

    expect(desktop.useGame.getState().townName).toBe('Phone Town')
    expect(desktop.useGame.getState().level).toBe(6)
    expect(db.get('kegan')!.state.townName).toBe('Phone Town')
  })

  it('carries progress back and forth across devices', async () => {
    let phone = await openGame({})
    phone = await signIn(phone, 'kegan')
    await play(phone, { level: 3, townName: 'Phone Town' })
    const phoneStorage = phone.snapshot()

    let desktop = await openGame({})
    desktop = await signIn(desktop, 'kegan')
    await play(desktop, { level: 4, townName: 'Desk Town' })
    expect(db.get('kegan')!.state.level).toBe(4)

    // Reopening the site on the phone picks up the desktop progress.
    let phoneAgain = await openGame(phoneStorage)
    phoneAgain = await signIn(phoneAgain, 'kegan')
    expect(phoneAgain.useGame.getState().level).toBe(4)
    expect(phoneAgain.useGame.getState().townName).toBe('Desk Town')
  })

  it('stops a tab left open on device A from overwriting newer play on device B', async () => {
    let phone = await openGame({})
    phone = await signIn(phone, 'kegan')
    await play(phone, { level: 3, townName: 'Phone Town' })

    let desktop = await openGame({})
    desktop = await signIn(desktop, 'kegan')
    await play(desktop, { level: 3, townName: 'Desk Town' })
    expect(db.get('kegan')!.state.townName).toBe('Desk Town')

    // The phone tab is still open and the player taps something there.
    const writes = serverWrites
    await play(phone, { level: 3, townName: 'Stale Phone Town' })
    expect(serverWrites).toBe(writes)
    expect(db.get('kegan')!.state.townName).toBe('Desk Town')
    // The phone reloads into the desktop town.
    expect(phone.reloads).toBe(1)
    phone = await boot(phone.snapshot(), 'kegan')
    expect(phone.useGame.getState().townName).toBe('Desk Town')
    expect(phone.reloads).toBe(0)
  })

  it('keeps a guest town when signing in to a brand-new account', async () => {
    let laptop = await openGame({})
    await play(laptop, { level: 2, townName: 'Guest Town' })
    laptop = await signIn(laptop, 'newbie')
    expect(db.get('newbie')!.state.townName).toBe('Guest Town')
  })

  it("never uploads one account's town into another account's save", async () => {
    let shared = await openGame({})
    shared = await signIn(shared, 'kegan')
    await play(shared, { level: 5, townName: 'Kegan Town' })
    db.set('nate', { owner_id: 'nate', level: 2, state: { level: 2, townName: 'Nate Town', updatedAt: 1 }, updated_at: '2026-10-10T00:00:00+00:00' })

    let sameBrowser = await openGame(shared.snapshot())
    sameBrowser = await signIn(sameBrowser, 'nate')
    expect(db.get('nate')!.state.townName).toBe('Nate Town')
    expect(sameBrowser.useGame.getState().townName).toBe('Nate Town')
  })

  it("switches accounts in an open tab without drawing the other town before the reload", async () => {
    let tab = await openGame({})
    tab = await signIn(tab, 'kegan')
    await play(tab, { level: 5, townName: 'Kegan Town' })
    db.set('nate', { owner_id: 'nate', level: 2, state: { level: 2, townName: 'Nate Town', updatedAt: 1 }, updated_at: '2026-10-10T00:00:00+00:00' })

    const writes = serverWrites
    tab.client.signIn('nate')
    await vi.advanceTimersByTimeAsync(10)
    // Nate's town goes straight to storage and the page reloads; the running game never rebuilds for it.
    expect(tab.reloads).toBe(1)
    expect(tab.useGame.getState().townName).toBe('Kegan Town')
    await play(tab, { level: 5, townName: 'Kegan Town Again' })
    expect(serverWrites).toBe(writes)

    tab = await boot(tab.snapshot(), 'nate')
    expect(tab.reloads).toBe(0)
    expect(tab.useGame.getState().townName).toBe('Nate Town')
    expect(db.get('kegan')!.state.townName).toBe('Kegan Town')
    expect(db.get('nate')!.state.townName).toBe('Nate Town')
  })
})

describe('server economy checks', () => {
  it("gives a new account its own starter town in a browser holding another player's town", async () => {
    let shared = await openGame({})
    shared = await signIn(shared, 'kegan')
    await play(shared, { level: 5, townName: 'Kegan Town' })

    // Kegan signs out and a friend makes a brand-new account in the same browser.
    let friend = await openGame(shared.snapshot())
    friend = await signIn(friend, 'friend')
    expect(db.get('friend')!.state.townName).toBe('My Town')
    expect(db.get('friend')!.state.level).toBe(1)
    expect(friend.useGame.getState().townName).toBe('My Town')
    expect(db.get('kegan')!.state.townName).toBe('Kegan Town')
  })

  it("never offers to restore another player's town", async () => {
    let shared = await openGame({})
    shared = await signIn(shared, 'kegan')
    await play(shared, { level: 5, townName: 'Kegan Town' })
    db.set('nate', { owner_id: 'nate', level: 2, state: { level: 2, townName: 'Nate Town', updatedAt: 1 }, updated_at: '2026-10-10T00:00:00+00:00' })

    let nate = await openGame(shared.snapshot())
    nate = await signIn(nate, 'nate')
    const { localBackup } = await import('./cloud')
    expect(nate.useGame.getState().townName).toBe('Nate Town')
    expect(localBackup()).toBeNull()
  })

  it('still offers a guest town back after signing in to an account that has a save', async () => {
    let laptop = await openGame({})
    await play(laptop, { level: 4, townName: 'Guest Town' })
    db.set('nate', { owner_id: 'nate', level: 2, state: { level: 2, townName: 'Nate Town', updatedAt: 1 }, updated_at: '2026-10-10T00:00:00+00:00' })
    laptop = await signIn(laptop, 'nate')
    const { localBackup } = await import('./cloud')
    expect(localBackup()?.townName).toBe('Guest Town')
  })

  it('plays on from the server copy when the server trims a save', async () => {
    let phone = await openGame({})
    phone = await signIn(phone, 'kegan')
    await play(phone, { level: 4, townName: 'Phone Town' })

    // A level jump the server can't verify gets cut back to what it allows.
    serverTrim = (s) => (s.level > 5 ? ((s.level = 5), { xp: { sent: 99, kept: 5 } }) : null)
    await play(phone, { level: 60, townName: 'Phone Town' })
    expect(db.get('kegan')!.state.level).toBe(5)
    expect(phone.reloads).toBe(1)
    phone = await boot(phone.snapshot(), 'kegan')
    expect(phone.reloads).toBe(0)
    expect(phone.useGame.getState().level).toBe(5)

    // Normal play after that saves as usual.
    const writes = serverWrites
    await play(phone, { level: 5, townName: 'Still Phone Town' })
    expect(serverWrites).toBe(writes + 1)
    expect(phone.reloads).toBe(0)
  })
})

describe('reset account', () => {
  it('starts the player on a fresh town that the old one can never replace', async () => {
    let phone = await openGame({})
    phone = await signIn(phone, 'kegan')
    await play(phone, { level: 7, townName: 'Big Town' })
    // The player resets on desktop while a phone tab is still open on the old town.
    let desktop = await openGame(phone.snapshot())
    desktop = await signIn(desktop, 'kegan')
    expect(desktop.useGame.getState().townName).toBe('Big Town')

    const { resetAccount } = await import('./cloud')
    vi.advanceTimersByTime(1000)
    expect(await resetAccount()).toBeNull()
    expect(db.get('kegan')!.state.level).toBe(1)
    expect(db.get('kegan')!.state.townName).toBe('My Town')
    expect(desktop.reloads).toBe(1)

    desktop = await boot(desktop.snapshot(), 'kegan')
    expect(desktop.reloads).toBe(0)
    expect(desktop.useGame.getState().level).toBe(1)
    expect(desktop.useGame.getState().tutorial).toBe(0)
    expect((await import('./cloud')).localBackup()).toBeNull()
    const writes = serverWrites
    await play(desktop, { level: 1, townName: 'Fresh Start' })
    expect(serverWrites).toBe(writes + 1)

    // The old phone tab's next save is refused and it loads the fresh town instead.
    await play(phone, { level: 8, townName: 'Big Town' })
    expect(db.get('kegan')!.state.townName).toBe('Fresh Start')
    expect(phone.reloads).toBe(1)
  })

  it('changes nothing and keeps saving when the server has no reset yet', async () => {
    delete rpcs.reset_my_account
    let phone = await openGame({})
    phone = await signIn(phone, 'kegan')
    await play(phone, { level: 3, townName: 'Kept Town' })
    const { resetAccount } = await import('./cloud')
    expect(await resetAccount()).toContain('reset_my_account')
    expect(phone.reloads).toBe(0)
    expect(db.get('kegan')!.state.townName).toBe('Kept Town')
    await play(phone, { level: 4, townName: 'Kept Town' })
    expect(db.get('kegan')!.state.level).toBe(4)
  })

  it('wipes a guest town in this browser only', async () => {
    const laptop = await openGame({})
    await play(laptop, { level: 4, townName: 'Guest Town' })
    const { resetLocal } = await import('./cloud')
    resetLocal()
    expect(laptop.reloads).toBe(1)
    const after = await boot(laptop.snapshot())
    expect(after.useGame.getState().townName).toBe('My Town')
    expect(after.useGame.getState().level).toBe(1)
  })
})
