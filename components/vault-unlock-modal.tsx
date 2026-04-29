'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useVault } from './vault-provider'

export function VaultUnlockModal() {
  const { status, unlock } = useVault()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const open = status === 'locked'

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!pin || loading) return

    setLoading(true)
    try {
      const ok = await unlock(pin)
      if (!ok) {
        const next = attempts + 1
        setAttempts(next)
        setError(next >= 5 ? 'Too many attempts — try again later.' : 'Incorrect PIN.')
        setPin('')
        setShake(true)
        setTimeout(() => {
          setShake(false)
          inputRef.current?.focus()
        }, 600)
      }
    } catch {
      setError('Unlock failed. Try again.')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm border-[hsl(var(--border))] bg-[hsl(var(--background))] p-0 overflow-hidden [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="relative flex flex-col items-center gap-6 px-8 py-10">

          {/* Grid background */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.015]"
            style={{
              backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />

          {/* Top glow beam */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 80% 40% at 50% -10%, hsl(230 80% 62% / 0.14) 0%, transparent 100%)',
            }}
          />

          {/* Glowing lock icon */}
          <div className="relative flex items-center justify-center w-20 h-20 z-10">
            <span
              className="absolute w-20 h-20 rounded-full border border-[hsl(var(--primary)/0.25)] animate-ping"
              style={{ animationDuration: '2.5s' }}
            />
            <span className="absolute w-16 h-16 rounded-full border border-[hsl(var(--primary)/0.15)]" />
            <div
              className="relative w-12 h-12 rounded-xl flex items-center justify-center border border-[hsl(var(--primary)/0.4)]"
              style={{
                background: 'hsl(var(--primary) / 0.08)',
                boxShadow: '0 0 24px hsl(var(--primary) / 0.2), inset 0 0 12px hsl(var(--primary) / 0.05)',
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-6 h-6"
                style={{
                  color: 'hsl(var(--primary))',
                  filter: 'drop-shadow(0 0 6px hsl(var(--primary) / 0.8))',
                }}
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <div className="flex flex-col items-center gap-1.5 text-center z-10">
            <h2 className="text-xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
              Your vault is locked
            </h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Enter your PIN to decrypt your credentials
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className={`w-full flex flex-col gap-3 z-10 ${shake ? 'animate-shake' : ''}`}
          >
            {/* PIN input with corner brackets */}
            <div className="relative">
              <span className="absolute -top-px -left-px w-3 h-3 border-t border-l border-[hsl(var(--primary)/0.5)] rounded-tl-sm pointer-events-none z-10" />
              <span className="absolute -top-px -right-px w-3 h-3 border-t border-r border-[hsl(var(--primary)/0.5)] rounded-tr-sm pointer-events-none z-10" />
              <span className="absolute -bottom-px -left-px w-3 h-3 border-b border-l border-[hsl(var(--primary)/0.5)] rounded-bl-sm pointer-events-none z-10" />
              <span className="absolute -bottom-px -right-px w-3 h-3 border-b border-r border-[hsl(var(--primary)/0.5)] rounded-br-sm pointer-events-none z-10" />
              <input
                ref={inputRef}
                type="password"
                autoComplete="current-password"
                placeholder="Enter PIN"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value)
                  if (error) setError('')
                }}
                disabled={loading}
                className="w-full h-11 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 text-center text-lg tracking-[0.5em] font-mono text-[hsl(var(--foreground))] placeholder:tracking-normal placeholder:text-sm placeholder:font-sans placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary)/0.5)] focus:border-[hsl(var(--primary)/0.4)] disabled:opacity-50 transition-all"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--destructive)/0.08)] border border-[hsl(var(--destructive)/0.2)]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-3.5 h-3.5 shrink-0 text-[hsl(var(--destructive))]"
                >
                  <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-[hsl(var(--destructive))] flex-1">{error}</p>
                {attempts > 0 && attempts < 5 && (
                  <span className="text-[10px] font-mono text-[hsl(var(--destructive)/0.6)] shrink-0">
                    {attempts}/5
                  </span>
                )}
              </div>
            )}

            <Button type="submit" disabled={loading || !pin} className="w-full h-11">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Decrypting…
                </span>
              ) : (
                'Unlock vault'
              )}
            </Button>
          </form>

          {/* AES badge */}
          <div className="flex items-center gap-2 z-10">
            <div className="relative flex items-center justify-center">
              <span className="absolute w-3.5 h-3.5 rounded-full bg-[hsl(var(--primary)/0.25)] animate-pulse" />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="relative w-3 h-3"
                style={{
                  color: 'hsl(var(--primary))',
                  filter: 'drop-shadow(0 0 3px hsl(var(--primary) / 0.8))',
                }}
              >
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-[10px] font-mono tracking-wider text-[hsl(var(--muted-foreground))]">
              AES-256-GCM ENCRYPTED
            </span>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
