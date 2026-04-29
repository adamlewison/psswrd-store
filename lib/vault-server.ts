import { createHmac, randomBytes } from 'crypto'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/auth'

/** Authenticated user record including vault fields. Throws on failure. */
export async function getAuthedUser() {
  const session = await auth()
  if (!session?.user?.email) throw new Error('Unauthorized')
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, session.user!.email!),
  })
  if (!user) throw new Error('User not found')
  return user
}

/**
 * HMAC-SHA256(key=VAULT_PEPPER, message=kekSalt || pinUtf8)
 * Returns 32-byte Buffer. Never logs the PIN.
 */
export function computeHmac(kekSalt: Buffer, pin: string): Buffer {
  const pepper = Buffer.from(process.env.VAULT_PEPPER!, 'base64')
  const hmac = createHmac('sha256', pepper)
  hmac.update(Buffer.concat([kekSalt, Buffer.from(pin, 'utf8')]))
  return hmac.digest()
}

/** Generate 16 cryptographically random bytes for use as kek_salt. */
export function generateSalt(): Buffer {
  return randomBytes(16)
}

export type DbUser = Awaited<ReturnType<typeof getAuthedUser>>

/** Store kek_salt in users row (step 1 of setup — before wrapped DEK is known). */
export async function saveKekSalt(userId: string, kekSalt: Buffer) {
  await db.update(users).set({ kekSalt }).where(eq(users.id, userId))
}

/** Finalize vault setup: store wrapped DEK and IV. Resets lockout state. */
export async function finalizeVaultSetup(
  userId: string,
  wrappedDek: Buffer,
  dekIv: Buffer,
) {
  await db.update(users).set({
    wrappedDek,
    dekIv,
    pinAttempts: 0,
    pinLockedUntil: null,
  }).where(eq(users.id, userId))
}

/** Rotate kek_salt + wrapped DEK atomically (for change-pin). */
export async function rotateVaultKeys(
  userId: string,
  newKekSalt: Buffer,
  newWrappedDek: Buffer,
  newDekIv: Buffer,
) {
  await db.update(users).set({
    kekSalt: newKekSalt,
    wrappedDek: newWrappedDek,
    dekIv: newDekIv,
    pinAttempts: 0,
    pinLockedUntil: null,
  }).where(eq(users.id, userId))
}

/** Record a successful or failed unlock attempt. */
export async function recordUnlockAttempt(userId: string, success: boolean) {
  if (success) {
    await db.update(users).set({ pinAttempts: 0, pinLockedUntil: null }).where(eq(users.id, userId))
    return
  }

  const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, userId) })
  if (!user) return

  const newAttempts = (user.pinAttempts ?? 0) + 1
  let lockedUntil: number | null = null

  if (newAttempts >= 20) {
    // 1 hour lockout + flag for re-OAuth (store as far-future timestamp)
    lockedUntil = Math.floor(Date.now() / 1000) + 3600
  } else if (newAttempts >= 10) {
    lockedUntil = Math.floor(Date.now() / 1000) + 900  // 15 min
  } else if (newAttempts >= 5) {
    lockedUntil = Math.floor(Date.now() / 1000) + 60   // 1 min
  }

  await db.update(users).set({
    pinAttempts: newAttempts,
    pinLockedUntil: lockedUntil,
  }).where(eq(users.id, userId))
}

/** Returns null if ok, or an error message string if locked. */
export function checkLockout(user: DbUser): string | null {
  const now = Math.floor(Date.now() / 1000)
  if (user.pinLockedUntil && user.pinLockedUntil > now) {
    const secs = user.pinLockedUntil - now
    if (user.pinAttempts >= 20) {
      return `Vault locked. Re-authenticate and try again in ${Math.ceil(secs / 60)} min.`
    }
    return `Too many attempts. Try again in ${secs < 60 ? secs + 's' : Math.ceil(secs / 60) + ' min'}.`
  }
  return null
}
