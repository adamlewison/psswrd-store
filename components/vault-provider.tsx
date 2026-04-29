'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  deriveKek,
  generateDek,
  wrapDek,
  unwrapDek,
} from '@/lib/vault-crypto'

// ── Types ──────────────────────────────────────────────────────────────────

export type VaultStatus = 'loading' | 'setup_required' | 'locked' | 'unlocked'

interface VaultContextValue {
  status: VaultStatus
  dek: CryptoKey | null
  /** Setup vault for the first time. Throws on failure. */
  setup: (pin: string) => Promise<void>
  /** Unlock vault with PIN. Returns true on success, false on wrong PIN. */
  unlock: (pin: string) => Promise<boolean>
  /** Manually lock the vault (clears DEK from memory). */
  lock: () => void
  /** Change PIN. Vault must be unlocked. Throws on failure. */
  changePin: (newPin: string) => Promise<void>
}

const VaultContext = createContext<VaultContextValue | null>(null)

const INACTIVITY_MS = 15 * 60 * 1000 // 15 minutes

// ── Provider ───────────────────────────────────────────────────────────────

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>('loading')
  const [dek, setDek] = useState<CryptoKey | null>(null)
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Initial status check ──────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/vault/status')
      .then((r) => r.json())
      .then((data: { hasVault?: boolean }) => {
        setStatus(data.hasVault ? 'locked' : 'setup_required')
      })
      .catch(() => setStatus('locked')) // err-safe: prompt for PIN
  }, [])

  // ── Auto-lock ─────────────────────────────────────────────────────────

  const lock = useCallback(() => {
    setDek(null)
    setStatus('locked')
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
  }, [])

  useEffect(() => {
    if (!dek) return

    const resetTimer = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
      inactivityTimer.current = setTimeout(lock, INACTIVITY_MS)
    }

    resetTimer()

    const EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const
    EVENTS.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }))

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') lock()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    const onBeforeUnload = () => lock()
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
      EVENTS.forEach((e) => window.removeEventListener(e, resetTimer))
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [dek, lock])

  // ── Setup ─────────────────────────────────────────────────────────────

  const setup = useCallback(async (pin: string) => {
    // Step 1: get HMAC + kekSalt from server
    const initRes = await fetch('/api/vault/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error ?? 'Setup failed')
    }
    const { hmac, kekSalt } = await initRes.json() as { hmac: string; kekSalt: string }

    // Step 2: derive KEK, generate + wrap DEK client-side
    const kek = await deriveKek(hmac, kekSalt)
    const newDek = await generateDek()
    const { wrappedDekB64, dekIvB64 } = await wrapDek(newDek, kek)

    // Step 3: send wrapped DEK to server
    const confirmRes = await fetch('/api/vault/setup/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wrappedDek: wrappedDekB64, dekIv: dekIvB64 }),
    })
    if (!confirmRes.ok) {
      const err = await confirmRes.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error ?? 'Setup confirm failed')
    }

    setDek(newDek)
    setStatus('unlocked')
  }, [])

  // ── Unlock ────────────────────────────────────────────────────────────

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    const res = await fetch('/api/vault/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })

    if (!res.ok) {
      // Rate limit or lockout — don't report to /result (server already counted)
      return false
    }

    const { hmac, kekSalt, wrappedDek, dekIv } = await res.json() as {
      hmac: string
      kekSalt: string
      wrappedDek: string
      dekIv: string
    }

    try {
      const kek = await deriveKek(hmac, kekSalt)
      const unwrapped = await unwrapDek(wrappedDek, dekIv, kek)

      // Report success
      await fetch('/api/vault/unlock/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }),
      })

      setDek(unwrapped)
      setStatus('unlocked')
      return true
    } catch {
      // Decryption failed — wrong PIN or corrupted data
      await fetch('/api/vault/unlock/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false }),
      }).catch(() => {})
      return false
    }
  }, [])

  // ── Change PIN ────────────────────────────────────────────────────────

  const changePin = useCallback(
    async (newPin: string) => {
      if (!dek) throw new Error('Vault must be unlocked to change PIN')

      // Step 1: get new HMAC + new kekSalt for the new PIN
      const initRes = await fetch('/api/vault/change-pin/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPin }),
      })
      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Change PIN init failed')
      }
      const { hmac, kekSalt } = await initRes.json() as { hmac: string; kekSalt: string }

      // Step 2: derive new KEK, re-wrap existing DEK
      const newKek = await deriveKek(hmac, kekSalt)
      const { wrappedDekB64, dekIvB64 } = await wrapDek(dek, newKek)

      // Step 3: commit
      const commitRes = await fetch('/api/vault/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kekSalt, wrappedDek: wrappedDekB64, dekIv: dekIvB64 }),
      })
      if (!commitRes.ok) {
        const err = await commitRes.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Change PIN failed')
      }
    },
    [dek],
  )

  return (
    <VaultContext.Provider value={{ status, dek, setup, unlock, lock, changePin }}>
      {children}
    </VaultContext.Provider>
  )
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault must be used inside VaultProvider')
  return ctx
}
