// Two signed-in players, two browsers, one local server (scripts/twoplayer/stack.sh up first).
// Plays live challenges end to end: lobby, decline, cancel, accept, the race, results, wager
// holds and payouts, a bet called off before GO, and crew races (crew ladder live race + ghost).
// Player A plays on a desktop-sized window, B on a phone-sized touch screen; --swap flips them.
//   node scripts/twoplayer/play.mjs [--out dir] [--swap] [--hires] [--only lobby,race,wager,void,crew]
// Exit code 1 if any check fails. Screenshots of every step land in --out.
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const OUT = arg('--out', 'twoplayer-out')
const ONLY = arg('--only', '')?.split(',').filter(Boolean)
const SWAP = process.argv.includes('--swap')
const GAME = process.env.GAME_URL ?? 'http://127.0.0.1:5199/'
const PG = ['-h', '127.0.0.1', '-p', process.env.PGPORT ?? '54329', '-U', 'postgres', '-d', 'cartopia', '-qAtX', '-v', 'ON_ERROR_STOP=1']
mkdirSync(OUT, { recursive: true })
const want = (s) => !ONLY.length || ONLY.includes(s)

const sql = (q) => execFileSync('psql', [...PG, '-c', q]).toString().trim()
// Values go in as psql variables (:'name'), never spliced into the SQL.
const sqlv = (q, vars) => execFileSync('psql', [...PG, ...Object.entries(vars).flatMap(([k, v]) => ['-v', `${k}=${v}`])], { input: q }).toString().trim()
const json = (q) => { const r = sql(q); return r ? JSON.parse(r) : null }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const T0 = Date.now()
const since = () => `${((Date.now() - T0) / 1000).toFixed(0)}s`
let failed = 0
const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}  [${since()}]`)
}

// Swiftshader's cost is per pixel, so the phone draws at 1x unless --hires (sharper screenshots, slower).
const HIRES = process.argv.includes('--hires')
const FORMS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: HIRES ? 2 : 1, isMobile: true, hasTouch: true },
}
const PLAYERS = [
  { key: 'a', email: 'ava@test.local', uid: 'aaaaaaaa-0000-4000-8000-000000000001', town: 'Ava Falls', form: SWAP ? 'phone' : 'desktop', car: 'gtr' },
  { key: 'b', email: 'ben@test.local', uid: 'bbbbbbbb-0000-4000-8000-000000000002', town: 'Ben Harbor', form: SWAP ? 'desktop' : 'phone', car: 'gtr' },
]
const PASSWORD = 'racer-pass'

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
})

let shotN = 0
const shot = async (p, name) => {
  const file = `${OUT}/${String(++shotN).padStart(2, '0')}-${p.form}-${p.key}-${name}.png`
  if (process.env.VERBOSE) console.log(`  shot ${file} [${since()}]`)
  await p.page.screenshot({ path: file }).catch(() => {})
  return file
}
// Chromium sometimes drops an in-page await under load ("Resulting promise was garbage collected"),
// mostly on a dynamic import. Every call here is safe to repeat, so it is tried again.
const game = async (p, fn, a) => {
  for (let i = 0; ; i++) {
    try {
      return await p.page.evaluate(fn, a)
    } catch (e) {
      if (i >= 2 || !/garbage collected/.test(e.message)) throw e
      if (process.env.VERBOSE) console.log(`  ${p.key} retry after: ${e.message.split('\n')[0]} [${since()}]`)
    }
  }
}
const state = (p) => game(p, () => { const s = window.__game.getState(); return { coins: s.coins, level: s.level, wagers: s.wagers ?? 0, xp: s.xp, panel: s.panel } })
const live = (p) => game(p, async () => { const l = (await import('/src/lib/live.ts')).useLive.getState(); return { players: l.players.map((x) => x.town), invites: l.invites.length, outgoing: !!l.outgoing, race: l.race && { raceId: l.race.raceId, host: l.race.host, stake: l.race.stake ?? 0 } } })
// Taps and clicks go to the element as a DOM click. Swiftshader draws the game at about one frame a
// second in a container, and Playwright's real pointer input waits on frames, so a real tap there
// takes many seconds. The race itself is driven from inside the page, see drive().
const press = async (p, loc) => {
  if (process.env.VERBOSE) console.log(`  ${p.key} press ${loc} [${since()}]`)
  await loc.waitFor({ timeout: 30000 })
  // A page busy drawing a race screen can take a while to run the click.
  await loc.evaluate((el) => el.click(), null, { timeout: 90000 })
}

async function open(p) {
  p.ctx = await browser.newContext(FORMS[p.form])
  p.ctx.setDefaultTimeout(20000)
  p.page = await p.ctx.newPage()
  p.errors = []
  p.lastLoad = Date.now()
  p.page.on('load', () => { p.lastLoad = Date.now(); if (process.env.VERBOSE) console.log(`  ${p.key} page loaded [${since()}]`) })
  p.page.on('pageerror', (e) => { p.errors.push(e.message); console.log(`[${p.key}] pageerror`, e.message) })
  p.page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|WebSocket|net::ERR/.test(m.text())) p.errors.push(m.text()) })
  await p.page.addInitScript(() => {
    localStorage.setItem('cartopia-flash-warning-hide', '1')
    // Toasts are kept for the checks: the game removes them after a few seconds.
    window.__toasts = []
    const id = setInterval(() => {
      if (!window.__game) return
      clearInterval(id)
      window.__game.subscribe((s, prev) => { for (const x of s.toasts) if (!prev.toasts.some((y) => y.id === x.id)) window.__toasts.push(x.text) })
    }, 50)
  })
  await p.page.goto(`${GAME}?time=0.4&season=fall`)
  await p.page.waitForFunction(() => window.__game, null, { timeout: 180000 })
}

// Fresh accounts on the local server each run, with a level 20 save holding coins to bet. The save
// starts from the game's own new-town save and goes straight onto the server row (local test
// database only) before signing in, so sign-in loads it like any returning player's town.
async function setup(p) {
  sql(`delete from auth.users where id = '${p.uid}'`)
  sql(`insert into auth.users (id, email, encrypted_password) values ('${p.uid}', '${p.email}', '${PASSWORD}')`)
  await open(p)
  const fresh = await game(p, () => JSON.parse(localStorage.getItem('cartopia-save') ?? '{}').state)
  if (!fresh?.cars) throw new Error('no new-town save to start from')
  const car = { uid: `${p.key}-race`, color: p.key === 'a' ? '#e53935' : '#1e88e5', model: p.car, upgrades: { engine: 3, turbo: 3, tires: 3, weight: 3 } }
  const save = { ...fresh, townName: p.town, level: 20, coins: 300000, tutorial: 99, fuel: 60, cars: [...fresh.cars, car], raceCar: car.uid, updatedAt: Date.now() }
  sqlv(`insert into game_saves (owner_id, state) values (:'uid', :'st'::jsonb)`, { uid: p.uid, st: JSON.stringify(save) })
  const err = await game(p, async ([email, password]) => {
    const { supabase } = await import('/src/lib/supabase.ts')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }, [p.email, PASSWORD])
  if (err) throw new Error(`sign in ${p.email}: ${err}`)
  const seeded = () => window.__game?.getState().level === 20 && window.__game.getState().coins >= 300000
  await settle(p, seeded)
  // One save round trip now, so a one-off server correction to a seeded save (and the reload that
  // follows it) lands here, not on a result screen later.
  await game(p, () => window.__game.setState({ updatedAt: Date.now() }))
  // Then wait for the town to sit still: no reload for 20 s.
  const t0 = Date.now()
  do {
    await wait(5000)
    await settle(p, seeded)
  } while (Date.now() - p.lastLoad < 20000 && Date.now() - t0 < 180000)
  // The town behind the menus isn't under test: stop drawing it, as a covering menu does on a phone.
  // Two swiftshader towns at ~1 fps each starve the CPU, and a challenge only lives 45 s.
  await game(p, async () => { window.__townDraw = (await import('/src/scene/renderGate.ts')).pauseTownDraw() })
}

// Waits for a condition across the game's own reloads (each one throws away the page's context).
async function settle(p, fn, ms = 180000) {
  const until = Date.now() + ms
  for (;;) {
    try {
      await p.page.waitForFunction(fn, null, { timeout: Math.max(1000, until - Date.now()) })
      return
    } catch (e) {
      if (Date.now() > until || !/context was destroyed|navigation|detached|Target closed|garbage collected/i.test(e.message)) throw e
      await p.page.waitForLoadState('load').catch(() => {})
    }
  }
}

async function openQuick(p) {
  await game(p, async () => (await import('/src/ui/raceNav.ts')).openRaceTab('quick'))
  await p.page.locator('.race-panel').waitFor({ timeout: 30000 })
}
const bell = (p) => p.page.locator('.challenge-bell:visible')
const closePanels = (p) => game(p, () => window.__game.getState().openPanel(null))
const liveCard = (p, other) => p.page.locator('.rm-qc-live', { hasText: other.town })

// Holds the pedal on the line (let go if the revs pass the green), then shifts on every green light,
// through the race's keyboard controls (space: pedal and SHIFT). It runs inside the page, frame by
// frame: at the container's one frame a second, a driver outside the page would always shift late.
async function drive(p, until) {
  await game(p, () => {
    if (window.__driving) return
    window.__driving = true
    // Race time as the race counts it (at most 0.1 s a frame), for pace() below.
    window.__gt = 0
    let last = performance.now()
    let held = false
    const key = (type) => window.dispatchEvent(new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true }))
    const loop = () => {
      const now = performance.now()
      window.__gt += Math.min(0.1, (now - last) / 1000)
      last = now
      // Held back by pace(): one long frame, so this page draws fewer race frames for a while.
      if (window.__hold) { while (performance.now() - now < 800); }
      const b = document.querySelector('.shift-btn')
      if (!b || document.querySelector('.rr-card')) {
        if (held) key('keyup')
        held = false
        window.__driving = false
        return
      }
      const c = b.className
      if (!b.disabled) {
        if (c.includes('launch')) {
          if (!held && !c.includes(' now') && !c.includes(' late')) { key('keydown'); held = true } else if (held && c.includes(' late')) { key('keyup'); held = false }
        } else {
          if (held) { key('keyup'); held = false }
          if (c.includes(' now')) { key('keydown'); key('keyup') }
        }
      }
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })
  const t0 = Date.now()
  while (!(await until()) && Date.now() - t0 < 900000) await wait(1000)
}
// Keeps two racing pages level. The race runs on frames (at most 0.1 s of race a frame), and in the
// container one page can draw slower than the other, so its racer would cross the line minutes of
// real time later and lose by forfeit (the server waits 45 s). On a real phone both run in real time.
async function pace(a, b) {
  const gt = (p) => game(p, () => (window.__driving ? window.__gt : null)).catch(() => null)
  const hold = (p, on) => game(p, (v) => { window.__hold = v }, on).catch(() => {})
  for (let seen = false, t0 = Date.now(); Date.now() - t0 < 900000;) {
    await wait(1000)
    const [ta, tb] = await Promise.all([gt(a), gt(b)])
    if (ta === null || tb === null) {
      if (seen) break
      continue
    }
    seen = true
    await Promise.all([hold(a, ta - tb > 0.3), hold(b, tb - ta > 0.3)])
  }
  await Promise.all([hold(a, false), hold(b, false)])
}
const resultUp = (p) => async () => (await p.page.locator('.rr-card').count()) > 0

// One challenge from `from` to `to`, accepted from the bell. stake: a wager race.
async function challengeAndAccept(from, to, { stake, tag }) {
  await openQuick(from)
  const card = liveCard(from, to)
  await card.waitFor({ timeout: 30000 })
  if (stake) {
    await press(from, card.locator('.rm-bet-btn'))
    await shot(from, `${tag}-stakes`)
    await press(from, from.page.locator('.rm-bet-chip', { hasText: `🪙${stake >= 1000 ? `${stake / 1000}K` : stake}` }))
  } else await press(from, card.locator('button[title="Drag race"]'))
  // No screenshots between send and accept: at the container's ~1 fps each one costs seconds of
  // the 45 s invite window (the lobby run already shoots the invite).
  await bell(to).waitFor({ timeout: 30000 })
  await press(to, bell(to))
  const inv = to.page.locator('.rival.invite', { hasText: from.town })
  await inv.waitFor({ timeout: 60000 })
  await press(to, inv.locator('.invite-actions .buy'))
}

async function race(a, b, tag) {
  await Promise.all([a, b].map((p) => p.page.locator('.shift-btn').waitFor({ timeout: 90000 })))
  const lineShot = Promise.all([shot(a, `${tag}-line`), shot(b, `${tag}-line`)])
  const midShot = Promise.all([a, b].map(async (p) => {
    await p.page.waitForFunction(() => !document.querySelector('.shift-btn.launch'), null, { timeout: 120000 }).catch(() => {})
    await wait(4000)
    await shot(p, `${tag}-racing`)
  }))
  await Promise.all([drive(a, resultUp(a)), drive(b, resultUp(b)), pace(a, b)])
  await lineShot
  await midShot
  await wait(2500)
  return Promise.all([a, b].map(async (p) => {
    await shot(p, `${tag}-result`)
    return game(p, () => ({
      title: document.querySelector('.rr-title')?.textContent,
      won: !!document.querySelector('.rr.win'),
      bet: document.querySelector('.rr-bet')?.textContent ?? null,
      note: document.querySelector('.rr-note')?.textContent ?? null,
      times: [...document.querySelectorAll('.rr-times span')].map((s) => s.textContent),
    }))
  }))
}
const collect = async (p) => {
  const btn = p.page.locator('.rr-go')
  if (await btn.count()) await press(p, btn.first())
  await wait(1500)
  // A first win's prize card ("New colour!"): a player taps Nice! before the next race.
  const nice = p.page.locator('.ms-prize button', { hasText: 'Nice!' })
  if (await nice.count()) await press(p, nice.first())
}

const [A, B] = PLAYERS
try {
  console.log(`A ${A.town} on ${A.form}, B ${B.town} on ${B.form}`)
  await Promise.all([setup(A), setup(B)])
  check('both players signed in with level 20 saves', (await state(A)).level === 20 && (await state(B)).level === 20)

  // ---- lobby --------------------------------------------------------------------------------
  await Promise.all([openQuick(A), openQuick(B)])
  const sees = await Promise.all([liveCard(A, B).waitFor({ timeout: 30000 }).then(() => true, () => false), liveCard(B, A).waitFor({ timeout: 30000 }).then(() => true, () => false)])
  await Promise.all([shot(A, 'lobby'), shot(B, 'lobby')])
  check('lobby: each player sees the other as LIVE', sees[0] && sees[1], JSON.stringify([(await live(A)).players, (await live(B)).players]))
  const cardText = await liveCard(A, B).textContent().catch(() => '')
  check('lobby: card shows the server level and PI', /Lv 20/.test(cardText) && /PI \d+/.test(cardText), cardText)

  if (want('lobby')) {
    // Decline: A challenges, B says no, A hears about it and can't re-challenge straight away.
    await press(A, liveCard(A, B).locator('button[title="Drag race"]'))
    await bell(B).waitFor({ timeout: 30000 })
    check('decline: challenge reaches the other player (bell)', true)
    await press(B, bell(B))
    await B.page.locator('.rival.invite').waitFor({ timeout: 60000 })
    await shot(B, 'decline-invite')
    await press(B, B.page.locator('.rival.invite .invite-actions .sell'))
    await A.page.waitForFunction(() => window.__toasts.some((t) => String(t).includes('declined')), null, { timeout: 60000 }).then(() => check('decline: challenger is told', true), () => check('decline: challenger is told', false))
    await shot(A, 'decline-cooldown')
    const soon = await liveCard(A, B).locator('button[title="Drag race"]').textContent().catch(() => '')
    check('decline: re-challenge waits (cooldown)', soon.includes('Soon'), soon)
    await closePanels(B)

    // Cancel: B challenges A, then calls it off; A's invite goes away.
    await openQuick(B)
    await press(B, liveCard(B, A).locator('button[title="Drag race"]'))
    await bell(A).waitFor({ timeout: 30000 })
    await shot(B, 'cancel-waiting')
    await press(B, liveCard(B, A).locator('button', { hasText: 'Cancel' }))
    const gone = await A.page.waitForFunction(() => ![...document.querySelectorAll('.challenge-bell')].some((b) => b.offsetParent), null, { timeout: 60000 }).then(() => true, () => false)
    check('cancel: invite disappears for the other player', gone)
    await Promise.all([closePanels(A), closePanels(B)])
  }

  if (want('race')) {
    // A plain live race, B challenges (A's cooldown on B is still running).
    const before = await Promise.all([state(A), state(B)])
    await challengeAndAccept(B, A, { tag: 'race' })
    const [ra, rb] = await race(B, A, 'race')
    const raceId = (await live(A)).race?.raceId ?? (await live(B)).race?.raceId
    const row = json(`select row_to_json(r) from (select id, a, b, a_t, b_t, winner, forfeit, void from live_races order by created_at desc limit 1) r`)
    check('race: both result screens show', !!ra.title && !!rb.title, `${ra.title} / ${rb.title}`)
    check('race: exactly one winner', ra.won !== rb.won, `${B.town} ${ra.won ? 'won' : 'lost'}, ${A.town} ${rb.won ? 'won' : 'lost'}`)
    check('race: server refereed it (both times in)', row && row.a_t !== null && row.b_t !== null && row.winner, JSON.stringify(row))
    const serverWinner = row?.winner === B.uid ? 'b' : row?.winner === A.uid ? 'a' : null
    check('race: screens agree with the server winner', (serverWinner === 'b' && ra.won) || (serverWinner === 'a' && rb.won), serverWinner)
    await Promise.all([collect(A), collect(B)])
    await wait(4000)
    const after = await Promise.all([state(A), state(B)])
    check('race: both got paid coins', after[0].coins > before[0].coins && after[1].coins > before[1].coins, `${A.town} ${before[0].coins}->${after[0].coins}, ${B.town} ${before[1].coins}->${after[1].coins}`)
    check('race: live state cleared after', !(await live(A)).race && !(await live(B)).race, raceId)
    await Promise.all([shot(A, 'race-after'), shot(B, 'race-after')])
  }

  // Coins as the server counts them (save coins + ledger rows not yet claimed - debt).
  const serverCoins = (p) => Number(sql(`select econ_private.wager_coins('${p.uid}')`))
  const ledger = (p, raceId) => json(`select coalesce(json_agg(json_build_object('kind', kind, 'delta', delta) order by seq), '[]') from wager_ledger where owner_id = '${p.uid}' and race_id = '${raceId}'`)
  const lastWager = () => json(`select row_to_json(w) from (select race_id, stake, status, started_at is not null as started from wagers order by created_at desc limit 1) w`)
  const savedWagers = (p) => json(`select json_build_object('wagers', coalesce((state->>'wagers')::int, 0), 'coins', (state->>'coins')::numeric, 'top', (select coalesce(max(seq), 0) from wager_ledger where owner_id = '${p.uid}'), 'debt', coalesce((econ->>'wager_debt')::numeric, 0)) from game_saves where owner_id = '${p.uid}'`)

  if (want('wager')) {
    // A bets 2K on a race with B. Both stakes are held at accept, the winner takes 4K.
    const STAKE = 2000
    await wait(2000)
    const before = await Promise.all([state(A), state(B)])
    await challengeAndAccept(A, B, { stake: STAKE, tag: 'wager' })
    await Promise.all([A, B].map((p) => p.page.locator('.rf-pot').waitFor({ timeout: 60000 }).then(() => true, () => false))).then((r) => check('wager: both race screens show the pot', r[0] && r[1]))
    const heldBoth = async () => { const h = await Promise.all([state(A), state(B)]); return h[0].coins === before[0].coins - STAKE && h[1].coins === before[1].coins - STAKE }
    for (let t0 = Date.now(); !(await heldBoth()) && Date.now() - t0 < 20000;) await wait(1000)
    const held = await Promise.all([state(A), state(B)])
    check('wager: stake held from both players', held[0].coins === before[0].coins - STAKE && held[1].coins === before[1].coins - STAKE, `${before[0].coins}->${held[0].coins}, ${before[1].coins}->${held[1].coins}`)
    const [ra, rb] = await race(A, B, 'wager')
    const w = lastWager()
    check('wager: server settled the bet', w?.status === 'settled' && w.started, JSON.stringify(w))
    const winner = ra.won ? A : B
    const loser = ra.won ? B : A
    const lw = ledger(winner, w.race_id)
    const ll = ledger(loser, w.race_id)
    check('wager: ledger holds both stakes and pays the winner double', JSON.stringify(lw) === JSON.stringify([{ kind: 'hold', delta: -STAKE }, { kind: 'win', delta: 2 * STAKE }]) && JSON.stringify(ll) === JSON.stringify([{ kind: 'hold', delta: -STAKE }]), `${winner.town} ${JSON.stringify(lw)} ${loser.town} ${JSON.stringify(ll)}`)
    check('wager: result cards show +/- the stake', (ra.won ? ra : rb).bet?.includes(`+${STAKE.toLocaleString()}`) && (ra.won ? rb : ra).bet?.includes(`−${STAKE.toLocaleString()}`), `${ra.bet} / ${rb.bet}`)
    await Promise.all([collect(A), collect(B)])
    await wait(6000)
    const after = await Promise.all([state(A), state(B)])
    const [wi, li] = ra.won ? [0, 1] : [1, 0]
    check('wager: winner ends up the stake ahead (plus race pay)', after[wi].coins - before[wi].coins >= STAKE, `${before[wi].coins}->${after[wi].coins}`)
    check('wager: loser ends up the stake down (plus race pay)', after[li].coins - before[li].coins < 0 && after[li].coins - before[li].coins >= -STAKE, `${before[li].coins}->${after[li].coins}`)
    for (const p of [A, B]) {
      const sv = savedWagers(p)
      check(`wager: ${p.town}'s save claimed every ledger row, no debt`, sv.wagers === sv.top && sv.debt === 0, JSON.stringify(sv))
      check(`wager: ${p.town}'s coins match the server`, serverCoins(p) === (await state(p)).coins, `server ${serverCoins(p)} vs game ${(await state(p)).coins}`)
    }
    await Promise.all([shot(A, 'wager-after'), shot(B, 'wager-after')])
  }

  if (want('void')) {
    // B bets 500, A accepts while B's connection is down, so B never joins: A calls the race off
    // from the line and both stakes come back.
    const STAKE = 500
    await wait(2000)
    const before = await Promise.all([state(A), state(B)])
    await openQuick(B)
    const card = liveCard(B, A)
    await card.waitFor({ timeout: 30000 })
    await press(B, card.locator('.rm-bet-btn'))
    await press(B, B.page.locator('.rm-bet-chip', { hasText: `🪙${STAKE}` }))
    await bell(A).waitFor({ timeout: 30000 })
    await B.ctx.setOffline(true)
    await press(A, bell(A))
    await press(A, A.page.locator('.rival.invite .invite-actions .buy'))
    await A.page.locator('.rf-wait').waitFor({ timeout: 30000 })
    await shot(A, 'void-waiting')
    await press(A, A.page.locator('.rf-wait button', { hasText: 'Cancel race' }))
    await wait(4000)
    const w = lastWager()
    check('void: bet called off before GO is refunded on the server', w?.status === 'settled' && !w.started && JSON.stringify(ledger(A, w.race_id)) === JSON.stringify([{ kind: 'hold', delta: -STAKE }, { kind: 'refund', delta: STAKE }]) && JSON.stringify(ledger(B, w.race_id)) === JSON.stringify([{ kind: 'hold', delta: -STAKE }, { kind: 'refund', delta: STAKE }]), JSON.stringify(w))
    for (let t0 = Date.now(); (await state(A)).coins !== before[0].coins && Date.now() - t0 < 20000;) await wait(1000)
    check('void: the player who stayed gets the stake straight back', (await state(A)).coins === before[0].coins, `${before[0].coins}->${(await state(A)).coins}`)
    await shot(A, 'void-after')
    await B.ctx.setOffline(false)
    // B's challenge times out; coming back, the hold and refund net to nothing.
    await wait(50000)
    await game(B, async () => (await import('/src/lib/wagers.ts')).syncWagers())
    await wait(1500)
    check('void: the dropped player is not out of pocket', (await state(B)).coins === before[1].coins, `${before[1].coins}->${(await state(B)).coins}`)
    check('void: the dropped player is not left waiting on the line', !(await live(B)).race, JSON.stringify((await live(B)).race))
    await shot(B, 'void-back')
    await Promise.all([closePanels(A), closePanels(B)])
  }

  if (want('crew')) {
    // A starts a crew and B joins; on the crew ladder each sees the other with a ⚡ Live button.
    const crewId = await game(A, async () => (await import('/src/lib/clans.ts')).createClan({ name: 'Pit Wall', tag: 'PIT', emblem: '🏁', color: '#1e88e5', description: 'Two-player test crew', minLevel: 1 }))
    await game(B, async (id) => (await import('/src/lib/clans.ts')).joinClan(id), crewId)
    check('crew: both players in one crew', Number(sql(`select count(*) from clan_members where clan_id = '${crewId}'`)) === 2)
    const ladder = async (p) => {
      await game(p, () => window.__game.getState().openPanel('clan'))
      await p.page.locator('.cr-tabs').waitFor({ timeout: 30000 })
      await press(p, p.page.locator('.cr-tabs button', { hasText: 'Ladder' }))
      await wait(3000)
    }
    await Promise.all([ladder(A), ladder(B)])
    await Promise.all([shot(A, 'crew-ladder'), shot(B, 'crew-ladder')])
    // Each crewmate's button shows twice: on the podium and in the next-up bar.
    const liveBtn = A.page.locator('.cl-race.live').first()
    check('crew: ladder offers a live race with the crewmate', (await A.page.locator('.cl-race.live').count()) > 0 && (await B.page.locator('.cl-race.live').count()) > 0)
    const pts = () => Number(sql(`select coalesce(sum(points), 0) from battle_points where clan_id = '${crewId}'`) || 0)
    const ptsBefore = pts()
    await press(A, liveBtn)
    await bell(B).waitFor({ timeout: 30000 })
    await press(B, bell(B))
    await press(B, B.page.locator('.rival.invite .invite-actions .buy'))
    const [ra, rb] = await race(A, B, 'crew')
    check('crew: live crew race finishes with one winner', ra.won !== rb.won, `${ra.title} / ${rb.title}`)
    await Promise.all([collect(A), collect(B)])
    await wait(3000)
    const liveWins = Number(sql(`select coalesce(sum(live), 0) from battle_points where clan_id = '${crewId}'`) || 0)
    check('crew: the live win scores crew battle points', liveWins === 1 && pts() > ptsBefore, `${ptsBefore} -> ${pts()} points, ${liveWins} live`)
    // Ghost race: B races A's ghost from the ladder (A's live run above set A's time).
    await closePanels(A)
    await ladder(B)
    // Ghost race: A leaves the lobby, so B's ladder offers A's ghost instead of a live race.
    await game(A, async () => (await import('/src/lib/live.ts')).leaveLobby())
    for (let t0 = Date.now(); (await live(B)).players.includes(A.town) && Date.now() - t0 < 30000;) await wait(1000)
    check('crew: the other player sees the crewmate leave the lobby', !(await live(B)).players.includes(A.town))
    await closePanels(B)
    await ladder(B)
    const ghostBtn = B.page.locator('.cl-race:not(.live)').first()
    check('crew: ladder falls back to the ghost when the crewmate is offline', (await B.page.locator('.cl-race:not(.live)').count()) > 0 && !(await B.page.locator('.cl-race.live').count()))
    await shot(B, 'crew-ghost-ladder')
    const runsBefore = Number(sql(`select count(*) from ghost_runs where owner_id = '${B.uid}'`))
    await press(B, ghostBtn)
    await B.page.locator('.shift-btn').waitFor({ timeout: 60000 })
    await shot(B, 'crew-ghost-line')
    await drive(B, resultUp(B))
    await wait(2500)
    await shot(B, 'crew-ghost-result')
    check('crew: ghost race result shows', (await B.page.locator('.rr-card').count()) === 1)
    await collect(B)
    await wait(3000)
    check('crew: ghost run timed by the server', Number(sql(`select count(*) from ghost_runs where owner_id = '${B.uid}'`)) > runsBefore)
  }
} catch (e) {
  check('harness ran to the end', false, e.message.split('\n').slice(0, 12).join(' / '))
  console.log(e.stack?.split('\n').filter((l) => l.includes('play.mjs')).join('\n'))
  for (const p of PLAYERS) if (p.page) await shot(p, 'crash')
} finally {
  for (const p of PLAYERS) check(`${p.town}: no page errors`, !p.errors?.length, p.errors?.slice(0, 3).join(' | '))
  console.log(`\n${results.length - failed}/${results.length} checks passed`)
  await browser.close()
  process.exit(failed ? 1 : 0)
}
