import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getWorkspace, UPLOAD_DIR } from '@/lib/db'

// Public: guests need the frame to composite their strip in the browser.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ws = getWorkspace(id)
  if (!ws?.frame_file) return new Response('Not found', { status: 404 })

  // Filename comes from our own DB (a generated UUID), never from the request.
  const buf = await readFile(path.join(UPLOAD_DIR, ws.frame_file)).catch(() => null)
  if (!buf) return new Response('Not found', { status: 404 })

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=60',
    },
  })
}
