'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PlusIcon } from '@/components/icons'

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
    <button
      className="primary row"
      style={{ gap: 6 }}
      onClick={create}
      disabled={busy}
    >
      <PlusIcon size={18} />
      New workspace
    </button>
  )
}
