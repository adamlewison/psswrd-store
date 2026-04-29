# PasswordManager — Full Build Specification

> A personal password manager web app built with Next.js 15. This document is a complete, unambiguous specification for an AI agent to implement the full application from scratch. Follow every section in order. Do not skip steps. Do not make assumptions not covered here — refer back to this document.

---

## 1. Project Overview

A multi-user password manager where anyone can sign up with their Google account and manage their own credentials privately. Each account has a type, a name, and an arbitrary set of custom key/value fields (e.g. Username, Password, Pin, Cell Number — whatever is relevant for that account). Data is stored in a persistent SQLite database (Turso). Each user's data is fully isolated — no user can ever see another user's data. An optional per-user Google Sheets sync lets each user connect their own sheet.

**Core goals:**
- Fast, no friction. Open it, find what you need, copy it, close it.
- Elegant UI with polished dark/light mode.
- Every user's vault is completely private — data is always scoped by authenticated user ID.
- Runs indefinitely on Vercel + Turso free tiers with no maintenance.

---

## 2. Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | Use `npx create-next-app@latest` with TypeScript, Tailwind, App Router |
| Language | TypeScript (strict) | `"strict": true` in tsconfig |
| Auth | NextAuth.js v5 (`next-auth@beta`) | Google OAuth provider only |
| Database | Turso (LibSQL / SQLite) | `@libsql/client` + `drizzle-orm` |
| ORM | Drizzle ORM | Schema-first, type-safe, lightweight |
| DB migrations | `drizzle-kit` | `drizzle.config.ts` at root |
| Styling | Tailwind CSS v4 + `tailwindcss-animate` | CSS variables for theming |
| UI components | shadcn/ui | Init with `npx shadcn@latest init` |
| Icons | `lucide-react` | Already bundled with shadcn |
| Google Sheets | `googleapis` npm package | Service account auth (no user prompt) |
| Fonts | Geist Sans + Geist Mono | Already default in `create-next-app` |
| Hosting | Vercel | Deploy via GitHub integration |
| Env secrets | Vercel Environment Variables | Never commit secrets |

**Do not add** any additional libraries beyond those listed above without a clear reason. Keep the bundle small.

---

## 3. Environment Variables

Create a `.env.local` file at the root. Add all of these to Vercel's project settings as well.

```env
# NextAuth
AUTH_SECRET=<generate with: openssl rand -base64 32>
AUTH_GOOGLE_ID=<Google OAuth client ID>
AUTH_GOOGLE_SECRET=<Google OAuth client secret>

# Turso
TURSO_DATABASE_URL=libsql://<your-db-name>.turso.io
TURSO_AUTH_TOKEN=<your-turso-auth-token>

# Google Sheets sync — shared service account used for all users' sheet connections
# Leave empty to disable the Sheets sync feature entirely
GOOGLE_SERVICE_ACCOUNT_EMAIL=<service-account@project.iam.gserviceaccount.com>
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=<"-----BEGIN PRIVATE KEY-----\n...">
```

---

## 4. Database Schema

File: `src/db/schema.ts`

Use Drizzle ORM with LibSQL dialect. Define the following tables:

```ts
import { sql } from 'drizzle-orm'
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),      // e.g. "Bank", "Email", "Investing", "Social"
  name: text('name').notNull(),      // e.g. "Revolut", "Google", "LinkedIn"
  notes: text('notes'),              // optional free-text notes
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
  fieldKey: text('field_key').notNull(),     // e.g. "Password", "Username", "Pin"
  fieldValue: text('field_value'),           // the actual value (may be empty)
  fieldType: text('field_type')              // "text" | "password" | "pin" | "email" | "phone"
    .notNull()
    .default('text'),
  sortOrder: integer('sort_order').notNull().default(0),
})

// Stores per-user settings — currently just their Google Sheet ID for sync
export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  spreadsheetId: text('spreadsheet_id'),  // null = sync not configured
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})
```

File: `drizzle.config.ts` at project root:

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
})
```

File: `src/db/index.ts`:

```ts
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

export const db = drizzle(client, { schema })
```

Run migrations with:
```bash
npx drizzle-kit push
```

---

## 5. Authentication

File: `src/auth.ts`

```ts
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false
      // Auto-create user record on first sign-in
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .get()
      if (!existing) {
        await db.insert(users).values({
          id: nanoid(),
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
        })
      }
      return true
    },
    async session({ session }) {
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
})
```

File: `src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from '@/auth'
export const { GET, POST } = handlers
```

File: `src/middleware.ts` — protect all routes except `/login` and `/api/auth`:

```ts
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthRoute = req.nextUrl.pathname.startsWith('/api/auth')
  const isLoginPage = req.nextUrl.pathname === '/login'

  if (isAuthRoute || isLoginPage) return NextResponse.next()
  if (!isLoggedIn) return NextResponse.redirect(new URL('/login', req.url))
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

---

## 6. Server Actions

All data mutations are Server Actions. Create in `src/actions/`.

### `src/actions/accounts.ts`

```ts
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

export type FieldInput = {
  fieldKey: string
  fieldValue: string
  fieldType: 'text' | 'password' | 'pin' | 'email' | 'phone'
  sortOrder: number
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
    await db.insert(accountFields).values(
      data.fields.map((f) => ({
        id: nanoid(),
        accountId,
        fieldKey: f.fieldKey,
        fieldValue: f.fieldValue,
        fieldType: f.fieldType,
        sortOrder: f.sortOrder,
      }))
    )
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

  // Verify ownership
  const account = await db.query.accounts.findFirst({
    where: (a, { eq, and }) => and(eq(a.id, accountId), eq(a.userId, userId)),
  })
  if (!account) throw new Error('Account not found')

  await db
    .update(accounts)
    .set({ type: data.type, name: data.name, notes: data.notes ?? null })
    .where(eq(accounts.id, accountId))

  // Replace all fields
  await db.delete(accountFields).where(eq(accountFields.accountId, accountId))

  if (data.fields.length > 0) {
    await db.insert(accountFields).values(
      data.fields.map((f) => ({
        id: nanoid(),
        accountId,
        fieldKey: f.fieldKey,
        fieldValue: f.fieldValue,
        fieldType: f.fieldType,
        sortOrder: f.sortOrder,
      }))
    )
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
```

### `src/actions/sync.ts`

```ts
'use server'

import { google } from 'googleapis'
import { db } from '@/db'
import { accounts, accountFields, users, userSettings } from '@/db/schema'
import { auth } from '@/auth'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { revalidatePath } from 'next/cache'

function getSheetsClient() {
  return google.sheets({
    version: 'v4',
    auth: new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    }),
  })
}

async function getAuthedUser() {
  const session = await auth()
  if (!session?.user?.email) throw new Error('Unauthorized')
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, session.user!.email!),
  })
  if (!user) throw new Error('User not found')
  return user
}

/**
 * Save (or update) the Google Sheet ID for the current user.
 * The user must have already shared their sheet with the service account email.
 */
export async function saveSpreadsheetId(spreadsheetId: string) {
  const user = await getAuthedUser()
  await db
    .insert(userSettings)
    .values({ userId: user.id, spreadsheetId })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { spreadsheetId },
    })
  revalidatePath('/')
}

/**
 * Get the current user's configured sheet ID, or null if not set.
 */
export async function getSpreadsheetId(): Promise<string | null> {
  const user = await getAuthedUser()
  const settings = await db.query.userSettings.findFirst({
    where: (s, { eq }) => eq(s.userId, user.id),
  })
  return settings?.spreadsheetId ?? null
}

/**
 * Import from the current user's Google Sheet into their vault.
 * Expects sheet columns: Type | Name | [field columns...]
 * Row 1 is the header row. Clears and replaces all existing accounts.
 */
export async function importFromSheet(): Promise<{ imported: number }> {
  const user = await getAuthedUser()
  const settings = await db.query.userSettings.findFirst({
    where: (s, { eq }) => eq(s.userId, user.id),
  })
  if (!settings?.spreadsheetId) throw new Error('No Google Sheet configured')

  const sheets = getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: settings.spreadsheetId,
    range: 'Sheet1',
  })

  const rows = res.data.values ?? []
  if (rows.length < 2) return { imported: 0 }

  const headers = rows[0] as string[]
  const dataRows = rows.slice(1)

  // Clear existing accounts for this user before import
  await db.delete(accounts).where(eq(accounts.userId, user.id))

  let imported = 0
  for (const row of dataRows) {
    const type = (row[0] as string) ?? ''
    const name = (row[1] as string) ?? ''
    if (!name) continue

    const accountId = nanoid()
    await db.insert(accounts).values({ id: accountId, userId: user.id, type, name })

    const fieldColumns = headers.slice(2)
    const fieldValues: typeof accountFields.$inferInsert[] = []

    fieldColumns.forEach((key, i) => {
      const value = (row[i + 2] as string) ?? ''
      let fieldType: 'text' | 'password' | 'pin' | 'email' | 'phone' = 'text'
      const lower = key.toLowerCase()
      if (lower.includes('password')) fieldType = 'password'
      else if (lower.includes('pin')) fieldType = 'pin'
      else if (lower.includes('email')) fieldType = 'email'
      else if (lower.includes('phone') || lower.includes('cell') || lower.includes('mobile')) fieldType = 'phone'

      fieldValues.push({
        id: nanoid(),
        accountId,
        fieldKey: key,
        fieldValue: value,
        fieldType,
        sortOrder: i,
      })
    })

    if (fieldValues.length > 0) {
      await db.insert(accountFields).values(fieldValues)
    }
    imported++
  }

  revalidatePath('/')
  return { imported }
}

/**
 * Export the current user's vault to their configured Google Sheet.
 * Overwrites the sheet entirely.
 */
export async function exportToSheet(): Promise<{ exported: number }> {
  const user = await getAuthedUser()
  const settings = await db.query.userSettings.findFirst({
    where: (s, { eq }) => eq(s.userId, user.id),
  })
  if (!settings?.spreadsheetId) throw new Error('No Google Sheet configured')

  const allAccounts = await db.query.accounts.findMany({
    where: (a, { eq }) => eq(a.userId, user.id),
    with: { fields: { orderBy: (f, { asc }) => [asc(f.sortOrder)] } },
  })

  const allKeys = new Set<string>()
  allAccounts.forEach((a) => a.fields.forEach((f) => allKeys.add(f.fieldKey)))
  const keyList = Array.from(allKeys)

  const header = ['Type', 'Name', ...keyList]
  const dataRows = allAccounts.map((a) => {
    const fieldMap = Object.fromEntries(a.fields.map((f) => [f.fieldKey, f.fieldValue ?? '']))
    return [a.type, a.name, ...keyList.map((k) => fieldMap[k] ?? '')]
  })

  const sheets = getSheetsClient()
  await sheets.spreadsheets.values.clear({
    spreadsheetId: settings.spreadsheetId,
    range: 'Sheet1',
  })
  await sheets.spreadsheets.values.update({
    spreadsheetId: settings.spreadsheetId,
    range: 'Sheet1!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [header, ...dataRows] },
  })

  return { exported: allAccounts.length }
}
```

---

## 7. Data Fetching

### `src/lib/data.ts`

```ts
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
```

---

## 8. File Structure

```
/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with ThemeProvider
│   │   ├── page.tsx                # Main vault page (server component)
│   │   ├── login/
│   │   │   └── page.tsx            # Login page
│   │   ├── settings/
│   │   │   └── page.tsx            # User settings (Google Sheets config)
│   │   └── api/
│   │       └── auth/
│   │           └── [...nextauth]/
│   │               └── route.ts
│   ├── components/
│   │   ├── account-card.tsx        # Single account display card
│   │   ├── account-form.tsx        # Create/edit form with dynamic fields
│   │   ├── account-list.tsx        # Filterable, grouped list
│   │   ├── copy-button.tsx         # Copy to clipboard with feedback
│   │   ├── delete-dialog.tsx       # Confirm delete dialog
│   │   ├── field-value.tsx         # Show/hide toggle for sensitive values
│   │   ├── search-bar.tsx          # Client-side search input
│   │   ├── sheets-settings.tsx     # Configure per-user Google Sheet ID
│   │   ├── sync-button.tsx         # Import/Export Google Sheets
│   │   ├── theme-toggle.tsx        # Dark/light mode toggle
│   │   └── top-bar.tsx             # App header with user avatar + sign out
│   ├── actions/
│   │   ├── accounts.ts
│   │   └── sync.ts
│   ├── db/
│   │   ├── index.ts
│   │   └── schema.ts
│   ├── lib/
│   │   ├── data.ts
│   │   └── utils.ts                # cn() helper + misc
│   └── auth.ts
├── drizzle/                        # Auto-generated migration files
├── drizzle.config.ts
├── middleware.ts
└── .env.local
```

---

## 9. Pages

### `/login` — `src/app/login/page.tsx`

A full-screen centered login page. Show the app name, a short tagline ("Your passwords. Yours alone."), and a single "Continue with Google" button. No form, no email/password input. Any Google account can sign up — a new user record is auto-created on first sign-in. On click, call `signIn('google')` from `next-auth/react`. If the user is already logged in, redirect to `/`.

Design: Dark background with a subtle radial gradient. The login card should be glassy/frosted (backdrop blur, semi-transparent border). The Google button should be clean and minimal, not the standard Google branding button — use a custom button with the Google logo icon from lucide or an inline SVG.

### `/` — `src/app/page.tsx`

Server component. Fetches all accounts with `getAllAccountsForUser()`. Renders `<TopBar>`, `<SearchBar>`, and `<AccountList accounts={accounts} />`.

### `/settings` — `src/app/settings/page.tsx`

Server component. Fetches the user's current `spreadsheetId` via `getSpreadsheetId()`. Renders a simple settings page with:

- A back link to `/`
- A **Google Sheets sync** section containing `<SheetsSettings spreadsheetId={...} />`
- Account info section (read-only): user's name, email, Google avatar, member since date

## 10. Components

### `<TopBar>`

Fixed at the top. Shows:
- Left: App name ("Vault" or a lock icon + "Vault")
- Right: `<ThemeToggle>`, a settings icon linking to `/settings`, user avatar (Google profile pic), sign out button

Sign out calls `signOut()` from `next-auth/react`.

### `<SearchBar>`

Client component. A controlled input that filters accounts client-side by name, type, or any field value. Pass results down to `<AccountList>`. Use `useTransition` for smooth filtering. Include a type filter — a row of pills/chips for each unique account type (Bank, Email, etc.) that toggles filtering.

### `<AccountList>`

Client component. Receives all accounts as props. Implements client-side search + type filtering. Groups accounts by type using a collapsible section per group. Each group shows a count badge. Renders `<AccountCard>` for each account.

### `<AccountCard>`

Displays one account. Shows:
- Type badge (coloured by type — consistent colour per type)
- Account name (large)
- Each field key + value (using `<FieldValue>` for sensitive types)
- `<CopyButton>` next to each field value
- Edit and Delete icon buttons in the top-right corner

Edit opens `<AccountForm>` in a `<Dialog>`. Delete opens `<DeleteDialog>`.

### `<FieldValue>`

For `fieldType === 'password'` or `'pin'`: show `••••••••` by default with an eye icon to reveal. For all other types: show value plainly. Animates the reveal transition.

### `<CopyButton>`

An icon button (clipboard icon). On click: copies the value to clipboard, icon changes to a checkmark for 1.5 seconds, then reverts. No toast — the inline icon change is the feedback.

### `<AccountForm>`

Used for both Create and Edit. Opens inside a `<Dialog>` (shadcn). Fields:

1. **Type** — a `<Select>` with preset options: Bank, Email, Investing, Social, Work, Shopping, Streaming, Other. User can type a custom value too (make it a combobox or allow typing).
2. **Name** — text input.
3. **Notes** — optional textarea.
4. **Custom fields** section:
   - A list of dynamic field rows. Each row has:
     - Field key input (e.g. "Username")
     - Field type selector: text / password / pin / email / phone
     - Field value input (masked if type = password or pin)
   - "Add field" button to append a new row
   - Drag handle or up/down arrows to reorder
   - Delete button per row
5. Submit button: "Save" for edit, "Add account" for create.

On submit, call the appropriate Server Action. Close dialog on success.

### `<DeleteDialog>`

shadcn `<AlertDialog>`. "Are you sure you want to delete [Account Name]? This cannot be undone." Confirm calls `deleteAccount(id)`.

### `<SheetsSettings>`

Lives on the `/settings` page. Allows each user to configure their own Google Sheet for sync.

Shows:
1. Instructions: "Share your Google Sheet with `[service account email]` (Editor access), then paste the Sheet ID below."
2. A text input for the Google Sheet ID (the long string from the sheet URL).
3. A "Save" button that calls `saveSpreadsheetId(id)`.
4. If a sheet ID is already saved: show it (truncated), a "Clear" option, and the import/export buttons.

If `GOOGLE_SERVICE_ACCOUNT_EMAIL` is not set in env, hide this entire section and show a notice: "Google Sheets sync is not configured for this app."

### `<SyncButton>`

Rendered inside `<SheetsSettings>` once a sheet ID is saved. A dropdown button with two options: "Import from Google Sheets" and "Export to Google Sheets". Each calls the relevant Server Action (`importFromSheet` / `exportToSheet`), shows a loading spinner during the request, and shows a success/error toast using shadcn's `<Sonner>` toast.

### `<ThemeToggle>`

Uses `next-themes`. Cycles through light → dark → system. Shows Sun / Moon / Monitor icons from lucide.

---

## 11. UI Design System

### Philosophy

**Refined vault aesthetic.** Think: a private banking app or a high-end password tool. Clean, typographically considered, dark-first but a beautiful light mode too. Nothing garish. Every element has breathing room. Security is implied through restraint.

### Typography

```css
/* Use Geist Sans (default from create-next-app) */
--font-sans: 'Geist Sans', system-ui, sans-serif;
--font-mono: 'Geist Mono', monospace;
```

- Body: 14px / line-height 1.6
- Account names: 18px / font-weight 500
- Type badges: 11px / uppercase / letter-spacing 0.08em / font-weight 600
- Field keys: 12px / font-weight 500 / muted colour
- Field values: 14px / monospace (`font-mono`) for passwords, pins, usernames

### Colour Tokens (CSS variables — define in `globals.css`)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 8%;
  --card: 0 0% 98%;
  --card-foreground: 240 10% 8%;
  --border: 240 5% 88%;
  --muted: 240 5% 94%;
  --muted-foreground: 240 5% 50%;
  --primary: 240 6% 12%;
  --primary-foreground: 0 0% 98%;
  --accent: 230 80% 58%;           /* Electric blue — used sparingly */
  --accent-foreground: 0 0% 100%;
  --destructive: 0 72% 51%;
  --radius: 0.75rem;
}

.dark {
  --background: 240 8% 8%;
  --foreground: 0 0% 95%;
  --card: 240 7% 11%;
  --card-foreground: 0 0% 95%;
  --border: 240 5% 18%;
  --muted: 240 6% 15%;
  --muted-foreground: 240 5% 55%;
  --primary: 0 0% 95%;
  --primary-foreground: 240 8% 8%;
  --accent: 230 80% 62%;
  --accent-foreground: 0 0% 100%;
  --destructive: 0 62% 55%;
}
```

### Type Badge Colours

Assign a consistent, muted colour per account type. Use these classes (define in `globals.css` or Tailwind config):

| Type | Light bg | Light text | Dark bg | Dark text |
|---|---|---|---|---|
| Bank | `#EEF2FF` | `#3730A3` | `#1e1b4b` | `#a5b4fc` |
| Email | `#F0FDF4` | `#166534` | `#14532d` | `#86efac` |
| Investing | `#FFF7ED` | `#9A3412` | `#431407` | `#fdba74` |
| Social | `#FDF4FF` | `#6B21A8` | `#3b0764` | `#d8b4fe` |
| Work | `#F0F9FF` | `#075985` | `#082f49` | `#7dd3fc` |
| Streaming | `#FFF1F2` | `#9F1239` | `#4c0519` | `#fda4af` |
| Shopping | `#FEFCE8` | `#854D0E` | `#422006` | `#fde047` |
| Other | `#F9FAFB` | `#374151` | `#111827` | `#9ca3af` |

Use `data-type` attributes and CSS to apply these, or a `getTypeStyle(type: string)` utility function.

### Layout

- Max content width: `860px`, centred
- TopBar: `h-14`, fixed, backdrop blur, border-bottom
- Content area: `pt-20 px-4 pb-16`
- Search + filter bar: sticky below TopBar
- Account cards: CSS grid — `grid-cols-1` on mobile, `grid-cols-2` on `md`, `grid-cols-3` on `xl`

### Cards

- Background: `var(--card)`
- Border: `1px solid var(--border)`
- Border radius: `var(--radius)` (12px)
- Padding: `1.25rem`
- Subtle box shadow in light mode: `0 1px 3px rgba(0,0,0,0.06)`
- On hover: border colour shifts slightly, smooth `transition`
- No heavy drop shadows, no gradients on cards

### Interactions & Motion

- All interactive elements: `transition-all duration-150`
- Dialog open/close: use shadcn default animation (scale + fade)
- CopyButton checkmark: `transition-all duration-200`
- Field reveal: `transition-all duration-200` opacity + blur effect
- Search filter: instant (no debounce needed at this scale)
- Loading states: use a subtle spinner (lucide `Loader2` with `animate-spin`), never skeleton screens

### Spacing

Follow an 8px baseline grid throughout. Use Tailwind spacing tokens only — `p-2` (8px), `p-3` (12px), `p-4` (16px), `p-6` (24px), `gap-2`, `gap-4`, etc.

---

## 12. Root Layout

`src/app/layout.tsx`:

```tsx
import { ThemeProvider } from 'next-themes'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata = {
  title: 'Vault',
  description: 'Personal password manager',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

---

## 13. shadcn Setup

After running `npx shadcn@latest init`, install these components:

```bash
npx shadcn@latest add button input label select textarea dialog alert-dialog badge separator sonner tooltip
```

Use the **default** style with **zinc** base colour. The custom CSS variables in `globals.css` (section 11 above) override the defaults.

---

## 14. Google Sheets Setup (for sync)

The sync feature uses a single shared service account (configured by the app owner in env vars) but each user connects their **own** Google Sheet. No env var holds a sheet ID — that is per-user configuration stored in `user_settings`.

**App owner setup (one time):**
1. Create a Google Cloud project.
2. Enable the **Google Sheets API**.
3. Create a **Service Account**. Download the JSON key.
4. Extract `client_email` and `private_key` from the JSON → add to env vars as `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.

**Per user setup (each user does this themselves):**
1. Create or open a Google Sheet.
2. Share it with the service account email shown on the `/settings` page (Editor access).
3. Copy the Sheet ID from the URL (the long alphanumeric string between `/d/` and `/edit`).
4. Paste it into the Sheet ID field on `/settings` and click Save.

The sheet format for import must match:
```
Row 1 (header): Type | Name | [any field columns]
Row 2+:         Bank | Revolut | +447350140920 | alewison | lewison97@gmail.com | |
```

Column headers in row 1 become the `fieldKey` values. Column order doesn't matter. Empty values are stored as empty strings.

---

## 15. Deployment

1. Push the project to a GitHub repository.
2. Connect the repo to a new Vercel project.
3. Add all environment variables from section 3 in Vercel's project settings.
4. Set the Framework Preset to **Next.js**.
5. Deploy.
6. After first deploy, run `npx drizzle-kit push` locally (with prod env vars set) to create the tables in Turso.
7. Add the Vercel production URL to the Google OAuth allowed redirect URIs: `https://your-app.vercel.app/api/auth/callback/google`.

**Turso free tier limits** (as of 2025): 500 databases, 1GB storage, 1 billion row reads/month. For a personal password manager this will never be approached.

**Vercel free tier**: Hobby plan supports personal projects indefinitely. Serverless functions never "disappear" — they spin up on each request.

---

## 16. Security Notes

- Any Google account can sign up. There is no invite gate or allowlist — this is intentional. All data is isolated by `userId`.
- Every Server Action and data query is scoped to the authenticated user's ID. It is impossible for user A to read, write, or delete user B's data — the `userId` is always sourced from the server session, never from client input.
- Passwords are stored in plaintext in the DB. For a personal tool this is typically acceptable. If you want encryption at rest: use `crypto.createCipheriv` with an `ENCRYPTION_KEY` env var to encrypt `fieldValue` before insert and decrypt after read. Apply this consistently in all Server Actions.
- Never expose the Turso auth token or Google service account key in client-side code. All DB access is server-side only (Server Actions, Server Components).
- The Google Sheets service account can only access sheets that the user has explicitly shared with it. Users share their own sheet — no other sheets are accessible.

---

## 17. Pre-Seeded Account Types

When a new user authenticates for the first time, optionally insert a small set of example accounts to demonstrate the UI. This is entirely optional and can be skipped — the app works fine empty.

---

## 18. Build & Run Commands

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Push schema to Turso
npx drizzle-kit push

# Build for production
npm run build
```

---

## 19. Completion Checklist

An implementation is complete when all of the following are true:

- [ ] `npx drizzle-kit push` creates all four tables (`users`, `accounts`, `account_fields`, `user_settings`) in Turso with no errors
- [ ] Navigating to `/` without being logged in redirects to `/login`
- [ ] Any Google account can sign in — a new user record is created automatically on first sign-in
- [ ] An authenticated user sees their own vault (empty state if no accounts)
- [ ] Two different Google accounts have completely separate vaults — neither can see the other's data
- [ ] Clicking "Add account" opens the form dialog
- [ ] A new account with custom fields can be created and appears in the list
- [ ] An account can be edited — existing values pre-populate the form
- [ ] An account can be deleted after confirmation
- [ ] Password/pin fields are masked by default and reveal on click
- [ ] Any field value can be copied to clipboard with visual feedback
- [ ] Search filters accounts in real time
- [ ] Type filter pills filter by account type
- [ ] Dark/light mode toggle works and persists across page reloads
- [ ] `/settings` shows account info and the Google Sheets configuration section
- [ ] A user can enter their own Sheet ID in settings and save it
- [ ] "Import from Google Sheets" populates the user's vault from their configured sheet
- [ ] "Export to Google Sheets" writes the user's accounts back to their sheet
- [ ] Signing out redirects to `/login`
- [ ] The app is deployed on Vercel and works at the production URL
