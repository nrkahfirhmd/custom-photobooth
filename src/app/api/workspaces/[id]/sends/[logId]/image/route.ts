import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { requireAdmin } from '@/lib/auth'
import { getSendLog, UPLOAD_DIR } from '@/lib/db'

type Params = { params: Promise<{ id: string; logId: string }> }

// Admin-only: guests' photos are personal, unlike the frame asset.
export async function GET(_request: Request, { params }: Params) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id, logId } = await params
  const entry = getSendLog(id, Number(logId))
  if (!entry) return new Response('Not found', { status: 404 })

  const files: string[] = JSON.parse(entry.files || '[]')
  const strip = files[0]
  if (!strip) return new Response('Not found', { status: 404 })

  const buf = await readFile(path.join(UPLOAD_DIR, strip)).catch(() => null)
  if (!buf) return new Response('Not found', { status: 404 })

  return new Response(new Uint8Array(buf), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=60' },
  })
}
