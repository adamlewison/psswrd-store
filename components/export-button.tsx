'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { useVault } from './vault-provider'
import { decryptField } from '@/lib/vault-crypto'
import { toast } from 'sonner'
import type { AccountWithFields } from '@/lib/data'

function escapeCsv(value: string | null | undefined): string {
  const s = value ?? ''
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function ExportButton() {
  const { dek } = useVault()
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    if (!dek) {
      toast.error('Unlock your vault to export')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/export')
      if (res.status === 204) {
        toast.info('No accounts to export')
        return
      }
      if (!res.ok) throw new Error('Export failed')

      const accounts = await res.json() as AccountWithFields[]

      // Collect all unique field keys
      const allFieldKeys = Array.from(
        new Set(accounts.flatMap((a) => a.fields.map((f) => f.fieldKey))),
      )
      const headers = ['Type', 'Name', 'Notes', ...allFieldKeys]

      // Decrypt each account's fields client-side
      const rows = await Promise.all(
        accounts.map(async (account) => {
          const fieldMap: Record<string, string> = {}
          await Promise.all(
            account.fields.map(async (f) => {
              if (f.fieldValueCiphertext && f.fieldValueIv) {
                try {
                  fieldMap[f.fieldKey] = await decryptField(f.fieldValueCiphertext, f.fieldValueIv, dek)
                } catch {
                  fieldMap[f.fieldKey] = ''
                }
              } else {
                fieldMap[f.fieldKey] = ''
              }
            })
          )
          return [
            escapeCsv(account.type),
            escapeCsv(account.name),
            escapeCsv(account.notes),
            ...allFieldKeys.map((key) => escapeCsv(fieldMap[key])),
          ].join(',')
        })
      )

      const csv = [headers.map(escapeCsv).join(','), ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vault-export-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      Export CSV
    </Button>
  )
}
