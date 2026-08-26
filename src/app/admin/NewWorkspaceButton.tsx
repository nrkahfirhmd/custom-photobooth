'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PlusIcon } from '@/components/icons'

export default function NewWorkspaceButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError('')
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    setBusy(false)
    if (res.ok) {
      setOpen(false)
      setName('')
      router.push(`/admin/${(await res.json()).id}`)
    } else {
      setError('Could not create workspace')
    }
  }

  return (
    <>
      <button
        className="primary row"
        style={{ gap: 6 }}
        onClick={() => setOpen(true)}
        disabled={busy}
      >
        <PlusIcon size={18} />
        New workspace
      </button>

      {open && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-ws-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="new-ws-title">New workspace</h2>
            <form onSubmit={create}>
              <div className="field">
                <label htmlFor="new-ws-name">Event name</label>
                <input
                  id="new-ws-name"
                  type="text"
                  autoFocus
                  placeholder="Sarah & Tom's Wedding"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {error && (
                  <p className="err" role="alert" style={{ marginBottom: 0 }}>
                    {error}
                  </p>
                )}
              </div>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button className="primary" disabled={busy || !name.trim()}>
                  {busy ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
