import { cookies } from 'next/headers'
import { verifySession } from './crypto'

export const SESSION_COOKIE = 'pb_admin'

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies()
  return verifySession(jar.get(SESSION_COOKIE)?.value)
}

/** For API routes: returns a 401 Response when not signed in, otherwise null. */
export async function requireAdmin(): Promise<Response | null> {
  if (await isAdmin()) return null
  return Response.json({ error: 'unauthorized' }, { status: 401 })
}
