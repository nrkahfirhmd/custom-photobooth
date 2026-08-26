'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowLeftIcon,
  CheckIcon,
  ImageIcon,
  MailIcon,
  RefreshIcon,
  XIcon,
} from '@/components/icons'

type Send = {
  id: number
  to: string
  ok: boolean
  status: 'pending' | 'ok' | 'failed'
  error: string | null
  at: number
  hasImage: boolean
}

function GalleryCard({ workspaceId, send }: { workspaceId: string; send: Send }) {
  const [to, setTo] = useState(send.to)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null)

  async function resend() {
    setBusy(true)
    setResult(null)
    const res = await fetch(
      `/api/workspaces/${workspaceId}/sends/${send.id}/resend`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      }
    )
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    setResult(
      res.ok
        ? { text: `Queued — resending to ${to}.`, ok: true }
        : { text: data.error ?? 'Resend failed.', ok: false }
    )
  }

  return (
    <div className="card gallery-card">
      <div className="gallery-thumb">
        {send.hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/workspaces/${workspaceId}/sends/${send.id}/image`}
            alt={`Photo strip sent to ${send.to}`}
          />
        ) : (
          <div className="gallery-thumb-empty">
            <ImageIcon size={28} />
            <span>Not stored</span>
          </div>
        )}
      </div>

      <div className="gallery-body">
        <div className="row" style={{ gap: 6 }}>
          <span
            className={send.status === 'ok' ? 'ok' : send.status === 'pending' ? 'muted' : 'err'}
            style={{ display: 'flex' }}
          >
            {send.status === 'ok' ? (
              <CheckIcon size={16} />
            ) : send.status === 'pending' ? (
              <MailIcon size={16} />
            ) : (
              <XIcon size={16} />
            )}
          </span>
          <strong>
            {send.status === 'ok' ? 'Delivered' : send.status === 'pending' ? 'Sending' : 'Failed'}
          </strong>
          <span className="muted">{new Date(send.at).toLocaleString()}</span>
        </div>
        {send.error && <p className="muted err">{send.error}</p>}

        <div className="field" style={{ marginTop: 'var(--space-sm)' }}>
          <label className="sr-only" htmlFor={`to-${send.id}`}>
            Resend to
          </label>
          <input
            id={`to-${send.id}`}
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <button
          className="secondary row"
          style={{ gap: 6 }}
          onClick={resend}
          disabled={busy || !send.hasImage || !to || send.status === 'pending'}
        >
          <RefreshIcon size={16} />
          {busy ? 'Queuing…' : 'Resend'}
        </button>

        {result && (
          <p className={result.ok ? 'ok' : 'err'} style={{ marginTop: 'var(--space-xs)' }}>
            {result.text}
          </p>
        )}
      </div>
    </div>
  )
}

export default function GalleryView({
  workspaceId,
  workspaceName,
  sends,
}: {
  workspaceId: string
  workspaceName: string
  sends: Send[]
}) {
  return (
    <div className="wrap">
      <Link
        href={`/admin/${workspaceId}`}
        className="row"
        style={{ gap: 6, textDecoration: 'none', marginBottom: 'var(--space-md)' }}
      >
        <ArrowLeftIcon size={16} />
        {workspaceName}
      </Link>

      <h1 style={{ marginBottom: 'var(--space-xs)' }}>Gallery</h1>
      <p className="muted" style={{ marginBottom: 'var(--space-xl)' }}>
        Every strip guests have sent from this booth. Failed sends can be resent once the
        sender config is fixed — no need to ask the guest to shoot again.
      </p>

      {sends.length === 0 && (
        <div className="empty">
          <ImageIcon size={40} />
          <p>Nothing sent yet.</p>
        </div>
      )}

      <div className="gallery-grid">
        {sends.map((s) => (
          <GalleryCard key={s.id} workspaceId={workspaceId} send={s} />
        ))}
      </div>
    </div>
  )
}
