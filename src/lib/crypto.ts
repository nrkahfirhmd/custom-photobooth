import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

function requireKey(name: string, bytes?: number) {
  const raw = process.env[name]
  if (!raw) throw new Error(`${name} is not set (see .env.example)`)
  if (bytes) {
    const key = Buffer.from(raw, 'hex')
    if (key.length !== bytes) {
      throw new Error(`${name} must be ${bytes} bytes of hex (got ${key.length})`)
    }
    return key
  }
  return Buffer.from(raw)
}

/**
 * SMTP passwords are real personal credentials (e.g. Gmail app passwords), so they
 * are stored encrypted and only decrypted in memory at send time.
 */
export function encrypt(plain: string): string {
  if (!plain) return ''
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', requireKey('ENCRYPTION_KEY', 32), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join('.')
}

export function decrypt(stored: string): string {
  if (!stored) return ''
  const [iv, tag, enc] = stored.split('.').map((p) => Buffer.from(p, 'base64'))
  if (!iv || !tag || !enc) throw new Error('malformed ciphertext')
  const decipher = createDecipheriv(
    'aes-256-gcm',
    requireKey('ENCRYPTION_KEY', 32),
    iv
  )
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

/** Signed session token: "<expiresAt>.<hmac>". No user table — there is one admin. */
export function signSession(ttlMs = 7 * 24 * 60 * 60 * 1000): string {
  const exp = String(Date.now() + ttlMs)
  return `${exp}.${hmac(exp)}`
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig) return false
  if (!safeEqual(sig, hmac(exp))) return false
  return Number(exp) > Date.now()
}

function hmac(value: string): string {
  return createHmac('sha256', requireKey('SESSION_SECRET'))
    .update(value)
    .digest('hex')
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
