/** Input validation for anything crossing a trust boundary. No imports on purpose. */

export type Slot = { x: number; y: number; w: number; h: number }

/**
 * Deliberately strict: the address ends up in an outbound SMTP envelope, so reject
 * whitespace (including CR/LF), control characters, and address-list separators.
 */
const EMAIL_RE = /^[^\s@,;:<>"'\\]+@[^\s@,;:<>"'\\]+\.[^\s@,;:<>"'\\]{2,}$/

export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 254) return false
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(value)) return false
  return EMAIL_RE.test(value)
}

/** Keeps only well-formed slots: fractions inside the frame, with real area. */
export function parseSlots(raw: unknown): Slot[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((s) => {
    const num = (v: unknown) =>
      typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN
    const slot = { x: num(s?.x), y: num(s?.y), w: num(s?.w), h: num(s?.h) }
    const inRange = Object.values(slot).every((v) => v >= 0 && v <= 1)
    const hasArea = slot.w > 0 && slot.h > 0
    const fits = slot.x + slot.w <= 1.0001 && slot.y + slot.h <= 1.0001
    return inRange && hasArea && fits ? [slot] : []
  })
}
