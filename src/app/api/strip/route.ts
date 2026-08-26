import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { STRIPS_DIR } from '@/lib/db'

// Public: the guest's own browser uploads a .zip bundling the strip and every
// raw photo, so it can hand back a URL a phone can scan and fetch — self-hosted
// on local disk, same as frame uploads. Whatever makes this server reachable
// to guests already (a reverse proxy, ngrok, etc.) is what makes the QR work.
// Several full-res raw photos plus the strip, uncompressed in the zip, so the
// cap is generous — not just one PNG anymore.
const MAX_BYTES = 80 * 1024 * 1024

/**
 * `request.url` reflects the address Next's dev server is bound to
 * (localhost:3000), not what the client actually connected to — it doesn't
 * follow forwarded headers on its own. Behind any reverse proxy (ngrok,
 * nginx, Caddy, a production load balancer) the public host/protocol has to
 * be read explicitly from the headers the proxy sets, or every QR/share link
 * points at localhost regardless of how the guest actually reached the app.
 */
function publicOrigin(request: Request): string {
  const proto =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
    new URL(request.url).protocol.replace(':', '')
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ??
    request.headers.get('host') ??
    new URL(request.url).host
  return `${proto}://${host}`
}

export async function POST(request: Request) {
  const form = await request.formData()
  const image = form.get('image')
  if (!(image instanceof File)) {
    return Response.json({ error: 'No image received' }, { status: 400 })
  }
  if (image.size > MAX_BYTES) {
    return Response.json({ error: 'Image is too large' }, { status: 400 })
  }

  const filename = `${randomUUID()}.zip`
  await writeFile(path.join(STRIPS_DIR, filename), Buffer.from(await image.arrayBuffer()))

  return Response.json({ url: `${publicOrigin(request)}/api/strip/${filename}` })
}
