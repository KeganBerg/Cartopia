import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: null }))
import { checkCode, cleanCode, qrSrc, startSetup, turnOff, twoStepState } from './twoStep'

type F = { id: string; factor_type: string; status: string }
const fakeMfa = (opts: { factors?: F[]; current?: string; next?: string; verifyError?: string; enrollError?: string } = {}) => {
  const factors = opts.factors ?? []
  const m = {
    listFactors: vi.fn(async () => ({ data: { all: factors, totp: factors.filter((f) => f.factor_type === 'totp' && f.status === 'verified') }, error: null })),
    getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: opts.current ?? 'aal1', nextLevel: opts.next ?? 'aal1' }, error: null })),
    unenroll: vi.fn(async () => ({ data: {}, error: null })),
    enroll: vi.fn(async () => opts.enrollError
      ? { data: null, error: { message: opts.enrollError } }
      : { data: { id: 'new', type: 'totp', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'ABC', uri: 'otpauth://x' } }, error: null }),
    challengeAndVerify: vi.fn(async () => ({ data: opts.verifyError ? null : {}, error: opts.verifyError ? { message: opts.verifyError } : null })),
  }
  return m as typeof m & Parameters<typeof twoStepState>[0]
}

describe('two-step sign-in', () => {
  it('asks for the code only on a password-only session of an account with a code app', async () => {
    const on = [{ id: 'f1', factor_type: 'totp', status: 'verified' }]
    expect(await twoStepState(fakeMfa({ factors: on, current: 'aal1', next: 'aal2' }))).toEqual({ factorId: 'f1', needCode: true })
    expect(await twoStepState(fakeMfa({ factors: on, current: 'aal2', next: 'aal2' }))).toEqual({ factorId: 'f1', needCode: false })
    expect(await twoStepState(fakeMfa())).toEqual({ factorId: null, needCode: false })
    expect(await twoStepState(null)).toEqual({ factorId: null, needCode: false })
  })

  it('drops half-finished setups before starting a new one', async () => {
    const m = fakeMfa({ factors: [{ id: 'old', factor_type: 'totp', status: 'unverified' }, { id: 'ok', factor_type: 'totp', status: 'verified' }] })
    expect(await startSetup(m)).toEqual({ factorId: 'new', qr: 'data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E', secret: 'ABC' })
    expect(m.unenroll).toHaveBeenCalledTimes(1)
    expect(m.unenroll).toHaveBeenCalledWith({ factorId: 'old' })
    expect(typeof await startSetup(fakeMfa({ enrollError: 'MFA enroll is disabled' }))).toBe('string')
  })

  it('checks six digits and gives short errors', async () => {
    expect(cleanCode(' 123 456 ')).toBe('123456')
    const m = fakeMfa()
    expect(await checkCode('f1', '12345', m)).toBe('Enter the 6-digit code')
    expect(m.challengeAndVerify).not.toHaveBeenCalled()
    expect(await checkCode('f1', '123 456', m)).toBeNull()
    expect(m.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' })
    expect(await checkCode('f1', '123456', fakeMfa({ verifyError: 'Invalid TOTP code entered' }))).toBe('Wrong code. Try again.')
    expect(await checkCode('f1', '123456', fakeMfa({ verifyError: 'Too many requests' }))).toBe('Too many tries. Wait a minute.')
  })

  it('makes the QR picture a safe data URL', () => {
    expect(qrSrc('data:image/svg+xml;utf-8,<svg fill="#000"/>')).toBe('data:image/svg+xml;charset=utf-8,%3Csvg%20fill%3D%22%23000%22%2F%3E')
    expect(qrSrc('<svg/>')).toBe('data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E')
    expect(qrSrc('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA')
  })

  it('turns off', async () => {
    const m = fakeMfa()
    expect(await turnOff('f1', m)).toBeNull()
    expect(m.unenroll).toHaveBeenCalledWith({ factorId: 'f1' })
  })
})
