'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { useVault } from './vault-provider'
import { decryptField } from '@/lib/vault-crypto'

type FieldType = 'text' | 'password' | 'pin' | 'email' | 'phone'

interface FieldValueProps {
  ciphertextB64: string | null
  ivB64: string | null
  fieldType: FieldType
}

export function FieldValue({ ciphertextB64, ivB64, fieldType }: FieldValueProps) {
  const { dek } = useVault()
  const [value, setValue] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const isSensitive = fieldType === 'password' || fieldType === 'pin'

  useEffect(() => {
    setValue(null)
    setRevealed(false)
    if (!dek || !ciphertextB64 || !ivB64) return

    let cancelled = false
    decryptField(ciphertextB64, ivB64, dek)
      .then((v) => { if (!cancelled) setValue(v) })
      .catch(() => { if (!cancelled) setValue(null) })

    return () => { cancelled = true }
  }, [dek, ciphertextB64, ivB64])

  if (!dek || value === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[hsl(var(--muted-foreground))] italic text-sm">
        <Lock className="w-3 h-3" />
        locked
      </span>
    )
  }

  if (!isSensitive) {
    return (
      <span className="font-mono text-sm break-all">
        {value || <span className="text-[hsl(var(--muted-foreground))] italic">empty</span>}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="font-mono text-sm transition-all duration-200"
        style={{
          filter: revealed ? 'none' : 'blur(4px)',
          opacity: revealed ? 1 : 0.7,
        }}
      >
        {value || '••••••••'}
      </span>
      <button
        onClick={() => setRevealed((r) => !r)}
        className="inline-flex items-center justify-center w-5 h-5 rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors shrink-0"
        title={revealed ? 'Hide' : 'Reveal'}
      >
        {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </span>
  )
}
