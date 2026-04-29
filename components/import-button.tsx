'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, Loader2 } from 'lucide-react'
import { createAccount, type FieldInput } from '@/actions/accounts'
import { detectFieldType, parseCsvLine, funName } from '@/lib/csv-utils'
import { encryptField } from '@/lib/vault-crypto'
import { useVault } from './vault-provider'
import { toast } from 'sonner'

export function ImportButton() {
  const { dek } = useVault()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!dek) {
      toast.error('Unlock your vault to import')
      return
    }

    setLoading(true)
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      if (lines.length < 2) {
        toast.info('CSV has no data rows')
        return
      }

      const headers = parseCsvLine(lines[0]).map((h) => h.trim())
      const col = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase())
      const typeIdx = col('Type')
      const nameIdx = col('Name')
      const notesIdx = col('Notes')

      const reservedIdxs = new Set([typeIdx, nameIdx, notesIdx].filter((i) => i !== -1))
      const fieldCols = headers.map((key, i) => ({ key, i })).filter(({ i }) => !reservedIdxs.has(i))

      let imported = 0
      let namelessCount = 0

      for (const line of lines.slice(1)) {
        const cells = parseCsvLine(line)
        const get = (idx: number) => (idx === -1 ? '' : cells[idx]?.trim() ?? '')

        const type = get(typeIdx) || 'Other'
        const name = get(nameIdx) || funName(namelessCount++)
        const notes = get(notesIdx)

        // Parse field columns, encrypt each value client-side
        const fields: FieldInput[] = []
        for (const { key, i } of fieldCols) {
          const value = cells[i]?.trim() ?? ''
          if (!key || !value) continue
          const { ciphertextB64, ivB64 } = await encryptField(value, dek)
          fields.push({
            fieldKey: key,
            ciphertextB64,
            ivB64,
            fieldType: detectFieldType(key, value),
            sortOrder: fields.length,
          })
        }

        await createAccount({ type, name, notes: notes || undefined, fields })
        imported++
      }

      toast.success(`Imported ${imported} account${imported !== 1 ? 's' : ''}`)
    } catch {
      toast.error('Import failed — check the file format')
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        Import CSV
      </Button>
    </>
  )
}
