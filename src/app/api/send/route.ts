import { getWorkspace, logSend } from '@/lib/db'
import { fromHeader, isValidEmail, smtpConfigured, transportFor } from '@/lib/mail'

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
  if (!smtpConfigured(ws)) {
    const message = 'This booth has no email sender configured'
    logSend(workspaceId, to, false, message)
    return Response.json({ error: message }, { status: 503 })
  }

  const attachments = [
    {
      filename: 'photostrip.png',
      content: Buffer.from(await image.arrayBuffer()),
      contentType: 'image/png',
    },
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

  try {
    await transportFor(ws).sendMail({
      from: fromHeader(ws),
      to,
      subject: `Your photos from ${ws.name}`,
      text: `Thanks for stopping by ${ws.name}! Your photo strip and individual photos are attached.`,
      attachments,
    })
    logSend(workspaceId, to, true)
    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown SMTP error'
    logSend(workspaceId, to, false, message)
    return Response.json(
      { error: 'We could not send the email. Please try again.' },
      { status: 502 }
    )
  }
}
