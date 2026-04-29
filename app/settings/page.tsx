import { auth } from '@/auth'
import { getSpreadsheetId } from '@/actions/sync'
import { db } from '@/db'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SheetsSettings } from '@/components/sheets-settings'
import { ExportButton } from '@/components/export-button'
import { ImportButton } from '@/components/import-button'
import Image from 'next/image'

export default async function SettingsPage() {
  const session = await auth()
  const spreadsheetId = await getSpreadsheetId()

  let userRecord = null
  if (session?.user?.email) {
    userRecord = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, session.user!.email!),
    })
  }

  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? null

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <div className="max-w-[860px] mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to vault
        </Link>

        <h1 className="text-2xl font-semibold mb-8">Settings</h1>

        {/* Account info */}
        <section className="mb-6 p-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-4">
            Account
          </h2>
          <div className="flex items-center gap-4">
            {session?.user?.image && (
              <Image
                src={session.user.image}
                alt={session.user.name ?? 'Avatar'}
                width={48}
                height={48}
                className="rounded-full shrink-0"
              />
            )}
            <div>
              <p className="font-medium">{session?.user?.name}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{session?.user?.email}</p>
              {userRecord?.createdAt && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                  Member since{' '}
                  {new Date(userRecord.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Export */}
        <section className="mb-6 p-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">
            Export
          </h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
            Download all your vault data as a CSV file.
          </p>
          <div className="flex flex-wrap gap-2">
            <ExportButton />
            <ImportButton />
          </div>
        </section>

        {/* Google Sheets sync */}
        <section className="p-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-4">
            Google Sheets Sync
          </h2>
          <SheetsSettings
            spreadsheetId={spreadsheetId}
            serviceAccountEmail={serviceAccountEmail}
          />
        </section>
      </div>
    </div>
  )
}
