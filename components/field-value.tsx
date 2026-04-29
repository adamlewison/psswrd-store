'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type FieldType = 'text' | 'password' | 'pin' | 'email' | 'phone'

export function FieldValue({ value, fieldType }: { value: string; fieldType: FieldType }) {
  const [revealed, setRevealed] = useState(false)
  const isSensitive = fieldType === 'password' || fieldType === 'pin'

  if (!isSensitive) {
    return (
      <span className="font-mono text-sm break-all">{value || <span className="text-[hsl(var(--muted-foreground))] italic">empty</span>}</span>
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
