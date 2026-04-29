'use client'

import { useState, useTransition } from 'react'
import { AccountCard } from './account-card'
import { AccountForm } from './account-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, X } from 'lucide-react'
import type { AccountWithFields } from '@/lib/data'

const PRESET_TYPES = ['Bank', 'Email', 'Investing', 'Social', 'Work', 'Shopping', 'Streaming', 'Other']

export function AccountList({ accounts }: { accounts: AccountWithFields[] }) {
  const [query, setQuery] = useState('')
  const [activeType, setActiveType] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [, startTransition] = useTransition()

  // Derive all unique types present in the vault
  const allTypes = Array.from(new Set(accounts.map((a) => a.type))).sort()

  const filtered = accounts.filter((a) => {
    const matchesType = !activeType || a.type === activeType
    if (!query.trim()) return matchesType
    const q = query.toLowerCase()
    const matchesQuery =
      a.name.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q) ||
      a.fields.some((f) => (f.fieldValue ?? '').toLowerCase().includes(q) || f.fieldKey.toLowerCase().includes(q))
    return matchesType && matchesQuery
  })

  // Group by type
  const grouped = filtered.reduce<Record<string, AccountWithFields[]>>((acc, a) => {
    if (!acc[a.type]) acc[a.type] = []
    acc[a.type].push(a)
    return acc
  }, {})

  const groupKeys = Object.keys(grouped).sort()

  return (
    <div className="flex flex-col gap-6">
      {/* Search + filter bar */}
      <div className="sticky top-14 z-40 bg-[hsl(var(--background)/0.9)] backdrop-blur-sm py-3 -mx-4 px-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <Input
              value={query}
              onChange={(e) => {
                startTransition(() => setQuery(e.target.value))
              }}
              placeholder="Search accounts…"
              className="pl-9 h-9"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)} className="h-9 gap-1.5 shrink-0">
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>

        {/* Type filter pills */}
        {allTypes.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveType(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
                !activeType
                  ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]'
              }`}
            >
              All
            </button>
            {allTypes.map((t) => (
              <button
                key={t}
                onClick={() => setActiveType(activeType === t ? null : t)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
                  activeType === t
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                    : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty state */}
      {accounts.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <p className="text-[hsl(var(--muted-foreground))] text-sm">Your vault is empty.</p>
          <Button onClick={() => setAddOpen(true)} variant="outline" size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> Add your first account
          </Button>
        </div>
      )}

      {/* No results */}
      {accounts.length > 0 && filtered.length === 0 && (
        <p className="text-center text-sm text-[hsl(var(--muted-foreground))] py-16">
          No accounts match your search.
        </p>
      )}

      {/* Grouped account cards */}
      {groupKeys.map((groupType) => (
        <section key={groupType}>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-widest">
              {groupType}
            </h2>
            <span className="text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] rounded-full px-2 py-0.5">
              {grouped[groupType].length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {grouped[groupType].map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        </section>
      ))}

      <AccountForm open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
