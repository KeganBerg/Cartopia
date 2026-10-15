import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Two-step sign-in: a 6-digit code from an authenticator app on top of the password.
// Once an account has a verified code app, its admin powers need a session that passed
// the code (public.is_admin() checks the JWT's aal), and the Account tab asks for the
// code right after the password. A refreshed session keeps the level it was signed in at.

type Mfa = SupabaseClient['auth']['mfa']

export type TwoStep = {
  // The verified code app, or null when two-step is off.
  factorId: string | null
  // Signed in with the password only, on an account that has a code app.
  needCode: boolean
}

export type Setup = { factorId: string; qr: string; secret: string }

const mfa = (): Mfa | null => supabase?.auth.mfa ?? null

export async function twoStepState(m: Mfa | null = mfa()): Promise<TwoStep> {
  if (!m) return { factorId: null, needCode: false }
  const [factors, aal] = await Promise.all([m.listFactors(), m.getAuthenticatorAssuranceLevel()])
  const factorId = factors.data?.totp.find((f) => f.status === 'verified')?.id ?? null
  const needCode = !!aal.data && aal.data.currentLevel === 'aal1' && aal.data.nextLevel === 'aal2'
  return { factorId, needCode }
}

// A new code app to scan. Half-finished setups are dropped first, so trying again works.
export async function startSetup(m: Mfa | null = mfa()): Promise<Setup | string> {
  if (!m) return 'No connection'
  const { data } = await m.listFactors()
  for (const f of data?.all ?? []) if (f.factor_type === 'totp' && f.status !== 'verified') await m.unenroll({ factorId: f.id })
  const res = await m.enroll({ factorType: 'totp', friendlyName: `Cartopia ${Date.now()}` })
  if (res.error || !res.data || res.data.type !== 'totp') return res.error?.message ?? 'Could not start two-step'
  return { factorId: res.data.id, qr: qrSrc(res.data.totp.qr_code), secret: res.data.totp.secret }
}

// supabase-js hands the QR as a raw SVG behind a data: prefix; a '#' in it would end the URL.
export function qrSrc(qr: string): string {
  const m = /^data:image\/svg\+xml;[^,]*,/.exec(qr)
  const svg = m ? qr.slice(m[0].length) : qr
  if (!svg.trimStart().startsWith('<')) return qr
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export const cleanCode = (code: string) => code.replace(/\D/g, '').slice(0, 6)

// Checks a code: finishes a setup, or raises a password-only session to two-step.
export async function checkCode(factorId: string, code: string, m: Mfa | null = mfa()): Promise<string | null> {
  if (!m) return 'No connection'
  const c = cleanCode(code)
  if (c.length !== 6) return 'Enter the 6-digit code'
  const { error } = await m.challengeAndVerify({ factorId, code: c })
  if (!error) return null
  const msg = error.message.toLowerCase()
  if (msg.includes('rate') || msg.includes('too many')) return 'Too many tries. Wait a minute.'
  if (msg.includes('expired')) return 'Code expired. Try the next one.'
  return 'Wrong code. Try again.'
}

export async function turnOff(factorId: string, m: Mfa | null = mfa()): Promise<string | null> {
  if (!m) return 'No connection'
  const { error } = await m.unenroll({ factorId })
  return error ? 'Could not turn it off. Try again.' : null
}
