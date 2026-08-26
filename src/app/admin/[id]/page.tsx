import { notFound, redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import { slotsFor } from '@/lib/composite'
import { getWorkspace, recentSends } from '@/lib/db'
import WorkspaceEditor from './WorkspaceEditor'

export const dynamic = 'force-dynamic'

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!(await isAdmin())) redirect('/login')

  const { id } = await params
  const ws = getWorkspace(id)
  if (!ws) notFound()

  return (
    <WorkspaceEditor
      workspace={{
        id: ws.id,
        name: ws.name,
        shot_count: ws.shot_count,
        frame_w: ws.frame_w,
        frame_h: ws.frame_h,
        has_frame: Boolean(ws.frame_file),
        slots: slotsFor(JSON.parse(ws.slots), ws.shot_count),
        smtp_host: ws.smtp_host,
        smtp_port: ws.smtp_port,
        smtp_user: ws.smtp_user,
        has_smtp_pass: Boolean(ws.smtp_pass_enc),
        from_name: ws.from_name,
        from_email: ws.from_email,
      }}
      recent={recentSends(ws.id, 10).map((r) => ({
        to: r.to_email,
        ok: Boolean(r.ok),
        status: r.status,
        error: r.error,
        at: r.created_at,
      }))}
    />
  )
}
