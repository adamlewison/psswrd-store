'use client'

import { useState, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export default function LoginButton() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [codeError, setCodeError] = useState(false)
  const codeInputRef = useRef<HTMLInputElement>(null)

  async function handleEmailSignIn(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    const result = await signIn('resend', { email, redirect: false })
    if (result?.ok) {
      setSent(true)
      setTimeout(() => codeInputRef.current?.focus(), 50)
    }
    setLoading(false)
  }

  async function handleCodeSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (code.length !== 6) return
    setVerifying(true)
    setCodeError(false)
    const res = await fetch('/api/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    if (!res.ok) {
      setCodeError(true)
      setVerifying(false)
      return
    }
    const params = new URLSearchParams({ token: code, email, callbackUrl: '/' })
    window.location.href = `/api/auth/callback/resend?${params}`
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">Check your inbox</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            A 6-digit code was sent to <span className="font-medium">{email}</span>
          </p>
        </div>
        <form onSubmit={handleCodeSubmit} className="space-y-3">
          <input
            ref={codeInputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setCodeError(false) }}
            required
            className={`w-full h-12 rounded-md border bg-transparent px-3 text-center text-2xl font-mono tracking-[0.4em] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] ${codeError ? 'border-red-500' : 'border-[hsl(var(--border))]'}`}
          />
          {codeError && (
            <p className="text-xs text-red-500 text-center">Invalid or expired code. Try again.</p>
          )}
          <Button
            type="submit"
            disabled={verifying || code.length !== 6}
            className="w-full h-11 text-sm font-medium"
          >
            {verifying ? 'Verifying…' : 'Verify code'}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => { setSent(false); setCode('') }}
          className="w-full text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Button
        onClick={() => signIn('google', { callbackUrl: '/' })}
        variant="outline"
        className="w-full gap-3 h-11 text-sm font-medium border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[hsl(var(--border))]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[hsl(var(--card)/0.8)] px-2 text-[hsl(var(--muted-foreground))]">or</span>
        </div>
      </div>

<form onSubmit={handleEmailSignIn} className="space-y-3">
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full h-11 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        />
        <Button
          type="submit"
          disabled={loading || !email}
          className="w-full h-11 text-sm font-medium"
        >
          {loading ? 'Sending…' : 'Continue with Email'}
        </Button>
      </form>
    </div>
  )
}
