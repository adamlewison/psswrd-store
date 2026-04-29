import { getAuthedUser, finalizeVaultSetup } from '@/lib/vault-server'

/**
 * Step 2 of vault setup.
 * POST { wrappedDek: string (base64), dekIv: string (base64) }
 * → { ok: true }
 *
 * Stores the client-encrypted DEK. Server never sees the plaintext DEK.
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthedUser()

    if (!user.kekSalt) {
      return Response.json({ error: 'Start setup first (POST /api/vault/setup)' }, { status: 400 })
    }

    const { wrappedDek, dekIv } = await request.json() as {
      wrappedDek?: string
      dekIv?: string
    }

    if (!wrappedDek || !dekIv) {
      return Response.json({ error: 'wrappedDek and dekIv are required' }, { status: 400 })
    }

    const wrappedDekBuf = Buffer.from(wrappedDek, 'base64')
    const dekIvBuf = Buffer.from(dekIv, 'base64')

    if (dekIvBuf.length !== 12) {
      return Response.json({ error: 'dekIv must be 12 bytes' }, { status: 400 })
    }

    await finalizeVaultSetup(user.id, wrappedDekBuf, dekIvBuf)
    return Response.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return Response.json({ error: msg }, { status })
  }
}
