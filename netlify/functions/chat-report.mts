// A player's 🚩 Report on a chat message (src/lib/chat.ts reportChat). Files it as that player
// through chat_report (supabase/migrations/0118_chat_reports.sql), which checks they can see the
// message and keeps a copy for the admin panel, then emails support so nobody has to be watching.
// Needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY; the email also needs RESEND_API_KEY
// (resend.com, cartopia.lol verified there). REPORT_EMAIL overrides support@cartopia.lol.
const REASON: Record<string, string> = { mean: '😠 Mean', spam: '📢 Spam', unsafe: '⚠️ Unsafe' }
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 })
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  const auth = req.headers.get('authorization')
  if (!url || !anon) return Response.json({ error: 'offline' }, { status: 503 })
  if (!auth?.startsWith('Bearer ')) return Response.json({ error: 'sign in' }, { status: 401 })
  let body: { id?: unknown; reason?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response(null, { status: 400 })
  }

  const res = await fetch(`${url}/rest/v1/rpc/chat_report`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_id: body.id, p_reason: body.reason }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    return Response.json({ error: err.message ?? 'failed' }, { status: 400 })
  }
  const r = await res.json() as { new: boolean; reason: string; room: string; body: string; reported: string; reporter: string; reports: number; open: number }

  const key = process.env.RESEND_API_KEY
  if (r.new && key) {
    const to = process.env.REPORT_EMAIL || 'support@cartopia.lol'
    try {
      const sent = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Cartopia Reports <reports@cartopia.lol>',
          to,
          subject: `🚩 Chat report: ${r.reported} (${REASON[r.reason] ?? r.reason})`,
          html: `<p><b>${esc(r.reported)}</b> in ${esc(r.room)} chat:</p>`
            + `<blockquote style="font-size:16px">${esc(r.body)}</blockquote>`
            + `<p>${esc(REASON[r.reason] ?? r.reason)} · reported by ${esc(r.reporter)} · ${r.reports} report(s) on this message · ${r.open} open in total</p>`
            + `<p>Open Cartopia › Menu › 🛡 Admin › 🚩 Reports to delete, mute or dismiss.</p>`,
        }),
        signal: AbortSignal.timeout(5000),
      })
      if (!sent.ok) console.error('resend', sent.status, (await sent.text()).slice(0, 300))
    } catch (e) {
      console.error('resend', (e as Error).message)
    }
  }
  return Response.json({ ok: true, new: r.new })
}
