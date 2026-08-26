import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createPendingSend, getWorkspace, logSend, resolveSend, UPLOAD_DIR } from '@/lib/db'
import { fromHeader, isValidEmail, smtpConfigured, transportFor } from '@/lib/mail'
import { notifySent } from '@/lib/notify'

const MAX_IMAGE_BYTES = 25 * 1024 * 1024

// Public: this is the guest's "send me my strip" endpoint.
export async function POST(request: Request) {
  const form = await request.formData()
  const workspaceId = String(form.get('workspaceId') ?? '')
  const to = form.get('email')
  const image = form.get('image')
  const photos = form.getAll('photo')

  const ws = getWorkspace(workspaceId)
  if (!ws) return Response.json({ error: 'Booth not found' }, { status: 404 })

  if (!isValidEmail(to)) {
    return Response.json({ error: 'Enter a valid email address' }, { status: 400 })
  }
  if (!(image instanceof File) || image.size === 0) {
    return Response.json({ error: 'No photo was received' }, { status: 400 })
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: 'Photo is too large' }, { status: 413 })
  }

  const stripBuf = Buffer.from(await image.arrayBuffer())
  const attachments = [
    { filename: 'photostrip.png', content: stripBuf, contentType: 'image/png' },
  ]

  for (const [i, raw] of photos.entries()) {
    if (!(raw instanceof File) || raw.size === 0) continue
    if (raw.size > MAX_IMAGE_BYTES) {
      return Response.json({ error: 'Photo is too large' }, { status: 413 })
    }
    attachments.push({
      filename: `photo-${i + 1}.png`,
      content: Buffer.from(await raw.arrayBuffer()),
      contentType: 'image/png',
    })
  }

  // Save every send attempt to disk (even on failure) so the admin gallery can
  // review the strip and resend without asking the guest to shoot again.
  const sendDir = path.join('sends', randomUUID())
  await mkdir(path.join(UPLOAD_DIR, sendDir), { recursive: true })
  const files: string[] = []
  for (const att of attachments) {
    const rel = path.join(sendDir, att.filename)
    await writeFile(path.join(UPLOAD_DIR, rel), att.content)
    files.push(rel)
  }

  if (!smtpConfigured(ws)) {
    const message = 'This booth has no email sender configured'
    logSend(workspaceId, to, false, message, files)
    return Response.json({ error: message }, { status: 503 })
  }

  // The actual SMTP round-trip runs in the background — the guest doesn't wait on
  // it, and any number of these can be in flight at once. The result lands in the
  // gallery, and success pushes a live notification to the admin UI.
  const logId = createPendingSend(workspaceId, to, files)
  transportFor(ws)
    .sendMail({
      from: fromHeader(ws),
      to,
      subject: `Your photos from ${ws.name}`,
      text: `Thanks for stopping by ${ws.name}! Your photo strip and individual photos are attached.`,
      attachments,
    })
    .then(() => {
      resolveSend(logId, true)
      notifySent({ id: logId, workspaceId, workspaceName: ws.name, to, at: Date.now() })
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : 'Unknown SMTP error'
      resolveSend(logId, false, message)
    })

  return Response.json({ ok: true, pending: true })
}
