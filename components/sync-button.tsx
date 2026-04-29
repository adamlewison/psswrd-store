'use client'

import { useTransition } from 'react'
import { importFromSheet, exportToSheet } from '@/actions/sync'
import { Button } from '@/components/ui/button'
import { Loader2, Download, Upload, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useState } from 'react'

export function SyncButton() {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  const handleImport = () => {
    setOpen(false)
    startTransition(async () => {
      try {
        const { imported } = await importFromSheet()
        toast.success(`Imported ${imported} account${imported === 1 ? '' : 's'} from Google Sheets`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Import failed')
      }
    })
  }

  const handleExport = () => {
    setOpen(false)
    startTransition(async () => {
      try {
        const { exported } = await exportToSheet()
        toast.success(`Exported ${exported} account${exported === 1 ? '' : 's'} to Google Sheets`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Export failed')
      }
    })
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        className="gap-1.5"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            Sync
            <ChevronDown className="w-3.5 h-3.5" />
          </>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 w-48 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-md p-1">
            <button
              onClick={handleImport}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <Download className="w-4 h-4" />
              Import from Sheets
            </button>
            <button
              onClick={handleExport}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <Upload className="w-4 h-4" />
              Export to Sheets
            </button>
          </div>
        </>
      )}
    </div>
  )
}
