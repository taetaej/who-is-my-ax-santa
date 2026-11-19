import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

export const PIN_RE = /^\d{4}$/
export const MAX_FAILS = 5 // [미정] PRD 5.1 — 임시값
export const LOCK_MINUTES = 5 // [미정] PRD 5.1 — 임시값

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(pin, salt, 32)
  return `${salt.toString('base64url')}.${key.toString('base64url')}`
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [saltB64, keyB64] = stored.split('.')
  const expected = Buffer.from(keyB64, 'base64url')
  const actual = await scrypt(pin, Buffer.from(saltB64, 'base64url'), expected.length)
  return timingSafeEqual(actual, expected)
}

// ── 세션 쿠키: base64url(JSON).HMAC ──────────────────────────────
export const COOKIE = 'santa_session'
const MAX_AGE_SEC = 60 * 60 * 24 * 30

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (s) return s
  if (process.env.VERCEL) throw new Error('SESSION_SECRET 가 설정되지 않았어요')
  return 'local-dev-only-secret'
}

const sign = (body: string) => createHmac('sha256', secret()).update(body).digest('base64url')

export type Session = { pid: number; v: number; exp: number }

export function issue(pid: number, v: number): { value: string; maxAge: number } {
  const body = Buffer.from(JSON.stringify({ pid, v, exp: Date.now() + MAX_AGE_SEC * 1000 })).toString('base64url')
  return { value: `${body}.${sign(body)}`, maxAge: MAX_AGE_SEC }
}

export function read(value: string | undefined): Session | null {
  if (!value) return null
  const [body, mac] = value.split('.')
  if (!body || !mac) return null
  const a = Buffer.from(mac)
  const b = Buffer.from(sign(body))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  const s = JSON.parse(Buffer.from(body, 'base64url').toString()) as Session
  return s.exp > Date.now() ? s : null
}
