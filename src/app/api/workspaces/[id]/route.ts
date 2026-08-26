import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { requireAdmin } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'
import { db, getWorkspace, recentSends, UPLOAD_DIR } from '@/lib/db'
import { parseSlots } from '@/lib/validate'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  const ws = getWorkspace(id)
  if (!ws) return Response.json({ error: 'not found' }, { status: 404 })

  const { smtp_pass_enc, ...safe } = ws
  return Response.json({
    ...safe,
    has_smtp_pass: Boolean(smtp_pass_enc),
    slots: parseSlots(JSON.parse(ws.slots)),
    recent: recentSends(id),
  })
}

export async function PUT(request: Request, { params }: Params) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  const ws = getWorkspace(id)
  if (!ws) return Response.json({ error: 'not found' }, { status: 404 })

  const body = await request.json()
  const shotCount = Math.min(Math.max(Number(body.shot_count) || 1, 1), 12)

  db.prepare(
    `UPDATE workspaces SET
       name = ?, shot_count = ?, slots = ?,
       smtp_host = ?, smtp_port = ?, smtp_user = ?,
       from_name = ?, from_email = ?
     WHERE id = ?`
  ).run(
    String(body.name || 'Untitled event').slice(0, 120),
    shotCount,
    JSON.stringify(parseSlots(body.slots)),
    String(body.smtp_host ?? '').trim(),
    Number(body.smtp_port) || 587,
    String(body.smtp_user ?? '').trim(),
    String(body.from_name ?? '').slice(0, 120),
    String(body.from_email ?? '').trim(),
    id
  )

  // Blank password means "leave the stored one alone", so editing other fields
  // doesn't silently wipe credentials.
  if (typeof body.smtp_pass === 'string' && body.smtp_pass !== '') {
    db.prepare('UPDATE workspaces SET smtp_pass_enc = ? WHERE id = ?').run(
      encrypt(body.smtp_pass),
      id
    )
  }

  return Response.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: Params) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  const ws = getWorkspace(id)
  if (ws?.frame_file) {
    await unlink(path.join(UPLOAD_DIR, ws.frame_file)).catch(() => {})
  }
  db.prepare('DELETE FROM workspaces WHERE id = ?').run(id)
  db.prepare('DELETE FROM send_log WHERE workspace_id = ?').run(id)
  return Response.json({ ok: true })
}
