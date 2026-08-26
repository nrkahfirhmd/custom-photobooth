import { requireAdmin } from '@/lib/auth'
import { notifyBus, type SendNotification } from '@/lib/notify'

// Admin-only live feed: pushes an event whenever a background send resolves
// successfully, so the host sees deliveries land without polling the gallery.
export async function GET(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      const send = (payload: SendNotification) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }
      notifyBus.on('sent', send)

      // Keep intermediary proxies from closing an idle connection.
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': ping\n\n'))
      }, 25000)

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        notifyBus.off('sent', send)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
