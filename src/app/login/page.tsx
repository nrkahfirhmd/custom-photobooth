'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { CameraIcon } from '@/components/icons'

export default function LoginPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    // Some password managers write the field's DOM value directly without
    // firing the input event React listens for, so `password` state can lag
    // behind what's actually on screen (the field looks filled, the button
    // even looks enabled, but the submitted value is stale/empty). Read the
    // DOM directly so what gets sent always matches what's visibly typed.
    const value = inputRef.current?.value ?? password
    if (!value) return
    setBusy(true)
    setError('')
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: value }),
    })
    setBusy(false)
    if (res.ok) {
      router.push('/admin')
      router.refresh()
    } else {
      setError((await res.json()).error ?? 'Sign in failed')
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 420, paddingTop: '14vh' }}>
      <div className="rise" style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
        <span
          className="step-n"
          style={{ width: 56, height: 56, margin: '0 auto var(--space-md)' }}
        >
          <CameraIcon size={28} />
        </span>
        <h1>Photobooth</h1>
        <p className="muted">Sign in to manage your events.</p>
      </div>

      <form className="card rise" onSubmit={submit}>
        <div className="field">
          <label htmlFor="password">Admin password</label>
          <input
            ref={inputRef}
            id="password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={error ? 'login-error' : undefined}
          />
          {/* Error sits with its field, and is announced. */}
          {error && (
            <p id="login-error" className="err" role="alert" style={{ marginBottom: 0 }}>
              {error}
            </p>
          )}
        </div>
        <button className="primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
