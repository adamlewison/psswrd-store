import type { Adapter, AdapterUser } from '@auth/core/adapters'
import { db } from '@/db'
import { users, verificationTokens } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'

type DbUser = typeof users.$inferSelect

function toAdapterUser(user: DbUser): AdapterUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified ?? null,
    name: user.name,
    image: user.image,
  }
}

export const DrizzleAdapter: Adapter = {
  async createUser(user) {
    const id = nanoid()
    await db.insert(users).values({
      id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      emailVerified: user.emailVerified ?? null,
    })
    const created = await db.select().from(users).where(eq(users.id, id)).get()
    return toAdapterUser(created!)
  },

  async getUser(id) {
    const user = await db.select().from(users).where(eq(users.id, id)).get()
    return user ? toAdapterUser(user) : null
  },

  async getUserByEmail(email) {
    const user = await db.select().from(users).where(eq(users.email, email)).get()
    return user ? toAdapterUser(user) : null
  },

  async updateUser({ id, ...rest }) {
    const set: Partial<typeof users.$inferInsert> = {}
    if ('email' in rest && rest.email !== undefined) set.email = rest.email
    if ('name' in rest) set.name = rest.name ?? null
    if ('image' in rest) set.image = rest.image ?? null
    if ('emailVerified' in rest) set.emailVerified = rest.emailVerified ?? null
    await db.update(users).set(set).where(eq(users.id, id))
    const updated = await db.select().from(users).where(eq(users.id, id)).get()
    return toAdapterUser(updated!)
  },

  // No OAuth accounts table — fall back to getUserByEmail for linking
  async getUserByAccount() {
    return null
  },

  async linkAccount() {
    // no-op
  },

  async createVerificationToken(token) {
    await db.insert(verificationTokens).values({
      identifier: token.identifier,
      token: token.token,
      expires: token.expires,
    })
    return token
  },

  async useVerificationToken({ identifier, token }) {
    const record = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, identifier),
          eq(verificationTokens.token, token),
        ),
      )
      .get()
    if (!record) return null
    await db
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, identifier),
          eq(verificationTokens.token, token),
        ),
      )
    return { identifier: record.identifier, token: record.token, expires: record.expires }
  },
}
