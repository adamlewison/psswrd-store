'use client'

import { useState, useTransition } from 'react'
import { saveSpreadsheetId } from '@/actions/sync'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SyncButton } from './sync-button'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface SheetsSettingsProps {
  spreadsheetId: string | null
  serviceAccountEmail: string | null
}

export function SheetsSettings({ spreadsheetId: initialId, serviceAccountEmail }: SheetsSettingsProps) {
  const [sheetId, setSheetId] = useState(initialId ?? '')
  const [savedId, setSavedId] = useState(initialId ?? '')
  const [isPending, startTransition] = useTransition()

  if (!serviceAccountEmail) {
    return (
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Google Sheets sync is not configured for this app.
      </p>
    )
  }

  const handleSave = () => {
    if (!sheetId.trim()) {
      toast.error('Please enter a Sheet ID')
      return
    }
    startTransition(async () => {
      try {
        await saveSpreadsheetId(sheetId.trim())
        setSavedId(sheetId.trim())
        toast.success('Sheet ID saved')
      } catch {
        toast.error('Failed to save Sheet ID')
      }
    })
  }

  const handleClear = () => {
    startTransition(async () => {
      try {
        await saveSpreadsheetId('')
        setSheetId('')
        setSavedId('')
        toast.success('Sheet ID cleared')
      } catch {
        toast.error('Failed to clear Sheet ID')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-[hsl(var(--muted-foreground))] space-y-1.5">
        <p>Share your Google Sheet with the service account (Editor access), then paste the Sheet ID below.</p>
        <p>
          Service account:{' '}
          <code className="text-xs bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded font-mono">
            {serviceAccountEmail}
          </code>
        </p>
        <p className="text-xs">
          The Sheet ID is the long string in the URL between <code>/d/</code> and <code>/edit</code>.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Sheet ID</Label>
        <div className="flex gap-2">
          <Input
            value={sheetId}
            onChange={(e) => setSheetId(e.target.value)}
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
            className="font-mono text-sm"
          />
          <Button onClick={handleSave} disabled={isPending} className="shrink-0">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </div>

      {savedId && (
        <div className="flex items-center gap-3 pt-2 border-t border-[hsl(var(--border))]">
          <SyncButton />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={isPending}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  )
}
