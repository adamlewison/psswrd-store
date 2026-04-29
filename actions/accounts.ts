'use server'

import { db } from '@/db'
import { accounts, accountFields } from '@/db/schema'
import { auth } from '@/auth'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { revalidatePath } from 'next/cache'

async function getAuthedUserId() {
  const session = await auth()
  if (!session?.user?.email) throw new Error('Unauthorized')
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, session.user!.email!),
  })
  if (!user) throw new Error('User not found')
  return user.id
}

/**
 * Encrypted field input. ciphertextB64/ivB64 are base64-encoded AES-GCM blobs
 * produced by the client. Server stores them opaquely — never decrypts.
 */
export type FieldInput = {
  fieldKey: string
  ciphertextB64: string | null  // null = empty field value
  ivB64: string | null
  fieldType: 'text' | 'password' | 'pin' | 'email' | 'phone'
  sortOrder: number
}

function toDbField(f: FieldInput, accountId: string) {
  return {
    id: nanoid(),
    accountId,
    fieldKey: f.fieldKey,
    fieldValueCiphertext: f.ciphertextB64 ? Buffer.from(f.ciphertextB64, 'base64') : null,
    fieldValueIv: f.ivB64 ? Buffer.from(f.ivB64, 'base64') : null,
    fieldType: f.fieldType,
    sortOrder: f.sortOrder,
  }
}

export async function createAccount(data: {
  type: string
  name: string
  notes?: string
  fields: FieldInput[]
}) {
  const userId = await getAuthedUserId()
  const accountId = nanoid()

  await db.insert(accounts).values({
    id: accountId,
    userId,
    type: data.type,
    name: data.name,
    notes: data.notes ?? null,
  })

  if (data.fields.length > 0) {
    await db.insert(accountFields).values(data.fields.map((f) => toDbField(f, accountId)))
  }

  revalidatePath('/')
  return { id: accountId }
}

export async function updateAccount(
  accountId: string,
  data: {
    type: string
    name: string
    notes?: string
    fields: FieldInput[]
  }
) {
  const userId = await getAuthedUserId()

  const account = await db.query.accounts.findFirst({
    where: (a, { eq, and }) => and(eq(a.id, accountId), eq(a.userId, userId)),
  })
  if (!account) throw new Error('Account not found')

  await db
    .update(accounts)
    .set({ type: data.type, name: data.name, notes: data.notes ?? null })
    .where(eq(accounts.id, accountId))

  await db.delete(accountFields).where(eq(accountFields.accountId, accountId))

  if (data.fields.length > 0) {
    await db.insert(accountFields).values(data.fields.map((f) => toDbField(f, accountId)))
  }

  revalidatePath('/')
}

export async function deleteAccount(accountId: string) {
  const userId = await getAuthedUserId()
  await db
    .delete(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
  revalidatePath('/')
}
