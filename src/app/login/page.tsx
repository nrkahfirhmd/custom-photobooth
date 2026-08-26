'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
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
    <div className="wrap" style={{ maxWidth: 380, paddingTop: '15vh' }}>
      <h1>Photobooth admin</h1>
      <form className="card" style={{ marginTop: '1.25rem' }} onSubmit={submit}>
        <div className="field">
          <label htmlFor="password">Admin password</label>
          <input
            id="password"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="err">{error}</p>}
        <button className="primary" disabled={busy || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
