import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { STRIPS_DIR } from '@/lib/db'

// Public: this is the URL the scan-to-download QR points at, hit directly by
// a guest's phone. `filename` comes from the request, not a DB row, so it is
// validated against exactly what POST /api/strip generates before touching
// the filesystem — anything else (e.g. a `..` traversal attempt) is rejected.
const SAFE_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  if (!SAFE_FILENAME.test(filename)) {
    return new Response('Not found', { status: 404 })
  }

  const buf = await readFile(path.join(STRIPS_DIR, filename)).catch(() => null)
  if (!buf) return new Response('Not found', { status: 404 })

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': 'inline; filename="photostrip.png"',
    },
  })
}
