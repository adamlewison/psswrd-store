import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import LoginButton from './login-button'

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect('/')

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] relative overflow-hidden">

      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Top beam */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% -10%, hsl(230 80% 62% / 0.18) 0%, transparent 100%)',
        }}
      />

      {/* Bottom-left accent */}
      <div
        className="absolute bottom-0 left-0 w-96 h-96 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at bottom left, hsl(230 80% 62% / 0.07) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm px-4">

        {/* Icon + wordmark */}
        <div className="flex flex-col items-center gap-4">

          {/* Glowing lock */}
          <div className="relative flex items-center justify-center w-20 h-20">
            {/* Outer pulse ring */}
            <span className="absolute w-20 h-20 rounded-full border border-[hsl(var(--primary)/0.3)] animate-ping" style={{ animationDuration: '2.5s' }} />
            {/* Mid ring */}
            <span className="absolute w-16 h-16 rounded-full border border-[hsl(var(--primary)/0.2)]" />
            {/* Icon bg */}
            <div
              className="relative w-12 h-12 rounded-xl flex items-center justify-center border border-[hsl(var(--primary)/0.5)]"
              style={{ background: 'hsl(var(--primary) / 0.08)', boxShadow: '0 0 24px hsl(var(--primary) / 0.25), inset 0 0 12px hsl(var(--primary) / 0.05)' }}
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
                style={{ color: 'hsl(var(--primary))', filter: 'drop-shadow(0 0 6px hsl(var(--primary) / 0.8))' }}
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>

          {/* App name */}
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-4xl font-bold tracking-tighter flex items-baseline gap-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ color: 'hsl(var(--foreground))', textShadow: '0 0 20px hsl(var(--primary) / 0.4)' }}>psswrd</span>
              <span className="text-lg font-normal" style={{ color: 'hsl(var(--primary))', textShadow: '0 0 12px hsl(var(--primary) / 0.6)' }}>.store</span>
            </h1>
            <p className="text-xs tracking-widest uppercase font-mono text-[hsl(var(--muted-foreground))]">
              Secure Credential Vault
            </p>
          </div>
        </div>

        {/* Login card */}
        <div className="w-full relative">
          {/* Corner brackets */}
          <span className="absolute -top-px -left-px w-4 h-4 border-t border-l border-[hsl(var(--primary)/0.6)] rounded-tl-sm" />
          <span className="absolute -top-px -right-px w-4 h-4 border-t border-r border-[hsl(var(--primary)/0.6)] rounded-tr-sm" />
          <span className="absolute -bottom-px -left-px w-4 h-4 border-b border-l border-[hsl(var(--primary)/0.6)] rounded-bl-sm" />
          <span className="absolute -bottom-px -right-px w-4 h-4 border-b border-r border-[hsl(var(--primary)/0.6)] rounded-br-sm" />

          <div
            className="w-full rounded-xl border border-[hsl(var(--border))] backdrop-blur-sm p-6"
            style={{ background: 'hsl(var(--card) / 0.6)', boxShadow: '0 0 0 1px hsl(var(--primary) / 0.04), 0 8px 32px hsl(0 0% 0% / 0.3)' }}
          >
            <LoginButton />
          </div>
        </div>

        {/* AES badge */}
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.06)]">
          <div className="relative flex items-center justify-center">
            <span className="absolute w-4 h-4 rounded-full bg-[hsl(var(--primary)/0.3)] animate-pulse" />
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
              className="relative w-3.5 h-3.5"
              style={{ color: 'hsl(var(--primary))', filter: 'drop-shadow(0 0 4px hsl(var(--primary) / 0.8))' }}>
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-xs font-mono tracking-wider" style={{ color: 'hsl(var(--primary))' }}>AES-256-GCM</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))] font-mono">ENCRYPTED</span>
        </div>

      </div>
    </div>
  )
}
