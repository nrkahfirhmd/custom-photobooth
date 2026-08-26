import { notFound } from 'next/navigation'
import Booth from './Booth'
import { slotsFor } from '@/lib/composite'
import { getWorkspace } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ws = getWorkspace((await params).id)
  return { title: ws ? ws.name : 'Photobooth' }
}

export default async function BoothPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ws = getWorkspace(id)
  if (!ws) notFound()

  return (
    <Booth
      id={ws.id}
      name={ws.name}
      shotCount={ws.shot_count}
      hasFrame={Boolean(ws.frame_file)}
      frameW={ws.frame_w ?? 800}
      frameH={ws.frame_h ?? 1200}
      slots={slotsFor(JSON.parse(ws.slots), ws.shot_count)}
    />
  )
}
