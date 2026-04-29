import { db } from '@/db'
import { accounts, accountFields } from '@/db/schema'
import { eq, inArray, asc } from 'drizzle-orm'
import { auth } from '@/auth'

/** Convert a blob column value (Buffer/Uint8Array) to base64 string, or null. */
function blobToB64(blob: Buffer | Uint8Array | null | undefined): string | null {
  if (!blob) return null
  return Buffer.from(blob).toString('base64')
}

export async function getAllAccountsForUser() {
  const session = await auth()
  if (!session?.user?.email) return []

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, session.user!.email!),
  })
  if (!user) return []

  // Two separate queries avoid json_group_array over BLOB columns (libsql limitation)
  const accts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, user.id))
    .orderBy(asc(accounts.type), asc(accounts.name))

  if (accts.length === 0) return []

  const accountIds = accts.map((a) => a.id)
  const fields = await db
    .select()
    .from(accountFields)
    .where(inArray(accountFields.accountId, accountIds))
    .orderBy(asc(accountFields.sortOrder))

  const fieldsByAccount = new Map<string, typeof fields>()
  for (const f of fields) {
    const list = fieldsByAccount.get(f.accountId) ?? []
    list.push(f)
    fieldsByAccount.set(f.accountId, list)
  }

  return accts.map((account) => ({
    ...account,
    fields: (fieldsByAccount.get(account.id) ?? []).map((f) => ({
      ...f,
      fieldValueCiphertext: blobToB64(f.fieldValueCiphertext as Buffer | null),
      fieldValueIv: blobToB64(f.fieldValueIv as Buffer | null),
    })),
  }))
}

export type AccountWithFields = Awaited<ReturnType<typeof getAllAccountsForUser>>[number]
export type FieldWithCiphertext = AccountWithFields['fields'][number]
