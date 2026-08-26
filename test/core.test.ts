import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { test } from 'node:test'

process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')
process.env.SESSION_SECRET = randomBytes(32).toString('hex')

const { encrypt, decrypt, signSession, verifySession, safeEqual } = await import(
  '../src/lib/crypto.ts'
)
const { isValidEmail, parseSlots } = await import('../src/lib/validate.ts')
const { defaultSlots, slotsFor } = await import('../src/lib/composite.ts')

test('SMTP passwords survive an encrypt/decrypt round trip', () => {
  const secret = 'app-password with spaces & symbols ✉️'
  const stored = encrypt(secret)
  assert.notEqual(stored, secret, 'must not be stored in plaintext')
  assert.equal(decrypt(stored), secret)
  assert.equal(encrypt(''), '')
  assert.equal(decrypt(''), '')
})

test('tampered ciphertext is rejected rather than silently decrypted', () => {
  const stored = encrypt('hunter2')
  const [iv, tag, body] = stored.split('.')
  const flipped = Buffer.from(body, 'base64')
  flipped[0] ^= 0xff
  assert.throws(() => decrypt(`${iv}.${tag}.${flipped.toString('base64')}`))
  assert.throws(() => decrypt('not-valid'))
})

test('session tokens verify, and forged or expired ones do not', () => {
  assert.equal(verifySession(signSession()), true)
  assert.equal(verifySession(undefined), false)
  assert.equal(verifySession(''), false)
  assert.equal(verifySession(`${Date.now() + 10000}.deadbeef`), false)
  assert.equal(verifySession(signSession(-1000)), false, 'expired token must fail')
})

test('safeEqual compares without throwing on length mismatch', () => {
  assert.equal(safeEqual('abc', 'abc'), true)
  assert.equal(safeEqual('abc', 'abd'), false)
  assert.equal(safeEqual('abc', 'much longer string'), false)
})

test('email validation rejects header-injection and malformed input', () => {
  assert.equal(isValidEmail('guest@example.com'), true)
  assert.equal(isValidEmail('first.last+tag@sub.example.co.uk'), true)

  for (const bad of [
    'a@b.com\r\nBcc: victim@example.com', // CRLF header injection
    'a@b.com, other@evil.com', // address list
    'a@b.com<script>',
    'no-at-sign',
    'a@b', // no TLD
    'a b@c.com',
    '',
    null,
    42,
    'x'.repeat(250) + '@example.com', // over 254 chars
  ]) {
    assert.equal(isValidEmail(bad), false, `should reject: ${String(bad)}`)
  }
})

test('parseSlots drops anything outside the frame or without area', () => {
  const good = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 }
  assert.deepEqual(parseSlots([good]), [good])

  assert.deepEqual(parseSlots('nope'), [])
  assert.deepEqual(parseSlots([{ x: -0.1, y: 0, w: 0.5, h: 0.5 }]), [], 'negative x')
  assert.deepEqual(parseSlots([{ x: 0, y: 0, w: 0, h: 0.5 }]), [], 'zero width')
  assert.deepEqual(parseSlots([{ x: 0.8, y: 0, w: 0.5, h: 0.5 }]), [], 'overflows right')
  assert.deepEqual(parseSlots([{ x: 0, y: 0.8, w: 0.5, h: 0.5 }]), [], 'overflows bottom')
  assert.deepEqual(parseSlots([{ x: 'a', y: 0, w: 0.5, h: 0.5 }]), [], 'non-numeric')
  assert.deepEqual(parseSlots([good, { x: 9, y: 9, w: 9, h: 9 }]), [good], 'keeps good')
})

test('default slots stay inside the frame and never overlap', () => {
  for (const count of [1, 2, 3, 4, 6, 12]) {
    const slots = defaultSlots(count)
    assert.equal(slots.length, count)
    assert.equal(parseSlots(slots).length, count, `count ${count} must all be valid`)

    for (let i = 1; i < slots.length; i++) {
      assert.ok(
        slots[i].y >= slots[i - 1].y + slots[i - 1].h,
        `slot ${i} overlaps the one above it`
      )
    }
  }
})

test('slotsFor falls back to defaults when the saved layout does not fit', () => {
  const saved = defaultSlots(3)
  assert.equal(slotsFor(saved, 3), saved, 'matching count is used as-is')
  assert.equal(slotsFor(saved, 4).length, 4, 'stale layout regenerates')
  assert.equal(slotsFor([], 2).length, 2)
  assert.equal(slotsFor(undefined, 5).length, 5)
})
