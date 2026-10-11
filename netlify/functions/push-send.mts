// Scheduled every minute (netlify.toml): sends the push alerts that are due.
// Needs Netlify env vars VITE_VAPID_PUBLIC_KEY, plus SUPABASE_SERVICE_ROLE_KEY and
// VAPID_PRIVATE_KEY (both secret); does nothing until they are set.
import webpush from 'web-push'

type Due = { kind: string; title: string; body: string; endpoint: string; p256dh: string; auth: string }

export default async () => {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const vapid = process.env.VAPID_PRIVATE_KEY
  const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY
  if (!url || !key || !vapid || !vapidPublic) return new Response('push not configured', { status: 200 })
  // New-style secret keys (sb_secret_...) go in apikey only; legacy service_role JWTs also as a bearer token.
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' }
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`

  const res = await fetch(`${url}/rest/v1/rpc/push_take_due`, { method: 'POST', headers, body: '{}' })
  if (!res.ok) return new Response(`take_due failed: ${res.status} ${await res.text()}`, { status: 500 })
  const due = (await res.json()) as Due[]
  if (!due.length) return new Response('nothing due')

  webpush.setVapidDetails('https://cartopia.lol', vapidPublic, vapid)
  const gone: string[] = []
  let sent = 0
  await Promise.all(due.map(async (d) => {
    try {
      await webpush.sendNotification(
        { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
        JSON.stringify({ title: d.title, body: d.body, tag: d.kind }),
        { TTL: 60 * 60, urgency: 'normal' },
      )
      sent++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      // The device unsubscribed or the browser dropped it: forget it.
      if (status === 404 || status === 410) gone.push(d.endpoint)
      else console.error('push failed', status, (e as Error).message)
    }
  }))
  if (gone.length) {
    const list = gone.map((g) => `"${g.replace(/"/g, '')}"`).join(',')
    await fetch(`${url}/rest/v1/push_subscriptions?endpoint=in.(${encodeURIComponent(list)})`, { method: 'DELETE', headers })
  }
  return new Response(`sent ${sent}/${due.length}, dropped ${gone.length}`)
}
