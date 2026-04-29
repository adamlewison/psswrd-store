'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ShieldCheck } from 'lucide-react'
import { useVault } from './vault-provider'
import { toast } from 'sonner'

export function VaultSetupModal() {
  const { status, setup } = useVault()
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const open = status === 'setup_required'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (pin.length < 4) {
      setError('PIN must be at least 4 characters')
      return
    }
    if (pin !== confirm) {
      setError('PINs do not match')
      return
    }

    setLoading(true)
    try {
      await setup(pin)
      toast.success('Vault set up — you are now unlocked')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-[hsl(var(--primary))]" />
            <DialogTitle>Create your vault PIN</DialogTitle>
          </div>
        </DialogHeader>

        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
          Your PIN protects your encryption key. It is never stored — losing it means losing access
          to your stored credentials.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 4 characters"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pin-confirm">Confirm PIN</Label>
            <Input
              id="pin-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat PIN"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
          )}

          <Button type="submit" disabled={loading || !pin || !confirm} className="w-full mt-1">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Deriving key…
              </>
            ) : (
              'Set up vault'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
