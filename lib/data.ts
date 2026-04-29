import { db } from '@/db'
import { auth } from '@/auth'

export async function getAllAccountsForUser() {
  const session = await auth()
  if (!session?.user?.email) return []

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, session.user!.email!),
  })
  if (!user) return []

  return db.query.accounts.findMany({
    where: (a, { eq }) => eq(a.userId, user.id),
    with: {
      fields: {
        orderBy: (f, { asc }) => [asc(f.sortOrder)],
      },
    },
    orderBy: (a, { asc }) => [asc(a.type), asc(a.name)],
  })
}

export type AccountWithFields = Awaited<ReturnType<typeof getAllAccountsForUser>>[number]
