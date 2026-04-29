import { auth, signOut } from '@/auth'
import { ThemeToggle } from './theme-toggle'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'
import { Settings, Lock, LogOut } from 'lucide-react'

async function SignOutButton() {
  return (
    <form
      action={async () => {
        'use server'
        await signOut({ redirectTo: '/login' })
      }}
    >
      <Button variant="ghost" size="icon" className="h-8 w-8" title="Sign out" type="submit">
        <LogOut className="w-4 h-4" />
      </Button>
    </form>
  )
}

export async function TopBar() {
  const session = await auth()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/0.85)] backdrop-blur-md">
      <div className="max-w-[860px] mx-auto h-full px-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-[hsl(var(--foreground))] hover:opacity-80 transition-opacity">
          <Lock className="w-4 h-4" />
          Vault
        </Link>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Settings">
              <Settings className="w-4 h-4" />
            </Button>
          </Link>
          {session?.user?.image && (
            <Image
              src={session.user.image}
              alt={session.user.name ?? 'Avatar'}
              width={28}
              height={28}
              className="rounded-full mx-1"
            />
          )}
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
