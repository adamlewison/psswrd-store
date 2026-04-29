'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { createAccount, updateAccount, type FieldInput } from '@/actions/accounts'
import type { AccountWithFields } from '@/lib/data'
import { toast } from 'sonner'

const ACCOUNT_TYPES = ['Bank', 'Email', 'Investing', 'Social', 'Work', 'Shopping', 'Streaming', 'Other']
const FIELD_TYPES = ['text', 'password', 'pin', 'email', 'phone'] as const

type LocalField = {
  id: string
  fieldKey: string
  fieldValue: string
  fieldType: FieldInput['fieldType']
}

function newField(): LocalField {
  return { id: crypto.randomUUID(), fieldKey: '', fieldValue: '', fieldType: 'text' }
}

interface AccountFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: AccountWithFields
}

export function AccountForm({ open, onOpenChange, account }: AccountFormProps) {
  const isEdit = !!account
  const [isPending, startTransition] = useTransition()

  const [type, setType] = useState(account?.type ?? '')
  const [customType, setCustomType] = useState('')
  const [name, setName] = useState(account?.name ?? '')
  const [notes, setNotes] = useState(account?.notes ?? '')
  const [fields, setFields] = useState<LocalField[]>(
    account?.fields.map((f) => ({
      id: f.id,
      fieldKey: f.fieldKey,
      fieldValue: f.fieldValue ?? '',
      fieldType: f.fieldType as FieldInput['fieldType'],
    })) ?? [
      { id: crypto.randomUUID(), fieldKey: 'Email', fieldValue: '', fieldType: 'email' },
      { id: crypto.randomUUID(), fieldKey: 'Password', fieldValue: '', fieldType: 'password' },
    ]
  )

  const effectiveType = type === '__custom__' ? customType : type

  const addField = () => setFields((f) => [...f, newField()])

  const removeField = (id: string) => setFields((f) => f.filter((x) => x.id !== id))

  const updateField = (id: string, patch: Partial<LocalField>) =>
    setFields((f) => f.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  const moveField = (id: string, dir: -1 | 1) => {
    setFields((f) => {
      const idx = f.findIndex((x) => x.id === id)
      if (idx + dir < 0 || idx + dir >= f.length) return f
      const next = [...f]
      ;[next[idx], next[idx + dir]] = [next[idx + dir], next[idx]]
      return next
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!effectiveType || !name.trim()) {
      toast.error('Type and name are required')
      return
    }

    const fieldInputs: FieldInput[] = fields.map((f, i) => ({
      fieldKey: f.fieldKey,
      fieldValue: f.fieldValue,
      fieldType: f.fieldType,
      sortOrder: i,
    }))

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateAccount(account.id, { type: effectiveType, name, notes: notes || undefined, fields: fieldInputs })
          toast.success('Account updated')
        } else {
          await createAccount({ type: effectiveType, name, notes: notes || undefined, fields: fieldInputs })
          toast.success('Account added')
        }
        onOpenChange(false)
      } catch {
        toast.error(isEdit ? 'Failed to update account' : 'Failed to add account')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit account' : 'Add account'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type…" />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
                <SelectItem value="__custom__">Custom…</SelectItem>
              </SelectContent>
            </Select>
            {type === '__custom__' && (
              <Input
                placeholder="Custom type"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                autoFocus
              />
            )}
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input
              placeholder="e.g. Revolut"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Fields</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addField} className="h-7 gap-1 text-xs">
                <Plus className="w-3 h-3" /> Add field
              </Button>
            </div>

            {fields.map((field, i) => (
              <div key={field.id} className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(var(--muted))]">
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Key (e.g. Password)"
                      value={field.fieldKey}
                      onChange={(e) => updateField(field.id, { fieldKey: e.target.value })}
                      className="h-8 text-xs"
                    />
                    <Select
                      value={field.fieldType}
                      onValueChange={(v) => updateField(field.id, { fieldType: v as FieldInput['fieldType'] })}
                    >
                      <SelectTrigger className="h-8 text-xs w-28 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    placeholder="Value"
                    type={field.fieldType === 'password' || field.fieldType === 'pin' ? 'password' : 'text'}
                    value={field.fieldValue}
                    onChange={(e) => updateField(field.id, { fieldValue: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="flex flex-col gap-0.5 shrink-0">
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveField(field.id, -1)} disabled={i === 0}>
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveField(field.id, 1)} disabled={i === fields.length - 1}>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]" onClick={() => removeField(field.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label>Notes <span className="text-[hsl(var(--muted-foreground))] font-normal">(optional)</span></Label>
            <Textarea
              placeholder="Any notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save' : 'Add account'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
