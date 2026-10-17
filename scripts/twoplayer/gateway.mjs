// A stand-in for Supabase's API gateway, for two-player tests on a throwaway local database.
// /auth/v1     password sign-in for local test accounts, HS256 JWTs PostgREST trusts
// /rest/v1     proxied to a local PostgREST, so every RPC, policy and trigger is the real SQL
// /realtime/v1 Phoenix websocket (vsn 2.0.0): broadcast and presence, with private channels
//              authorised by the realtime.messages policies exactly as Supabase does
// Never point this at a real project: it signs its own tokens with a test secret.
import http from 'node:http'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.GATEWAY_PORT ?? 54321)
const REST = process.env.POSTGREST_URL ?? 'http://127.0.0.1:54330'
const PG = { host: '127.0.0.1', port: process.env.PGPORT ?? '54329', db: process.env.PGDATABASE ?? 'cartopia' }
export const JWT_SECRET = process.env.JWT_SECRET ?? 'cartopia-two-player-test-secret-at-least-32-chars'
const log = (...a) => process.env.GATEWAY_QUIET ? null : console.log('[gateway]', ...a)

const b64u = (b) => Buffer.from(b).toString('base64url')
export function sign(claims) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64u(JSON.stringify(claims))
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${sig}`
}
function verify(token) {
  const [h, b, s] = String(token ?? '').split('.')
  if (!s) return null
  const want = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url')
  if (want.length !== s.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(s))) return null
  const c = JSON.parse(Buffer.from(b, 'base64url').toString())
  return c.exp && c.exp * 1000 < Date.now() ? null : c
}
export const anonKey = sign({ role: 'anon', iss: 'local', iat: 1700000000, exp: 4100000000 })

// psql with values passed as variables, never spliced into the SQL text.
function sql(query, vars = {}) {
  const args = ['-h', PG.host, '-p', PG.port, '-U', 'postgres', '-d', PG.db, '-qAtX', '-v', 'ON_ERROR_STOP=1']
  for (const [k, v] of Object.entries(vars)) args.push('-v', `${k}=${v}`)
  return new Promise((res, rej) => {
    const p = execFile('psql', args, (err, out, errOut) => (err ? rej(new Error(errOut || err.message)) : res(out.trim())))
    p.stdin.end(query)
  })
}

// ---- auth ------------------------------------------------------------------------------------
const refresh = new Map()
const userJson = (u) => ({
  id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: u.created_at, phone: '',
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], factors: [],
  created_at: u.created_at, updated_at: u.created_at, is_anonymous: false,
})
function session(u) {
  const now = Math.floor(Date.now() / 1000)
  const sid = crypto.randomUUID()
  const access = sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, aal: 'aal1', amr: [{ method: 'password', timestamp: now }], session_id: sid, is_anonymous: false, iat: now, exp: now + 3600 })
  const rt = crypto.randomBytes(16).toString('hex')
  refresh.set(rt, u)
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: rt, user: userJson(u) }
}
async function findUser(where, val) {
  const row = await sql(`select row_to_json(u) from (select id, email, encrypted_password, created_at from auth.users where ${where} = :'v') u`, { v: val })
  return row ? JSON.parse(row) : null
}

async function auth(req, res, path, body) {
  const url = new URL(req.url, 'http://x')
  if (path === '/token' && url.searchParams.get('grant_type') === 'password') {
    const u = await findUser('email', String(body.email ?? '').toLowerCase())
    if (!u || u.encrypted_password !== body.password) return json(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials' })
    return json(res, 200, session(u))
  }
  if (path === '/token' && url.searchParams.get('grant_type') === 'refresh_token') {
    const u = refresh.get(body.refresh_token)
    if (!u) return json(res, 400, { error: 'invalid_grant', code: 'refresh_token_not_found' })
    return json(res, 200, session(u))
  }
  const claims = verify((req.headers.authorization ?? '').replace(/^Bearer /i, ''))
  if (path === '/user') {
    if (!claims?.sub) return json(res, 401, { code: 'bad_jwt', msg: 'invalid JWT' })
    const u = await findUser('id', claims.sub)
    return u ? json(res, 200, userJson(u)) : json(res, 404, { code: 'user_not_found' })
  }
  if (path === '/logout') return send(res, 204)
  if (path.startsWith('/factors')) return json(res, 200, { all: [], totp: [], phone: [] })
  return json(res, 404, { msg: `not in the local gateway: ${path}` })
}

// ---- http ------------------------------------------------------------------------------------
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
  'access-control-expose-headers': 'content-range, content-profile, x-supabase-api-version',
}
function send(res, code, body = '', headers = {}) {
  res.writeHead(code, { ...cors, ...headers })
  res.end(body)
}
function json(res, code, v) {
  send(res, code, JSON.stringify(v), { 'content-type': 'application/json' })
}
const readBody = (req) => new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c))) })

async function rest(req, res, path, raw) {
  const headers = { ...req.headers }
  delete headers.host
  delete headers['content-length']
  // supabase-js sends the anon key as the bearer when nobody is signed in.
  const r = await fetch(REST + path, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : raw })
  const out = Buffer.from(await r.arrayBuffer())
  const h = {}
  for (const k of ['content-type', 'content-range', 'content-profile', 'preference-applied']) if (r.headers.get(k)) h[k] = r.headers.get(k)
  if (r.status >= 400) log(req.method, path.slice(0, 120), r.status, out.toString().slice(0, 200))
  send(res, r.status, out, h)
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204)
    const u = new URL(req.url, 'http://x')
    const raw = await readBody(req)
    if (u.pathname.startsWith('/auth/v1')) return await auth(req, res, u.pathname.slice(8), raw.length ? JSON.parse(raw) : {})
    if (u.pathname.startsWith('/rest/v1')) return await rest(req, res, req.url.slice(8), raw)
    if (u.pathname === '/realtime/v1/api/broadcast') return await httpBroadcast(req, res, raw.length ? JSON.parse(raw) : {})
    if (u.pathname === '/health') return json(res, 200, { ok: true })
    return json(res, 404, { msg: 'not found' })
  } catch (e) {
    log('error', req.method, req.url, e.message)
    json(res, 500, { msg: e.message })
  }
})

// ---- realtime --------------------------------------------------------------------------------
// topic (without the "realtime:" prefix) -> joined channels; presence keyed per topic.
const topics = new Map()
const presence = new Map()
let refN = 0

// Supabase's check for a private channel: can this user see a broadcast/presence message on the
// topic (read), and may they insert one (write)? Run as the user against the real policies.
async function authorise(topic, claims) {
  if (!/^[\w:.\-]{1,200}$/.test(topic)) return { read: false, write: false }
  const out = await sql(`
begin;
insert into realtime.messages (topic, extension, event, payload) values (:'t', 'broadcast', 'probe', '{}'), (:'t', 'presence', 'probe', '{}');
set local role authenticated;
select set_config('request.jwt.claims', :'c', true), set_config('realtime.topic', :'t', true) \\g /dev/null
select count(*) from realtime.messages where topic = :'t' and event = 'probe';
savepoint w;
insert into realtime.messages (topic, extension, event, payload) values (:'t', 'broadcast', 'probe2', '{}');
select 'write';
rollback;
`, { t: topic, c: JSON.stringify(claims) }).catch((e) => (e.message.includes('row-level security') ? 'nowrite' : Promise.reject(e)))
  // A failed insert aborts psql before 'write' prints; the read count still came out first.
  if (out === 'nowrite') {
    const n = await sql(`
begin;
insert into realtime.messages (topic, extension, event, payload) values (:'t', 'broadcast', 'probe', '{}');
set local role authenticated;
select set_config('request.jwt.claims', :'c', true), set_config('realtime.topic', :'t', true) \\g /dev/null
select count(*) from realtime.messages where topic = :'t' and event = 'probe';
rollback;`, { t: topic, c: JSON.stringify(claims) })
    return { read: Number(n) > 0, write: false }
  }
  const lines = out.split('\n')
  return { read: Number(lines[0]) > 0, write: lines.includes('write') }
}

function push(ws, join_ref, ref, topic, event, payload) {
  if (ws.readyState === 1) ws.send(JSON.stringify([join_ref, ref, topic, event, payload]))
}
function fanOut(topic, event, payload, from) {
  for (const ch of topics.get(topic) ?? []) {
    if (ch === from && !from.self) continue
    push(ch.ws, null, null, `realtime:${topic}`, 'broadcast', { type: 'broadcast', event, payload })
  }
}
function presenceDiff(topic, joins, leaves) {
  for (const ch of topics.get(topic) ?? []) if (ch.presence) push(ch.ws, null, null, `realtime:${topic}`, 'presence_diff', { joins, leaves })
}
function untrack(ch) {
  const p = presence.get(ch.topic)
  const cur = p?.get(ch.key)
  if (!cur || cur.owner !== ch) return
  p.delete(ch.key)
  presenceDiff(ch.topic, {}, { [ch.key]: { metas: [cur.meta] } })
}
function leave(ch) {
  untrack(ch)
  topics.get(ch.topic)?.delete(ch)
  ch.ws.channels.delete(ch.join_ref)
}

async function onMessage(ws, msg) {
  const { join_ref, ref, topic: full, event, payload } = msg
  if (full === 'phoenix' && event === 'heartbeat') return push(ws, null, ref, 'phoenix', 'phx_reply', { status: 'ok', response: {} })
  const topic = String(full).replace(/^realtime:/, '')
  if (event === 'phx_join') {
    const token = payload.access_token ?? ws.token
    const claims = verify(token)
    const cfg = payload.config ?? {}
    let write = true
    if (cfg.private) {
      const a = claims?.role === 'authenticated' ? await authorise(topic, claims) : { read: false, write: false }
      if (!a.read) {
        log('join refused', topic, claims?.email ?? 'anon')
        return push(ws, join_ref, ref, full, 'phx_reply', { status: 'error', response: { reason: 'Unauthorized: You do not have permissions to read from this Channel topic: ' + topic } })
      }
      write = a.write
    }
    const ch = { ws, topic, join_ref, claims, self: !!cfg.broadcast?.self, ack: !!cfg.broadcast?.ack, presence: !!cfg.presence?.enabled, key: cfg.presence?.key || crypto.randomUUID(), write }
    for (const old of [...ws.channels.values()]) if (old.topic === topic) leave(old)
    ws.channels.set(join_ref, ch)
    if (!topics.has(topic)) topics.set(topic, new Set())
    topics.get(topic).add(ch)
    push(ws, join_ref, ref, full, 'phx_reply', { status: 'ok', response: { postgres_changes: [] } })
    push(ws, join_ref, null, full, 'system', { status: 'ok', message: 'Subscribed to Realtime', extension: 'system', channel: topic })
    if (ch.presence) {
      const state = {}
      for (const [k, v] of presence.get(topic) ?? []) state[k] = { metas: [v.meta] }
      push(ws, join_ref, null, full, 'presence_state', state)
    }
    return
  }
  const ch = ws.channels.get(join_ref)
  if (!ch) return push(ws, join_ref, ref, full, 'phx_reply', { status: 'error', response: { reason: 'not joined' } })
  if (event === 'phx_leave') {
    leave(ch)
    return push(ws, join_ref, ref, full, 'phx_reply', { status: 'ok', response: {} })
  }
  if (event === 'access_token') {
    ws.token = payload.access_token
    return
  }
  if (event === 'broadcast') {
    if (ch.write) fanOut(topic, payload.event, payload.payload, ch)
    else log('broadcast refused', topic, payload.event)
    if (ref) push(ws, join_ref, ref, full, 'phx_reply', { status: ch.write ? 'ok' : 'error', response: {} })
    return
  }
  if (event === 'presence') {
    if (payload.event === 'track' && ch.write) {
      untrack(ch)
      const meta = { ...payload.payload, phx_ref: String(++refN) }
      if (!presence.has(topic)) presence.set(topic, new Map())
      presence.get(topic).set(ch.key, { owner: ch, meta })
      presenceDiff(topic, { [ch.key]: { metas: [meta] } }, {})
    } else if (payload.event === 'untrack') untrack(ch)
    return push(ws, join_ref, ref, full, 'phx_reply', { status: 'ok', response: {} })
  }
  push(ws, join_ref, ref, full, 'phx_reply', { status: 'ok', response: {} })
}

// Binary user broadcast push (realtime-js serializer kind 3).
function decodeBinary(buf) {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  if (v.getUint8(0) !== 3) return null
  const [jr, r, t, e, m, enc] = [1, 2, 3, 4, 5, 6].map((i) => v.getUint8(i))
  let o = 7
  const take = (n) => { const s = buf.subarray(o, o + n).toString(); o += n; return s }
  const join_ref = take(jr), ref = take(r), topic = take(t), event = take(e)
  take(m)
  const rest = buf.subarray(o)
  return { join_ref, ref: ref || null, topic, event: 'broadcast', payload: { type: 'broadcast', event, payload: enc === 1 ? JSON.parse(rest.toString() || '{}') : rest } }
}

async function httpBroadcast(req, res, body) {
  const claims = verify((req.headers.authorization ?? '').replace(/^Bearer /i, ''))
  for (const m of body.messages ?? []) {
    if (m.private) {
      const a = claims?.role === 'authenticated' ? await authorise(m.topic, claims) : { write: false }
      if (!a.write) continue
    }
    fanOut(m.topic, m.event, m.payload, null)
  }
  send(res, 202)
}

const wss = new WebSocketServer({ noServer: true })
server.on('upgrade', (req, socket, head) => {
  const u = new URL(req.url, 'http://x')
  if (!u.pathname.startsWith('/realtime/v1/websocket')) return socket.destroy()
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.channels = new Map()
    ws.token = u.searchParams.get('apikey')
    ws.on('message', (data, isBinary) => {
      const msg = isBinary ? decodeBinary(Buffer.from(data)) : (() => { const [join_ref, ref, topic, event, payload] = JSON.parse(data.toString()); return { join_ref, ref, topic, event, payload } })()
      if (msg) onMessage(ws, msg).catch((e) => log('realtime error', e.message))
    })
    ws.on('close', () => { for (const ch of [...ws.channels.values()]) leave(ch) })
  })
})

server.listen(PORT, '127.0.0.1', () => log(`listening on http://127.0.0.1:${PORT}`))
