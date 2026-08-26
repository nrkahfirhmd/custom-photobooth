import { randomUUID } from 'node:crypto'
import { requireAdmin } from '@/lib/auth'
import { db, listWorkspaces } from '@/lib/db'

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied
  return Response.json(listWorkspaces().map((w) => ({ ...w, smtp_pass_enc: undefined })))
}

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { name } = await request.json().catch(() => ({ name: '' }))
  const id = randomUUID()
  db.prepare(
    'INSERT INTO workspaces (id, name, shot_count, slots, created_at) VALUES (?, ?, 3, ?, ?)'
  ).run(id, String(name || 'Untitled event').slice(0, 120), '[]', Date.now())

  return Response.json({ id })
}
