import { notFound, redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import { getWorkspace, recentSends } from '@/lib/db'
import GalleryView from './GalleryView'

export const dynamic = 'force-dynamic'

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!(await isAdmin())) redirect('/login')

  const { id } = await params
  const ws = getWorkspace(id)
  if (!ws) notFound()

  return (
    <GalleryView
      workspaceId={ws.id}
      workspaceName={ws.name}
      sends={recentSends(ws.id, 200).map((r) => ({
        id: r.id,
        to: r.to_email,
        ok: Boolean(r.ok),
        status: r.status,
        error: r.error,
        at: r.created_at,
        hasImage: JSON.parse(r.files || '[]').length > 0,
      }))}
    />
  )
}
