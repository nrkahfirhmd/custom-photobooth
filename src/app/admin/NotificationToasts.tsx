'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckIcon } from '@/components/icons'

type SendNotification = {
  id: number
  workspaceId: string
  workspaceName: string
  to: string
  at: number
}

const VISIBLE_MS = 6000

export default function NotificationToasts() {
  const [toasts, setToasts] = useState<SendNotification[]>([])
  const seen = useRef(new Set<number>())

  useEffect(() => {
    const source = new EventSource('/api/notifications/stream')
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as SendNotification
      // The stream can replay a send this tab already knows about (reconnect after a drop).
      if (seen.current.has(payload.id)) return
      seen.current.add(payload.id)
      setToasts((prev) => [...prev, payload])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== payload.id))
      }, VISIBLE_MS)
    }
    return () => source.close()
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="notify-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast is-ok notify-toast" role="status">
          <CheckIcon size={18} />
          <div>
            <strong>Delivered · {t.workspaceName}</strong>
            {t.to}
          </div>
        </div>
      ))}
    </div>
  )
}
