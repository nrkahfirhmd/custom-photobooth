import { randomUUID } from 'node:crypto'
import { writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { requireAdmin } from '@/lib/auth'
import { db, getWorkspace, UPLOAD_DIR } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const MAX_BYTES = 20 * 1024 * 1024

/** Frames are transparent PNGs of any size; read IHDR rather than pull in an image lib. */
function readPngSize(buf: Buffer) {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIG)) return null
  if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') return null
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

export async function POST(request: Request, { params }: Params) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { id } = await params
  const ws = getWorkspace(id)
  if (!ws) return Response.json({ error: 'not found' }, { status: 404 })

  const file = (await request.formData()).get('frame')
  if (!(file instanceof File)) {
    return Response.json({ error: 'No file uploaded' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'Frame must be under 20MB' }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const size = readPngSize(buf)
  if (!size || !size.width || !size.height) {
    return Response.json(
      { error: 'Frame must be a PNG (use a transparent PNG so photos show through)' },
      { status: 400 }
    )
  }

  const filename = `${randomUUID()}.png`
  await writeFile(path.join(UPLOAD_DIR, filename), buf)
  if (ws.frame_file) {
    await unlink(path.join(UPLOAD_DIR, ws.frame_file)).catch(() => {})
  }

  db.prepare(
    'UPDATE workspaces SET frame_file = ?, frame_w = ?, frame_h = ? WHERE id = ?'
  ).run(filename, size.width, size.height, id)

  return Response.json({ ok: true, width: size.width, height: size.height })
}
