import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import LoginButton from './login-button'

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect('/')

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] relative overflow-hidden">
      {/* Radial gradient background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, hsl(230 80% 62% / 0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm px-4">
        {/* Lock icon + app name */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] flex items-center justify-center shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-7 h-7 text-[hsl(var(--foreground))]"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
            Vault
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] text-center">
            Your passwords. Yours alone.
          </p>
        </div>

        {/* Login card */}
        <div className="w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.8)] backdrop-blur-sm p-6 shadow-sm">
          <LoginButton />
        </div>

        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
          Your vault is private and fully isolated.
        </p>
      </div>
    </div>
  )
}
