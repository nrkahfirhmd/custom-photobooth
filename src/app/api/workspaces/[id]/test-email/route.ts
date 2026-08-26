import { requireAdmin } from '@/lib/auth'
import { getWorkspace, logSend } from '@/lib/db'
import { fromHeader, isValidEmail, smtpConfigured, transportFor } from '@/lib/mail'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  const ws = getWorkspace(id)
  if (!ws) return Response.json({ error: 'not found' }, { status: 404 })
  if (!smtpConfigured(ws)) {
    return Response.json(
      { error: 'Fill in SMTP host, user, password and from-address first, then save.' },
      { status: 400 }
    )
  }

  const { to } = await request.json()
  if (!isValidEmail(to)) {
    return Response.json({ error: 'Enter a valid email address' }, { status: 400 })
  }

  try {
    await transportFor(ws).sendMail({
      from: fromHeader(ws),
      to,
      subject: `Test email from ${ws.name}`,
      text: `SMTP for "${ws.name}" is working. Photos from this booth will arrive from this address.`,
    })
    logSend(id, to, true)
    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown SMTP error'
    logSend(id, to, false, message)
    return Response.json({ error: message }, { status: 502 })
  }
}
