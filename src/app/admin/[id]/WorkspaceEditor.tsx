'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SlotAligner from '@/components/SlotAligner'
import { defaultSlots, type Slot } from '@/lib/composite'
import {
  AlertIcon,
  ArrowLeftIcon,
  CheckIcon,
  ExternalIcon,
  MailIcon,
  XIcon,
} from '@/components/icons'

type Workspace = {
  id: string
  name: string
  shot_count: number
  frame_w: number | null
  frame_h: number | null
  has_frame: boolean
  slots: Slot[]
  smtp_host: string
  smtp_port: number
  smtp_user: string
  has_smtp_pass: boolean
  from_name: string
  from_email: string
}

type SendRecord = { to: string; ok: boolean; error: string | null; at: number }

function Step({ n, title }: { n: number; title: string }) {
  return (
    <div className="step">
      <span className="step-n">{n}</span>
      <h2>{title}</h2>
    </div>
  )
}

export default function WorkspaceEditor({
  workspace,
  recent,
}: {
  workspace: Workspace
  recent: SendRecord[]
}) {
  const router = useRouter()
  const [ws, setWs] = useState(workspace)
  const [smtpPass, setSmtpPass] = useState('')
  const [frameVersion, setFrameVersion] = useState(0)
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [boothUrl, setBoothUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setBoothUrl(`${window.location.origin}/b/${ws.id}`)
  }, [ws.id])

  const set = <K extends keyof Workspace>(key: K, value: Workspace[K]) =>
    setWs((prev) => ({ ...prev, [key]: value }))

  // Slot count must track shot count, or photos have nowhere to land.
  function setShotCount(count: number) {
    const n = Math.min(Math.max(count || 1, 1), 12)
    setWs((prev) => ({
      ...prev,
      shot_count: n,
      slots:
        prev.slots.length === n
          ? prev.slots
          : prev.slots.length < n
            ? [...prev.slots, ...defaultSlots(n).slice(prev.slots.length)]
            : prev.slots.slice(0, n),
    }))
  }

  async function save() {
    setBusy(true)
    setStatus(null)
    const res = await fetch(`/api/workspaces/${ws.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ws, smtp_pass: smtpPass }),
    })
    setBusy(false)
    if (res.ok) {
      if (smtpPass) set('has_smtp_pass', true)
      setSmtpPass('')
      setStatus({ text: 'Saved.', ok: true })
      router.refresh()
    } else {
      setStatus({ text: 'Could not save.', ok: false })
    }
  }

  async function uploadFrame(file: File) {
    setBusy(true)
    setStatus(null)
    const body = new FormData()
    body.append('frame', file)
    const res = await fetch(`/api/workspaces/${ws.id}/frame`, { method: 'POST', body })
    const data = await res.json()
    setBusy(false)
    if (res.ok) {
      setWs((prev) => ({
        ...prev,
        has_frame: true,
        frame_w: data.width,
        frame_h: data.height,
      }))
      setFrameVersion((v) => v + 1)
      setStatus({ text: `Frame uploaded (${data.width}×${data.height}).`, ok: true })
    } else {
      setStatus({ text: data.error ?? 'Upload failed.', ok: false })
    }
  }

  async function sendTest() {
    setBusy(true)
    setStatus(null)
    const res = await fetch(`/api/workspaces/${ws.id}/test-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: testTo }),
    })
    const data = await res.json()
    setBusy(false)
    setStatus(
      res.ok
        ? { text: `Test email sent to ${testTo}.`, ok: true }
        : { text: data.error ?? 'Test email failed.', ok: false }
    )
    router.refresh()
  }

  async function remove() {
    if (!confirm(`Delete "${ws.name}" and its frame? This cannot be undone.`)) return
    setBusy(true)
    const res = await fetch(`/api/workspaces/${ws.id}`, { method: 'DELETE' })
    setBusy(false)
    if (res.ok) router.push('/admin')
    else setStatus({ text: 'Could not delete.', ok: false })
  }

  async function copyLink() {
    await navigator.clipboard?.writeText(boothUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="wrap">
      <Link
        href="/admin"
        className="row"
        style={{ gap: 6, textDecoration: 'none', marginBottom: 'var(--space-md)' }}
      >
        <ArrowLeftIcon size={16} />
        All workspaces
      </Link>

      <div className="row between" style={{ marginBottom: 'var(--space-xl)' }}>
        <h1>{ws.name}</h1>
        <Link
          href={`/b/${ws.id}`}
          target="_blank"
          className="row"
          style={{ gap: 6, textDecoration: 'none' }}
        >
          Open booth
          <ExternalIcon size={16} />
        </Link>
      </div>

      {status && (
        <div
          className={`toast ${status.ok ? 'is-ok' : 'is-err'}`}
          role={status.ok ? 'status' : 'alert'}
        >
          {status.ok ? <CheckIcon size={18} /> : <AlertIcon size={18} />}
          {status.text}
        </div>
      )}

      <div className="card rise">
        <Step n={1} title="Basics" />
        <div className="grid2">
          <div className="field">
            <label htmlFor="name">Workspace name</label>
            <input
              id="name"
              type="text"
              value={ws.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="shots">Photos per strip</label>
            <input
              id="shots"
              type="number"
              min={1}
              max={12}
              value={ws.shot_count}
              onChange={(e) => setShotCount(Number(e.target.value))}
            />
            <p className="muted" style={{ marginBottom: 0 }}>
              How many shots the booth takes, back to back.
            </p>
          </div>
        </div>
      </div>

      <div className="card rise">
        <Step n={2} title="Frame & photo slots" />
        <div className="field">
          <label htmlFor="frame">Frame image</label>
          <input
            id="frame"
            type="file"
            accept="image/png"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadFrame(file)
              e.target.value = ''
            }}
          />
          <p className="muted">
            Transparent PNG, any size. Photos show through wherever it is transparent.
          </p>
        </div>
        <SlotAligner
          frameUrl={ws.has_frame ? `/api/frame/${ws.id}?v=${frameVersion}` : null}
          frameW={ws.frame_w ?? 800}
          frameH={ws.frame_h ?? 1200}
          slots={ws.slots}
          onChange={(slots) => set('slots', slots)}
        />
      </div>

      <div className="card rise">
        <Step n={3} title="Email sender" />
        <p className="muted" style={{ marginTop: '-8px', marginBottom: 'var(--space-md)' }}>
          Your own SMTP. Stored encrypted. With Gmail, use an app password, not your
          login password.
        </p>
        <div className="grid2">
          <div className="field">
            <label htmlFor="host">SMTP host</label>
            <input
              id="host"
              type="text"
              placeholder="smtp.gmail.com"
              value={ws.smtp_host}
              onChange={(e) => set('smtp_host', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="port">Port</label>
            <input
              id="port"
              type="number"
              value={ws.smtp_port}
              onChange={(e) => set('smtp_port', Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="user">SMTP username</label>
            <input
              id="user"
              type="text"
              value={ws.smtp_user}
              onChange={(e) => set('smtp_user', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pass">
              SMTP password {ws.has_smtp_pass && '· saved'}
            </label>
            <input
              id="pass"
              type="password"
              placeholder={ws.has_smtp_pass ? 'Leave blank to keep' : ''}
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="fromName">From name</label>
            <input
              id="fromName"
              type="text"
              placeholder="Sarah &amp; Tom's Wedding"
              value={ws.from_name}
              onChange={(e) => set('from_name', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="fromEmail">From address</label>
            <input
              id="fromEmail"
              type="email"
              value={ws.from_email}
              onChange={(e) => set('from_email', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card rise">
        <Step n={4} title="Test the sender" />
        <p className="muted" style={{ marginTop: '-8px', marginBottom: 'var(--space-md)' }}>
          Save first, then send yourself a test. This is the only way to know the
          credentials work before the event.
        </p>
        <div className="row">
          <input
            type="email"
            aria-label="Test recipient email"
            placeholder="you@example.com"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <button
            className="secondary row"
            style={{ gap: 6 }}
            onClick={sendTest}
            disabled={busy || !testTo}
          >
            <MailIcon size={18} />
            Send test
          </button>
        </div>
      </div>

      <div className="card rise">
        <Step n={5} title="Share the booth link" />
        <p className="note">{boothUrl || `/b/${ws.id}`}</p>
        <button
          className="secondary"
          style={{ marginTop: 'var(--space-md)' }}
          onClick={copyLink}
          disabled={!boothUrl}
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>

      <div className="card rise">
        <h2>Recent sends</h2>
        {recent.length === 0 && <p className="muted">Nothing sent yet.</p>}
        {recent.map((r, i) => (
          <div key={i} className="log-row">
            <div className="row" style={{ gap: 'var(--space-sm)', alignItems: 'flex-start' }}>
              <span className={r.ok ? 'ok' : 'err'} style={{ display: 'flex' }}>
                {r.ok ? <CheckIcon size={18} /> : <XIcon size={18} />}
                <span className="sr-only">{r.ok ? 'Delivered' : 'Failed'}</span>
              </span>
              <div style={{ minWidth: 0 }}>
                {r.to}
                {r.error && <div className="muted">{r.error}</div>}
              </div>
            </div>
            <span className="muted" style={{ flex: 'none' }}>
              {new Date(r.at).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <div className="row between">
        <button className="primary" onClick={save} disabled={busy}>
          {busy ? 'Working…' : 'Save changes'}
        </button>
        <button className="danger" onClick={remove} disabled={busy}>
          Delete workspace
        </button>
      </div>
    </div>
  )
}
