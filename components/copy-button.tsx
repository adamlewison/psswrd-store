'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVault } from './vault-provider'
import { decryptField } from '@/lib/vault-crypto'

interface CopyButtonProps {
  ciphertextB64: string | null
  ivB64: string | null
  className?: string
}

export function CopyButton({ ciphertextB64, ivB64, className }: CopyButtonProps) {
  const { dek } = useVault()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!dek || !ciphertextB64 || !ivB64) return
    try {
      const value = await decryptField(ciphertextB64, ivB64, dek)
      if (!value) return
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Decryption or clipboard failure — fail silently
    }
  }

  return (
    <button
      onClick={handleCopy}
      disabled={!dek || !ciphertextB64}
      className={cn(
        'inline-flex items-center justify-center w-6 h-6 rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-all duration-150 shrink-0 disabled:opacity-30 disabled:cursor-not-allowed',
        className
      )}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500 transition-all duration-200" />
      ) : (
        <Copy className="w-3.5 h-3.5 transition-all duration-200" />
      )}
    </button>
  )
}
