// Crash and error reports from players' devices (src/lib/errorReport.ts).
// Every report is logged (Netlify > Logs > Functions > client-error). With VITE_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY set and the client_errors table live, it is also kept there.
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null)

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 })
  const raw = await req.text()
  if (raw.length > 8000) return new Response(null, { status: 413 })
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return new Response(null, { status: 400 })
  }
  const row = {
    kind: str(body.kind, 20),
    message: str(body.message, 500),
    stack: str(body.stack, 2000),
    build: str(body.build, 20),
    url: str(body.url, 200),
    ua: str(body.ua, 300),
  }
  if (!row.message) return new Response(null, { status: 400 })
  console.error('client-error', JSON.stringify(row))

  const url = process.env.VITE_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && service) {
    try {
      await fetch(`${url}/rest/v1/client_errors`, {
        method: 'POST',
        headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(4000),
      })
    } catch {
      // The log line above still has it.
    }
  }
  return new Response(null, { status: 204 })
}
