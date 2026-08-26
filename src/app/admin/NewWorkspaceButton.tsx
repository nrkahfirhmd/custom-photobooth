'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function NewWorkspaceButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function create() {
    const name = prompt('Event name?', 'New event')
    if (!name) return
    setBusy(true)
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setBusy(false)
    if (res.ok) router.push(`/admin/${(await res.json()).id}`)
    else alert('Could not create workspace')
  }

  return (
    <button className="primary" onClick={create} disabled={busy}>
      New workspace
    </button>
  )
}
