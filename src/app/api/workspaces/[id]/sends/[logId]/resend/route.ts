import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { requireAdmin } from '@/lib/auth'
import {
  createPendingSend,
  getSendLog,
  getWorkspace,
  logSend,
  resolveSend,
  UPLOAD_DIR,
} from '@/lib/db'
import { fromHeader, isValidEmail, smtpConfigured, transportFor } from '@/lib/mail'
import { notifySent } from '@/lib/notify'

type Params = { params: Promise<{ id: string; logId: string }> }

export async function POST(request: Request, { params }: Params) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id, logId } = await params
  const ws = getWorkspace(id)
  if (!ws) return Response.json({ error: 'not found' }, { status: 404 })

  const entry = getSendLog(id, Number(logId))
  if (!entry) return Response.json({ error: 'not found' }, { status: 404 })

  const files: string[] = JSON.parse(entry.files || '[]')
  if (files.length === 0) {
    return Response.json(
      { error: 'This send has no stored photos to resend (sent before the gallery was added).' },
      { status: 400 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const to = typeof body.to === 'string' && body.to ? body.to : entry.to_email
  if (!isValidEmail(to)) {
    return Response.json({ error: 'Enter a valid email address' }, { status: 400 })
  }
  if (!smtpConfigured(ws)) {
    const message = 'This booth has no email sender configured'
    logSend(id, to, false, message, files)
    return Response.json({ error: message }, { status: 400 })
  }

  const attachments = []
  for (const rel of files) {
    const content = await readFile(path.join(UPLOAD_DIR, rel)).catch(() => null)
    if (!content) {
      return Response.json(
        { error: 'Stored photo files are missing on disk, cannot resend.' },
        { status: 410 }
      )
    }
    attachments.push({ filename: path.basename(rel), content, contentType: 'image/png' })
  }

  // Same background pattern as the original send: the host doesn't wait on SMTP,
  // and can fire off several resends at once from the gallery.
  const newLogId = createPendingSend(id, to, files)
  transportFor(ws)
    .sendMail({
      from: fromHeader(ws),
      to,
      subject: `Your photos from ${ws.name}`,
      text: `Thanks for stopping by ${ws.name}! Your photo strip and individual photos are attached.`,
      attachments,
    })
    .then(() => {
      resolveSend(newLogId, true)
      notifySent({ id: newLogId, workspaceId: id, workspaceName: ws.name, to, at: Date.now() })
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : 'Unknown SMTP error'
      resolveSend(newLogId, false, message)
    })

  return Response.json({ ok: true, pending: true })
}
