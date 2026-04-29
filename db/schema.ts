import { sql, relations } from 'drizzle-orm'
import { text, integer, blob, sqliteTable } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  emailVerified: integer('email_verified', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  // Vault fields — added for zero-knowledge encryption
  wrappedDek: blob('wrapped_dek'),       // AES-GCM(key=KEK, plaintext=DEK) — 48 bytes
  dekIv: blob('dek_iv'),                 // 12-byte IV used to wrap the DEK
  kekSalt: blob('kek_salt'),             // 16-byte random salt (Argon2id salt & HMAC input)
  pinAttempts: integer('pin_attempts').notNull().default(0),
  pinLockedUntil: integer('pin_locked_until'), // Unix timestamp, nullable
})

export const verificationTokens = sqliteTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull().primaryKey(),
  expires: integer('expires', { mode: 'timestamp' }).notNull(),
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  name: text('name').notNull(),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const accountFields = sqliteTable('account_fields', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  fieldKey: text('field_key').notNull(),
  // field_value replaced by encrypted blobs
  fieldValueCiphertext: blob('field_value_ciphertext'), // AES-GCM ciphertext (includes 16-byte auth tag)
  fieldValueIv: blob('field_value_iv'),                 // 12-byte IV per field
  fieldType: text('field_type')
    .notNull()
    .default('text'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  spreadsheetId: text('spreadsheet_id'),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  settings: one(userSettings, { fields: [users.id], references: [userSettings.userId] }),
}))

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  fields: many(accountFields),
}))

export const accountFieldsRelations = relations(accountFields, ({ one }) => ({
  account: one(accounts, { fields: [accountFields.accountId], references: [accounts.id] }),
}))

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, { fields: [userSettings.userId], references: [users.id] }),
}))
