# psswrd

A zero-knowledge password manager built with Next.js. Your credentials are encrypted in your browser before they ever reach the server — the server never sees your plaintext data.

**Live at [psswrd.store](https://psswrd.store)**

---

## How the encryption works

### Overview

psswrd uses a two-layer encryption model: a **Data Encryption Key (DEK)** encrypts your stored credentials, and that DEK is itself wrapped by a **Key Encryption Key (KEK)** derived from your PIN. The server stores only ciphertext — it has no way to decrypt your data.

### Algorithms

| Purpose | Algorithm | Parameters |
|---|---|---|
| Field encryption | AES-256-GCM | 12-byte random IV per field |
| Key derivation | HMAC-SHA256 + Argon2id | 64 MB memory, 3 iterations, 1 parallelism |
| DEK wrapping | AES-256-GCM | 12-byte random IV per wrap |

### Key derivation chain

When you set up or unlock your vault, the following chain runs entirely in your browser:

```
PIN + kekSalt
      │
      ▼
HMAC-SHA256(VAULT_PEPPER, kekSalt ∥ PIN)   ← server computes this, returns the HMAC
      │
      ▼
Argon2id(hmac, kekSalt, m=64MB, t=3, p=1)  ← browser derives the KEK
      │
      ▼
     KEK  ──────────► AES-GCM-unwrap(wrappedDek)  ──► DEK (in memory only)
                                                           │
                                                           ▼
                                              AES-GCM-decrypt(fieldCiphertext)
                                                           │
                                                           ▼
                                                    Plaintext credential
```

The server contributes `VAULT_PEPPER` (a per-deployment secret never sent to the client) via the HMAC step. This means a compromised database alone is not enough to brute-force PINs — an attacker would also need the server-side pepper.

### DEK wrapping

A fresh 256-bit DEK is generated once when you create your vault. The DEK is wrapped (encrypted) with the KEK using AES-256-GCM and the wrapped blob is stored in the database alongside its IV. When you change your PIN, only the DEK wrapper is re-computed — all your field ciphertexts remain intact.

### Field encryption

Every individual credential field (password, username, etc.) is encrypted with the DEK using AES-256-GCM with a unique 12-byte random IV. The resulting ciphertext (including the 16-byte authentication tag) is stored in the database as a binary blob. The IV is stored separately.

The DEK never leaves the browser. After decryption it is held as a non-extractable `CryptoKey` object — the raw bytes cannot be read from JavaScript or browser developer tools.

### Implementation files

| File | Responsibility |
|---|---|
| [lib/vault-crypto.ts](lib/vault-crypto.ts) | AES-GCM encryption/decryption, Argon2id derivation, key wrap/unwrap (runs in browser) |
| [lib/vault-server.ts](lib/vault-server.ts) | HMAC computation, salt generation, lockout enforcement (runs on server) |
| [components/vault-provider.tsx](components/vault-provider.tsx) | React context holding the in-memory DEK + auto-lock logic |
| [app/api/vault/](app/api/vault/) | Vault setup, unlock, and PIN-change API routes |

### Security properties

- **Zero-knowledge**: The server stores only ciphertext and never decrypts it.
- **Server-side pepper**: HMAC binds key derivation to a server secret; a leaked database alone cannot be brute-forced.
- **Memory-hard KDF**: Argon2id (64 MB, 3 iterations) makes offline attacks expensive.
- **Non-extractable keys**: DEK and KEK are loaded as Web Crypto `CryptoKey` objects with `extractable: false`.
- **Auto-lock**: The vault locks after 15 minutes of inactivity, on tab switch, and on page unload.
- **Rate limiting**: Up to 5 failed PIN attempts before progressive lockouts (1 min → 15 min → 1 hour). After 20 failures the account requires re-authentication.

---

## Tech stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Auth**: NextAuth.js 5 — Google OAuth + email magic links (Resend)
- **Database**: Turso (LibSQL/SQLite)
- **ORM**: Drizzle ORM
- **Crypto**: Web Crypto API + `hash-wasm` (Argon2id)

---

## Getting started

### Prerequisites

- Node.js 20+
- A [Turso](https://turso.tech) account (free tier works)
- A [Resend](https://resend.com) account for email magic links
- A Google Cloud project with OAuth 2.0 credentials

### Clone and install

```bash
git clone https://github.com/your-username/password-manager.git
cd password-manager
npm install
```

### Set up the database

```bash
# Install the Turso CLI
brew install tursodatabase/tap/turso

# Log in and create a database
turso auth login
turso db create psswrd

# Get the connection URL and auth token
turso db show psswrd --url
turso db tokens create psswrd
```

### Run database migrations

```bash
npm run db:push
```

### Environment variables

Create a `.env.local` file in the project root with the following variables:

```env
# ── Authentication ──────────────────────────────────────────────────────────────

# Secret used to sign JWT session tokens and hash OTP codes.
# Generate with: openssl rand -base64 32
AUTH_SECRET=

# Google OAuth credentials (from Google Cloud Console → APIs & Services → Credentials)
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# ── Email (magic links) ─────────────────────────────────────────────────────────

# Resend API key for sending sign-in emails
RESEND_API_KEY=

# Optional: override the sender address (defaults to onboarding@resend.dev in dev)
RESEND_FROM=

# ── Database ────────────────────────────────────────────────────────────────────

# Turso database connection URL (libsql://...)
TURSO_DATABASE_URL=

# Turso auth token
TURSO_AUTH_TOKEN=

# ── Vault encryption ────────────────────────────────────────────────────────────

# Server-side pepper used in HMAC-SHA256 during PIN key derivation.
# Must be a base64-encoded 32-byte value. Keep this secret and constant —
# changing it invalidates all existing vaults.
# Generate with: openssl rand -base64 32
VAULT_PEPPER=

# ── Google Sheets sync (optional) ───────────────────────────────────────────────

# Service account email for the Google Sheets sync feature.
# Leave blank to disable the feature.
GOOGLE_SERVICE_ACCOUNT_EMAIL=

# Service account private key (PEM format, include the full -----BEGIN ... END----- block)
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
```

> **Important**: `VAULT_PEPPER` is critical for vault security. Use a randomly generated 32-byte value and never change it after users have created vaults — doing so will make all existing vaults permanently inaccessible.

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for production

```bash
npm run build
npm start
```

---

## Google OAuth setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials.
2. Create an OAuth 2.0 Client ID (Web application).
3. Add `http://localhost:3000/api/auth/callback/google` to Authorised redirect URIs for local dev.
4. Add the equivalent production URL for production deployments.
5. Copy the Client ID and Client Secret into `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

---

## Google Sheets sync (optional)

If you want to enable the optional Google Sheets export/sync feature:

1. Create a Google Cloud service account with the Sheets API enabled.
2. Download the JSON key, extract the `client_email` and `private_key` fields.
3. Set `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` accordingly.

Leave both variables empty to disable the feature entirely.

---

## License

MIT
