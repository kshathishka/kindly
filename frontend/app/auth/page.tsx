'use client'

import { FormEvent, useState } from 'react'
import { Heart, ArrowRight, Loader2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { setSession } from '@/lib/session'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const auth = mode === 'signup'
        ? await api.signup(email, password)
        : await api.login(email, password)
      setSession(auth)
      // A new account has no child profile yet, so it starts at onboarding.
      window.location.href = mode === 'signup' ? '/onboarding' : '/'
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <a className="onboarding-brand" href="/"><span className="brand-mark"><Heart size={19} fill="currentColor" /></span> Kindly</a>
        <div className="auth-copy">
          <span className="eyebrow">A SOFTER START</span>
          <h1>{mode === 'signup' ? 'Make more good days.' : 'Welcome back.'}</h1>
          <p>{mode === 'signup' ? 'A private space to prepare, communicate, and connect with your child.' : 'Your family space is ready when you are.'}</p>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="auth-email">Email address</label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            autoComplete="email"
          />
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="At least 8 characters"
            minLength={8}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button coral full" type="submit" disabled={busy}>
            {busy
              ? <><Loader2 size={17} className="spin" /> Just a moment</>
              : <>{mode === 'signup' ? 'Create my space' : 'Sign in'} <ArrowRight size={17} /></>}
          </button>
        </form>
        <button
          className="auth-switch"
          onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(null) }}
        >
          {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
      </div>
      <div className="auth-art">
        <span className="eyebrow">KINDLY IS FOR</span>
        <h2>Small moments that feel a little easier.</h2>
        <p>Start with one situation. Build from there.</p>
      </div>
    </main>
  )
}
