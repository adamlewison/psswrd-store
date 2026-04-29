'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldValue } from './field-value'
import { CopyButton } from './copy-button'
import { DeleteDialog } from './delete-dialog'
import { AccountForm } from './account-form'
import type { AccountWithFields } from '@/lib/data'

function getTypeBadgeClass(type: string): string {
  const map: Record<string, string> = {
    Bank: 'type-bank',
    Email: 'type-email',
    Investing: 'type-investing',
    Social: 'type-social',
    Work: 'type-work',
    Streaming: 'type-streaming',
    Shopping: 'type-shopping',
  }
  return map[type] ?? 'type-other'
}

export function AccountCard({ account }: { account: AccountWithFields }) {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <>
      <div className="group relative rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:border-[hsl(var(--border)/0.8)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-150 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span
              className={`inline-block self-start px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.08em] ${getTypeBadgeClass(account.type)}`}
            >
              {account.type}
            </span>
            <h3 className="text-[18px] font-medium leading-snug text-[hsl(var(--foreground))] truncate">
              {account.name}
            </h3>
          </div>

          <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <DeleteDialog accountId={account.id} accountName={account.name} />
          </div>
        </div>

        {/* Notes */}
        {account.notes && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{account.notes}</p>
        )}

        {/* Fields */}
        {account.fields.length > 0 && (
          <div className="flex flex-col gap-2 pt-1 border-t border-[hsl(var(--border))]">
            {account.fields.map((field) => (
              <div key={field.id} className="flex items-center justify-between gap-2">
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-[12px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide leading-none">
                    {field.fieldKey}
                  </span>
                  <FieldValue
                    ciphertextB64={field.fieldValueCiphertext}
                    ivB64={field.fieldValueIv}
                    fieldType={field.fieldType as 'text' | 'password' | 'pin' | 'email' | 'phone'}
                  />
                </div>
                <CopyButton
                  ciphertextB64={field.fieldValueCiphertext}
                  ivB64={field.fieldValueIv}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <AccountForm open={editOpen} onOpenChange={setEditOpen} account={account} />
    </>
  )
}
