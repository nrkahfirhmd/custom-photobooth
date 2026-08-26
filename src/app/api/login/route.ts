import { cookies } from 'next/headers'
import { SESSION_COOKIE } from '@/lib/auth'
import { safeEqual, signSession } from '@/lib/crypto'

export async function POST(request: Request) {
  const { password } = await request.json()
  const expected = process.env.ADMIN_PASSWORD

  if (!expected) {
    return Response.json({ error: 'ADMIN_PASSWORD is not set' }, { status: 500 })
  }
  if (typeof password !== 'string' || !safeEqual(password, expected)) {
    return Response.json({ error: 'Wrong password' }, { status: 401 })
  }

  const jar = await cookies()
  jar.set(SESSION_COOKIE, signSession(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  })
  return Response.json({ ok: true })
}

export async function DELETE() {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
  return Response.json({ ok: true })
}
